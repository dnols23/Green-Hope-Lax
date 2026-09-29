'use client'

import { useEffect, useRef, useState, type RefObject } from 'react'
import { savePlan } from '@/lib/actions'

export interface AutosaveState {
  status: 'idle' | 'saving' | 'saved' | 'error'
  /** When the last save landed. */
  at: number | null
  error?: string
}

const snapshot = (fd: FormData) =>
  [...fd.entries()].map(([k, v]) => `${k}=${typeof v === 'string' ? v : v.name}`).join('&')

/**
 * Saves the plan by itself. A coach who teaches all day gets pulled away mid-
 * plan; what he had is saved a couple of seconds after he stops, the moment he
 * switches apps or locks the phone, and when he leaves the page.
 *
 * It watches the form rather than each editor's state: every editor keeps its
 * plan in the form's hidden inputs for the Save button, so whatever Save would
 * send is what this sends.
 */
export function useAutosave(form: RefObject<HTMLFormElement | null>, enabled: boolean, delay = 2000): AutosaveState {
  const [state, setState] = useState<AutosaveState>({ status: 'idle', at: null })
  const saved = useRef<string | null>(null)
  const latest = useRef<{ snap: string; fd: FormData } | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const busy = useRef(false)
  const flush = useRef<() => Promise<void>>(async () => {})

  // The save itself, rebuilt each render so it always has the latest setters.
  useEffect(() => {
    flush.current = async () => {
      window.clearTimeout(timer.current)
      const job = latest.current
      if (!job || busy.current) return
      busy.current = true
      latest.current = null
      setState((s) => ({ ...s, status: 'saving' }))
      try {
        const res = await savePlan({ ok: true }, job.fd)
        // Saved, or refused for a reason another try won't fix: either way this
        // version is done with, so it isn't sent again and again.
        saved.current = job.snap
        setState(res.ok ? { status: 'saved', at: Date.now() } : { status: 'error', at: null, error: res.error })
      } catch {
        // No signal. Keep it and try again shortly.
        latest.current = latest.current ?? job
        setState({ status: 'error', at: null, error: 'Not saved yet — no connection. Trying again.' })
      } finally {
        busy.current = false
        if (latest.current && latest.current.snap !== saved.current) {
          timer.current = window.setTimeout(() => void flush.current(), delay)
        }
      }
    }
  })

  // After every change: if the form now says something new, save it soon.
  useEffect(() => {
    const f = form.current
    if (!f || !enabled) return
    const fd = new FormData(f)
    const snap = snapshot(fd)
    if (saved.current === null) {
      saved.current = snap
      return
    }
    if (snap === saved.current) {
      latest.current = null
      window.clearTimeout(timer.current)
      return
    }
    latest.current = { snap, fd }
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => void flush.current(), delay)
  })

  // Switching apps, locking the phone, closing the tab, or leaving the page.
  useEffect(() => {
    const now = () => void flush.current()
    const onHide = () => {
      if (document.visibilityState === 'hidden') now()
    }
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', now)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', now)
      now()
    }
  }, [])

  return state
}

/** The line beside Save that says where things stand. */
export function AutosaveNote({ state }: { state: AutosaveState }) {
  if (state.status === 'saving') return <span className="text-xs text-gray-400">Saving…</span>
  if (state.status === 'error') return <span className="text-xs font-semibold text-red-700">{state.error}</span>
  if (state.status === 'saved' && state.at) {
    const t = new Date(state.at)
    return (
      <span className="text-xs text-gray-400">
        Saved {t.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
      </span>
    )
  }
  return <span className="text-xs text-gray-400">Saves as you go</span>
}
