'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { saveSlide } from '@/lib/playbookActions'
import type { PageLayout, SlideBlock } from '@/lib/playbook'

/** What can change on a slide as it is worked on. Sections move with arrangeSlides. */
export interface SlidePatch {
  title?: string
  blocks?: SlideBlock[]
  layout?: PageLayout
  notes?: string | null
}

export type SaveState = 'idle' | 'saving' | 'saved' | 'error'

/** How long the editor waits after the last change before it writes. */
const QUIET_MS = 600

/**
 * Saving as you go.
 *
 * Every change lands in a queue, one entry per page, and the queue is written
 * once the coach stops for a moment — or straight away when he switches page,
 * leaves, or puts the phone down. Writes go one at a time, in order, so a slow
 * save never lands after a newer one. Anything that fails to reach the server
 * stays queued for the retry.
 */
export function useAutosave() {
  const pending = useRef(new Map<string, SlidePatch>())
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const chain = useRef<Promise<unknown>>(Promise.resolve())
  const busy = useRef(0)
  const [state, setState] = useState<SaveState>('idle')
  const [error, setError] = useState<string | null>(null)

  /** Run a write after every write before it, with the indicator kept honest. */
  const write = useCallback(<T,>(job: () => Promise<T>): Promise<T> => {
    busy.current += 1
    setState('saving')
    const run = chain.current.then(job)
    chain.current = run.catch(() => undefined)
    return run.finally(() => {
      busy.current -= 1
    })
  }, [])

  const settle = useCallback((ok: boolean, message?: string) => {
    if (!ok) {
      setError(message ?? 'Couldn’t save.')
      setState('error')
    } else if (busy.current === 0 && pending.current.size === 0) {
      setError(null)
      setState('saved')
    }
  }, [])

  /** Write everything queued now. Resolves true once it is all on the server. */
  const flush = useCallback((): Promise<boolean> => {
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }
    if (!pending.current.size) return chain.current.then(() => true, () => true)
    const batch = [...pending.current]
    pending.current.clear()
    return write(async () => {
      let ok = true
      let message: string | undefined
      for (const [id, patch] of batch) {
        try {
          const res = await saveSlide({ id, ...patch })
          if (!res.ok) {
            // The server said no (the page is gone): retrying won't change its mind.
            ok = false
            message = res.error
          }
        } catch {
          ok = false
          message = 'Couldn’t reach the server.'
          // Put it back under anything newer, so the retry sends both.
          pending.current.set(id, { ...patch, ...(pending.current.get(id) ?? {}) })
        }
      }
      return { ok, message }
    }).then(({ ok, message }) => {
      settle(ok, message)
      return ok
    })
  }, [write, settle])

  /** Queue a change to one page; it is written when things go quiet. */
  const queue = useCallback(
    (id: string, patch: SlidePatch) => {
      pending.current.set(id, { ...(pending.current.get(id) ?? {}), ...patch })
      setState('saving')
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => void flush(), QUIET_MS)
    },
    [flush],
  )

  /** Forget what was queued for a page that is about to be deleted. */
  const drop = useCallback((id: string) => {
    pending.current.delete(id)
  }, [])

  /** A one-off write — arranging, adding, deleting — in line with the saves. */
  const act = useCallback(
    async <T extends { ok: boolean; error?: string }>(job: () => Promise<T>): Promise<T | null> => {
      try {
        const res = await write(job)
        settle(res.ok, res.error)
        return res
      } catch {
        settle(false, 'Couldn’t reach the server.')
        return null
      }
    },
    [write, settle],
  )

  // Leaving with changes still queued: write them, and ask the browser to hold on.
  useEffect(() => {
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (!pending.current.size && busy.current === 0) return
      void flush()
      e.preventDefault()
      e.returnValue = ''
    }
    // A phone put away mid-edit never fires beforeunload; this is the last word it gets.
    const hidden = () => {
      if (document.visibilityState === 'hidden') void flush()
    }
    window.addEventListener('beforeunload', beforeUnload)
    document.addEventListener('visibilitychange', hidden)
    return () => {
      window.removeEventListener('beforeunload', beforeUnload)
      document.removeEventListener('visibilitychange', hidden)
      void flush()
    }
  }, [flush])

  return { state, error, queue, flush, drop, act }
}
