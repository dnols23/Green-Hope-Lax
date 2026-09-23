// The small things every calendar view agrees on.
//
// Pure and client-safe: the grid, the month, the year, the agenda and the two
// dialogs all need the same answers to "what is this, what colour is it, which
// layer does it belong to, how do I write its time in four characters", and
// asking one file keeps the week view and the agenda from drifting apart.

import {
  CAL_EVENT_KINDS,
  CAL_TEAMS,
  audienceLabel,
  type Availability,
  type CalAudience,
  type CalItem,
  type CalTeam,
} from '@/lib/calendarModel'

/** What GET /api/calendar hands back. */
export interface CalPayload {
  ready: boolean
  items: CalItem[]
  myAvailability: Availability[]
  canPost: CalTeam[]
  me: { email: string; name: string; isOwner: boolean }
}

// ── The time grid's scale ───────────────────────────────────────────────────

/** One hour is 48px tall: a 4–6 practice is a block you can read and grab. */
export const HOUR_PX = 48
export const MIN_PX = HOUR_PX / 60
/** Where the day and week views open, so the morning is in view, not 2 AM. */
export const SCROLL_TO_HOUR = 7

// ── Layers ──────────────────────────────────────────────────────────────────

/**
 * The four things a coach may want to switch off. They double as the legend,
 * so each carries the colour it is drawn in.
 */
export type CalLayer = 'games' | 'practices' | 'events' | 'availability'

export const CAL_LAYERS: { key: CalLayer; label: string; color: string }[] = [
  { key: 'games', label: 'Games', color: '#7A1F2B' },
  { key: 'practices', label: 'Practices', color: '#00693E' },
  { key: 'events', label: 'Events', color: '#2a78d6' },
  { key: 'availability', label: 'Availability', color: '#e0a3aa' },
]

export function layerOf(item: Pick<CalItem, 'source'>): CalLayer {
  switch (item.source) {
    case 'game':
      return 'games'
    case 'practice':
      return 'practices'
    case 'availability':
      return 'availability'
    default:
      return 'events'
  }
}

export const isAvailability = (item: Pick<CalItem, 'source'>) => item.source === 'availability'

// ── Words ───────────────────────────────────────────────────────────────────

export function teamLabel(team: CalTeam): string {
  return CAL_TEAMS.find((t) => t.key === team)?.label ?? 'Program'
}

/** The icon and word for what an item is — "🥍 Practice", "🏟 Game", "⛔ Out". */
export function kindMeta(item: Pick<CalItem, 'source' | 'kind'>): { icon: string; label: string } {
  if (item.source === 'game') return { icon: '🏟', label: 'Game' }
  if (item.source === 'practice') return { icon: '📋', label: 'Practice plan' }
  if (item.source === 'availability') {
    return item.kind === 'available' ? { icon: '✅', label: 'Available' } : { icon: '⛔', label: 'Out' }
  }
  const k = CAL_EVENT_KINDS.find((x) => x.key === item.kind)
  return k ? { icon: k.icon, label: k.label } : { icon: '📌', label: 'Event' }
}

/**
 * Who can see it, in the words the editor used. Games keep their own audience
 * in the schedule, and a game shown to "the team" has always meant the players
 * and their parents both.
 */
export function whoSees(item: Pick<CalItem, 'source' | 'audience'>): string {
  if (item.source === 'availability') return 'Coaches only'
  if (item.source === 'game' && item.audience === 'team') return 'Coaches, players & parents'
  return audienceLabel(item.audience)
}

/** A short badge for the audience, for rows with no room for a sentence. */
export function audienceShort(a: CalAudience): string {
  switch (a) {
    case 'coaches':
      return 'Coaches'
    case 'team':
      return 'Players'
    case 'parents':
      return 'Parents'
    default:
      return 'Everyone'
  }
}

/** The audience badge for an agenda row. A game's "team" reaches the parents too. */
export function audienceBadge(item: Pick<CalItem, 'source' | 'audience'>): string {
  if (item.source === 'availability') return 'Coaches'
  if (item.source === 'game' && item.audience === 'team') return 'Players & parents'
  return audienceShort(item.audience)
}

/** The badge colours for each audience — quiet for staff-only, louder the wider it goes. */
export const AUDIENCE_TONE: Record<CalAudience, { bg: string; fg: string }> = {
  coaches: { bg: '#f3f4f6', fg: '#374151' },
  team: { bg: '#e6f2ec', fg: '#00512F' },
  parents: { bg: '#f3eefe', fg: '#4a3aa7' },
  public: { bg: '#fdf2e0', fg: '#8a5a00' },
}

/** "4p", "4:30p", "12p" — what fits in front of a title in a month cell. */
export function shortTime(d: Date): string {
  const h = d.getHours()
  const m = d.getMinutes()
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}${m ? `:${String(m).padStart(2, '0')}` : ''}${h < 12 ? 'a' : 'p'}`
}

/**
 * The name a coach goes by on a crowded line: the surname. "Out: Rutledge,
 * Little" fits in a week column; two full names do not.
 */
export function surname(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return parts.length ? parts[parts.length - 1] : name
}

/** A coach's surname for a crowded line, falling back to the email's first half. */
export function coachLabel(item: Pick<CalItem, 'coachName' | 'coachEmail'>): string {
  const name = (item.coachName ?? '').trim()
  return name ? surname(name) : (item.coachEmail ?? '').split('@')[0] || 'Coach'
}

/** Title-ish text for an item, with the coach's name for an availability block. */
export function itemTitle(item: CalItem): string {
  if (item.source !== 'availability') return item.title || 'Untitled'
  const who = item.coachName || (item.coachEmail ?? '').split('@')[0] || 'A coach'
  return item.kind === 'available' ? `${who} — available` : `${who} — out`
}

/**
 * The title as the grid shows it: JV's things say so, since both squads share
 * the week and a JV practice looks just like a varsity one otherwise. Left
 * alone when the title already says JV.
 */
export function gridTitle(item: CalItem): string {
  const t = itemTitle(item)
  return item.team === 'jv' && !/\bJV\b/i.test(t) ? `JV · ${t}` : t
}

/** Local YYYY-MM-DD — a day's key in lookups. */
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
