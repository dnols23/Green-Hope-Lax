'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import {
  ALL_SOURCE,
  DEFAULT_DWELL,
  DWELL_CHOICES,
  LIKED_SOURCE,
  REPEAT_NEXT,
  isRepeatMode,
  nextIndex,
  playOrder,
  prevIndex,
  quoteIndexForDay,
  sourceIds,
  sourceName,
  type RepeatMode,
  type WallLibrary,
  type WallQuote,
} from '@/lib/wallModel'
import { toggleWallLike } from '@/lib/wallActions'

/**
 * The quote player's state.
 *
 * What's playing, shuffle, repeat and how long each quote holds are kept in the
 * coach's own browser, so the War Room panel and the full player are the same
 * player: pick a playlist on one and the other is playing it too. Whether it is
 * actually running, and how far through the current quote, live only in memory
 * — the wall never starts cycling on its own when a page opens.
 */

const KEY = 'gh-wall-player-v1'
const EVENT = 'gh-wall-player-changed'

interface Saved {
  source: string
  /** The quote on the wall, or null for today's quote. */
  current: string | null
  shuffle: boolean
  /** The quote shuffle was switched on at, kept at the front of the order. */
  shuffleFirst: string | null
  seed: number
  repeat: RepeatMode
  dwell: number
}

const DEFAULTS: Saved = {
  source: ALL_SOURCE,
  current: null,
  shuffle: false,
  shuffleFirst: null,
  seed: 1,
  repeat: 'all',
  dwell: DEFAULT_DWELL,
}

function read(): string {
  try {
    return localStorage.getItem(KEY) ?? ''
  } catch {
    return ''
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange)
  window.addEventListener('storage', onChange)
  return () => {
    window.removeEventListener(EVENT, onChange)
    window.removeEventListener('storage', onChange)
  }
}

function parse(json: string): Saved {
  if (!json) return DEFAULTS
  try {
    const raw = JSON.parse(json) as Partial<Saved>
    return {
      source: typeof raw.source === 'string' ? raw.source : DEFAULTS.source,
      current: typeof raw.current === 'string' ? raw.current : null,
      shuffle: raw.shuffle === true,
      shuffleFirst: typeof raw.shuffleFirst === 'string' ? raw.shuffleFirst : null,
      seed: Number.isFinite(raw.seed) ? Number(raw.seed) : 1,
      repeat: isRepeatMode(raw.repeat) ? raw.repeat : DEFAULTS.repeat,
      dwell: DWELL_CHOICES.includes(Number(raw.dwell)) ? Number(raw.dwell) : DEFAULT_DWELL,
    }
  } catch {
    return DEFAULTS
  }
}

function save(next: Saved) {
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {}
  window.dispatchEvent(new Event(EVENT))
}

export interface WallPlayer {
  lib: WallLibrary
  quote: WallQuote | null
  order: string[]
  index: number
  source: string
  sourceLabel: string
  playing: boolean
  /** 0–1 through the current quote. */
  progress: number
  shuffle: boolean
  repeat: RepeatMode
  dwell: number
  isLiked: (id: string) => boolean
  play: () => void
  pause: () => void
  toggle: () => void
  next: () => void
  prev: () => void
  toggleShuffle: () => void
  cycleRepeat: () => void
  setDwell: (s: number) => void
  /** Start a source, optionally from one quote in it, optionally switching shuffle on. */
  playSource: (source: string, quoteId?: string | null, start?: boolean, shuffle?: boolean) => void
  like: (id: string, on?: boolean) => void
  /** The next few in the queue, for "Up next". */
  upNext: WallQuote[]
  error: string | null
  clearError: () => void
  refresh: () => void
}

