/**
 * The priority scale, and the shape of a list.
 *
 * Kept apart from the database side so the sideline UI — a slider and a chip on
 * a phone — can import it without dragging a server client into the browser.
 */

/**
 * Four levels, not five.
 *
 * Each one is a colour from the site's status set and, always, its own name —
 * a colour on its own is not allowed to carry the meaning, because the amber
 * does not clear the contrast a phone in the sun needs. Four names a coach
 * would actually say beats five that blur into each other.
 */
export const PRIORITY_LEVELS: { level: number; label: string; color: string; blurb: string }[] = [
  { level: 1, label: 'Later', color: '#0ca30c', blurb: 'Worth doing. Not this week.' },
  { level: 2, label: 'Soon',  color: '#fab219', blurb: 'On the plan in the next week or two.' },
  { level: 3, label: 'High',  color: '#ec835a', blurb: 'On the next plan.' },
  { level: 4, label: 'Now',   color: '#d03b3b', blurb: 'It cost us a goal. Fix it at the next practice.' },
]

export const DEFAULT_LEVEL = 2

export function levelOf(level: number) {
  return PRIORITY_LEVELS.find((l) => l.level === level) ?? PRIORITY_LEVELS[DEFAULT_LEVEL - 1]
}

/** Keep a stored number inside the scale, whatever it says. */
export function clampLevel(raw: unknown): number {
  const n = Math.round(Number(raw))
  if (!Number.isFinite(n)) return DEFAULT_LEVEL
  return Math.min(PRIORITY_LEVELS.length, Math.max(1, n))
}

export interface PriorityItem {
  id: string
  listId: string
  body: string
  level: number
  done: boolean
  note: string | null
  createdBy: string | null
  createdAt: string
  /** Its place on the list, as the staff ordered it. Null until 0041 is run. */
  sortOrder: number | null
}

export interface PriorityList {
  id: string
  name: string
  sortOrder: number
  items: PriorityItem[]
}


/**
 * The positions, as the lists are named — so a dropdown can put the positions
 * together and the groups (leadership, man up, culture…) after them.
 */
const POSITION_NAMES = ['attack', 'midfield', 'faceoff', 'defense', 'lsm', 'ssdm', 'goalie', 'offense']

export function isPositionList(name: string): boolean {
  return POSITION_NAMES.includes(name.toLowerCase().replace(/[^a-z]/g, ''))
}

/** Open items first in the order the staff put them, then what is done. */
export function byPlace(a: PriorityItem, b: PriorityItem): number {
  return (
    Number(a.done) - Number(b.done) ||
    (a.sortOrder ?? Number.POSITIVE_INFINITY) - (b.sortOrder ?? Number.POSITIVE_INFINITY) ||
    b.level - a.level ||
    a.createdAt.localeCompare(b.createdAt)
  )
}
