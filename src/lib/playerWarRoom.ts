// The players' War Room — what the Team Hub opens on. The head coach builds it
// in Admin → Team Hub; the players only read it.
//
// Pure: the shape, the defaults and the reading of what was stored. It lives in
// app_settings under one key, so there is no SQL to run.

import type { Team } from './teams'

export const PLAYER_WAR_ROOM_KEY = 'player_war_room'

export type PlayerPanelKey = 'quote' | 'today' | 'week' | 'priorities' | 'leaders'

export const PLAYER_PANELS: { key: PlayerPanelKey; label: string; icon: string }[] = [
  { key: 'quote', label: 'Quote', icon: '💬' },
  { key: 'today', label: 'Today’s practice', icon: '📋' },
  { key: 'week', label: 'The week ahead', icon: '🗓' },
  { key: 'priorities', label: 'Priorities', icon: '🎯' },
  { key: 'leaders', label: 'Leadership', icon: '🦅' },
]

export interface Leader {
  id: string
  /** "Captains", "Film captain", "Equipment". */
  title: string
  /** Who holds it: "#12 Jake Smith, #7 Luke Ortiz". */
  who: string
  /** What the job is. */
  duties: string
}

/** Where the quote comes from: one day's pick from a set, one quote, or his own words. */
export type QuoteChoice =
  | { mode: 'rotate'; source: string }
  | { mode: 'pick'; quoteId: string }
  | { mode: 'custom'; line: string; who: string }

export interface PlayerWarRoom {
  /** Every panel, in the order it shows. */
  order: PlayerPanelKey[]
  /** Panels switched off. */
  off: PlayerPanelKey[]
  quote: QuoteChoice
  leaders: Leader[]
  /** The priority lists the players may read. None until he picks some. */
  priorityLists: string[]
  /** Whose practice plans show under "Today" — only ones published to the players. */
  planTeams: Team[]
}

const KEYS = PLAYER_PANELS.map((p) => p.key)
const isKey = (v: unknown): v is PlayerPanelKey => typeof v === 'string' && (KEYS as string[]).includes(v)
const text = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '')

export function defaultPlayerWarRoom(): PlayerWarRoom {
  return {
    order: [...KEYS],
    off: [],
    quote: { mode: 'rotate', source: 'all' },
    leaders: [{ id: 'l1', title: 'Captains', who: '', duties: '' }],
    priorityLists: [],
    planTeams: ['varsity', 'jv'],
  }
}

export function readPlayerWarRoom(raw: unknown): PlayerWarRoom {
  const d = defaultPlayerWarRoom()
  let r: Record<string, unknown> = {}
  if (typeof raw === 'string') {
    try {
      r = JSON.parse(raw) as Record<string, unknown>
    } catch {
      return d
    }
  } else if (raw && typeof raw === 'object') {
    r = raw as Record<string, unknown>
  } else {
    return d
  }

  // Every panel once, in the saved order, with any new ones at the end.
  const saved = Array.isArray(r.order) ? r.order.filter(isKey) : []
  const order = [...new Set([...saved, ...KEYS])]
  const off = Array.isArray(r.off) ? [...new Set(r.off.filter(isKey))] : []

  const q = (r.quote ?? {}) as Record<string, unknown>
  const quote: QuoteChoice =
    q.mode === 'pick' && typeof q.quoteId === 'string' && q.quoteId
      ? { mode: 'pick', quoteId: q.quoteId.slice(0, 80) }
      : q.mode === 'custom'
        ? { mode: 'custom', line: text(q.line, 600), who: text(q.who, 120) }
        : { mode: 'rotate', source: typeof q.source === 'string' && q.source ? q.source.slice(0, 80) : 'all' }

  const leaders = (Array.isArray(r.leaders) ? r.leaders : d.leaders).slice(0, 20).map((l, i) => {
    const o = (l ?? {}) as Record<string, unknown>
    return {
      id: typeof o.id === 'string' && o.id ? o.id.slice(0, 40) : `l${i + 1}`,
      title: text(o.title, 60),
      who: text(o.who, 300),
      duties: text(o.duties, 600),
    }
  })

  const priorityLists = Array.isArray(r.priorityLists)
    ? [...new Set(r.priorityLists.filter((x): x is string => typeof x === 'string'))].slice(0, 40)
    : []
  const planTeams = Array.isArray(r.planTeams)
    ? (['varsity', 'jv'] as Team[]).filter((t) => (r.planTeams as unknown[]).includes(t))
    : d.planTeams

  return { order, off, quote, leaders, priorityLists, planTeams }
}

/** The panels that show, in order. */
export function shownPanels(w: PlayerWarRoom): PlayerPanelKey[] {
  return w.order.filter((k) => !w.off.includes(k))
}
