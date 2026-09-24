'use client'

import { useMemo, useSyncExternalStore } from 'react'
import { CAL_TEAMS, isCalTeam, isCalView, type CalTeam, type CalView } from '@/lib/calendarModel'
import { CAL_LAYERS, type CalLayer } from './calShared'

/**
 * The calendar's view of the browser: whether it has hydrated, how wide the
 * screen is, what time it is, and what the coach last chose to look at.
 *
 * All four are read with useSyncExternalStore rather than copied into state in
 * an effect. The server has no clock in Cary, no screen and no localStorage, so
 * it renders a neutral first frame; the browser's first render matches it and
 * then settles on the real answer, with no flash of the wrong thing and no
 * hydration warning.
 */

const noop = () => () => {}

/** False on the server and during hydration, true once the browser has taken over. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  )
}

// ── Screen width ────────────────────────────────────────────────────────────

const NARROW_QUERY = '(max-width: 639px)'

function subscribeNarrow(cb: () => void) {
  const mq = window.matchMedia(NARROW_QUERY)
  mq.addEventListener('change', cb)
  return () => mq.removeEventListener('change', cb)
}

/** A phone-width screen — below Tailwind's sm breakpoint. */
export function useNarrow(): boolean {
  return useSyncExternalStore(
    subscribeNarrow,
    () => window.matchMedia(NARROW_QUERY).matches,
    () => false,
  )
}

// ── The clock ───────────────────────────────────────────────────────────────

function subscribeMinute(cb: () => void) {
  // Every 30 seconds is enough for a red line that moves a pixel a minute.
  const t = window.setInterval(cb, 30_000)
  return () => window.clearInterval(t)
}

/** Now, to the minute, as ms. Zero on the server — nothing timed is drawn there. */
export function useNowMinute(): number {
  return useSyncExternalStore(
    subscribeMinute,
    () => Math.floor(Date.now() / 60_000) * 60_000,
    () => 0,
  )
}

// ── What the coach chose last time ──────────────────────────────────────────

export interface CalPrefs {
  view: CalView | null
  teams: CalTeam[]
  layers: CalLayer[]
  /** Field Availability — the open slots — drawn or not. */
  fields: boolean
}

const PREFS_KEY = 'gh-calendar-prefs-v1'
const PREFS_EVENT = 'gh-calendar-prefs'
const ALL_TEAMS = CAL_TEAMS.map((t) => t.key)
const ALL_LAYERS = CAL_LAYERS.map((l) => l.key)

// If the browser refuses localStorage (a private window, a locked-down school
// laptop) the choices still hold for this visit, here.
let memoryPrefs = ''

function readRaw(): string {
  try {
    return localStorage.getItem(PREFS_KEY) ?? memoryPrefs
  } catch {
    return memoryPrefs
  }
}

function subscribePrefs(cb: () => void) {
  window.addEventListener(PREFS_EVENT, cb)
  window.addEventListener('storage', cb)
  return () => {
    window.removeEventListener(PREFS_EVENT, cb)
    window.removeEventListener('storage', cb)
  }
}

function parsePrefs(raw: string): CalPrefs {
  let o: Record<string, unknown> = {}
  try {
    o = raw ? (JSON.parse(raw) as Record<string, unknown>) : {}
  } catch {
    o = {}
  }
  const teams = Array.isArray(o.teams) ? o.teams.filter(isCalTeam) : []
  const layers = Array.isArray(o.layers)
    ? (o.layers.filter((l) => ALL_LAYERS.includes(l as CalLayer)) as CalLayer[])
    : []
  return {
    view: isCalView(o.view) ? o.view : null,
    // Nothing saved, or everything switched off, both read as "show it all" —
    // an empty calendar a coach can't explain is worse than a full one.
    teams: teams.length ? teams : ALL_TEAMS,
    layers: layers.length ? layers : ALL_LAYERS,
    fields: o.fields !== false,
  }
}

/** The saved view and filters. The raw string is the snapshot, so it stays stable. */
export function usePrefs(): CalPrefs {
  const raw = useSyncExternalStore(subscribePrefs, readRaw, () => '')
  return useMemo(() => parsePrefs(raw), [raw])
}

export function savePrefs(patch: Partial<CalPrefs>) {
  const next = { ...parsePrefs(readRaw()), ...patch }
  const raw = JSON.stringify(next)
  memoryPrefs = raw
  try {
    localStorage.setItem(PREFS_KEY, raw)
  } catch {
    // Kept in memory above; it just won't survive a reload.
  }
  // Same-tab writes don't raise a storage event, so say so ourselves.
  window.dispatchEvent(new Event(PREFS_EVENT))
}