export function useWallPlayer(lib: WallLibrary, today: string): WallPlayer {
  const router = useRouter()
  const saved = parse(useSyncExternalStore(subscribe, read, () => ''))

  const [playing, setPlaying] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  // The clock's own count, written only by the timer and the controls.
  const clock = useRef(0)
  // The queue ran out with repeat off; play starts it over.
  const [ended, setEnded] = useState(false)
  const [likeOverride, setLikeOverride] = useState<Record<string, boolean>>({})
  const [error, setError] = useState<string | null>(null)

  const byId = useMemo(() => new Map(lib.quotes.map((q) => [q.id, q])), [lib.quotes])

  // A playlist that was deleted, or a private one on someone else's browser,
  // falls back to every quote.
  const source =
    saved.source === ALL_SOURCE || saved.source === LIKED_SOURCE || lib.playlists.some((p) => p.id === saved.source)
      ? saved.source
      : ALL_SOURCE

  const ids = useMemo(() => sourceIds(lib, source), [lib, source])
  const order = useMemo(
    () => playOrder(ids, saved.shuffle, saved.seed, saved.shuffleFirst),
    [ids, saved.shuffle, saved.seed, saved.shuffleFirst],
  )

  let index = saved.current ? order.indexOf(saved.current) : -1
  if (index < 0) index = quoteIndexForDay(today, order.length)
  const quote = order.length ? (byId.get(order[index]) ?? null) : null

  // Read fresh at the moment of writing, so two quick taps don't undo each other.
  const update = useCallback((patch: Partial<Saved>) => save({ ...parse(read()), ...patch }), [])

  const resetClock = useCallback(() => {
    clock.current = 0
    setElapsed(0)
  }, [])

  const goTo = useCallback(
    (i: number) => {
      const id = order[i]
      if (!id) return
      resetClock()
      update({ current: id })
    },
    [order, update, resetClock],
  )

  const advance = useCallback(
    (auto: boolean) => {
      const n = nextIndex(index, order.length, parse(read()).repeat, auto)
      if (n === null) {
        setPlaying(false)
        resetClock()
        setEnded(true)
        return
      }
      if (n === index) resetClock()
      else goTo(n)
    },
    [index, order.length, goTo, resetClock],
  )

  // The clock. Ticks in the callback only, never straight in the effect body.
  const advanceRef = useRef(advance)
  useEffect(() => {
    advanceRef.current = advance
  }, [advance])
  const dwellMs = saved.dwell * 1000
  useEffect(() => {
    if (!playing) return
    let last = performance.now()
    const t = window.setInterval(() => {
      const now = performance.now()
      clock.current += now - last
      last = now
      if (clock.current >= dwellMs) {
        clock.current = 0
        setElapsed(0)
        advanceRef.current(true)
      } else {
        setElapsed(clock.current)
      }
    }, 100)
    return () => window.clearInterval(t)
  }, [playing, dwellMs])

  const isLiked = useCallback(
    (id: string) => (id in likeOverride ? likeOverride[id] : lib.liked.includes(id)),
    [likeOverride, lib.liked],
  )

  const refresh = useCallback(() => router.refresh(), [router])

  const like = useCallback(
    (id: string, on?: boolean) => {
      const next = on ?? !isLiked(id)
      setLikeOverride((o) => ({ ...o, [id]: next }))
      toggleWallLike(id, next)
        .then((r) => {
          if (!r.ok) {
            setLikeOverride((o) => ({ ...o, [id]: !next }))
            setError(r.error)
          } else router.refresh()
        })
        .catch(() => {
          setLikeOverride((o) => ({ ...o, [id]: !next }))
          setError('No connection — try again.')
        })
    },
    [isLiked, router],
  )

  function start() {
    if (!order.length) return
    if (ended) {
      setEnded(false)
      goTo(0)
    }
    setPlaying(true)
  }

  const upNext = useMemo(() => {
    const out: WallQuote[] = []
    for (let k = 1; k <= Math.min(5, order.length - 1); k++) {
      const i = (index + k) % order.length
      if (i < index && saved.repeat === 'off') break
      const q = byId.get(order[i])
      if (q) out.push(q)
    }
    return out
  }, [order, index, byId, saved.repeat])

  return {
    lib,
    quote,
    order,
    index,
    source,
    sourceLabel: sourceName(lib, source),
    playing,
    progress: dwellMs ? Math.min(1, elapsed / dwellMs) : 0,
    shuffle: saved.shuffle,
    repeat: saved.repeat,
    dwell: saved.dwell,
    isLiked,
    play: () => start(),
    pause: () => setPlaying(false),
    toggle: () => (playing ? setPlaying(false) : start()),
    next: () => {
      setEnded(false)
      advance(false)
    },
    prev: () => {
      // Like a music app: most of the way through a quote, back restarts it.
      if (elapsed > 3000 && playing) {
        resetClock()
        return
      }
      goTo(prevIndex(index, order.length, saved.repeat))
    },
    toggleShuffle: () => {
      const on = !saved.shuffle
      update({
        shuffle: on,
        shuffleFirst: on ? (quote?.id ?? null) : null,
        seed: on ? (Math.floor(Math.random() * 2 ** 31) || 1) : saved.seed,
        current: quote?.id ?? null,
      })
    },
    cycleRepeat: () => update({ repeat: REPEAT_NEXT[saved.repeat] }),
    setDwell: (s: number) => {
      resetClock()
      update({ dwell: DWELL_CHOICES.includes(s) ? s : DEFAULT_DWELL })
    },
    playSource: (next: string, quoteId?: string | null, start = true, shuffleOn?: boolean) => {
      // From the quote tapped, or from the top of the (freshly shuffled) order.
      const shuffled = shuffleOn ?? saved.shuffle
      const seed = shuffled ? Math.floor(Math.random() * 2 ** 31) || 1 : saved.seed
      const firstId = quoteId ?? playOrder(sourceIds(lib, next), shuffled, seed, null)[0] ?? null
      resetClock()
      setEnded(false)
      update({ source: next, current: firstId, shuffle: shuffled, shuffleFirst: shuffled ? firstId : null, seed })
      if (start) setPlaying(true)
    },
    like,
    upNext,
    error,
    clearError: () => setError(null),
    refresh,
  }
}
