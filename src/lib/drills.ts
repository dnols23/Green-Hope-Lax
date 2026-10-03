import type { Board } from './planner'
import type { SavedComp } from './compete'
import { boardItemCount } from './board'

// The drill bank.
//
// Pure: the bank screen, the planner's drill picker and the server all describe
// a drill the same way.

export interface DrillCategory {
  key: string
  label: string
  /** The planner block tag a drill of this kind usually lands under. */
  tag: string
  icon: string
}

export const DRILL_CATEGORIES: DrillCategory[] = [
  { key: 'warmup',          label: 'Warm-ups',            tag: 'warmup',       icon: '🔥' },
  { key: 'stickwork',       label: 'Passing & stick work',tag: 'individual',   icon: '🥍' },
  { key: 'groundballs',     label: 'Ground balls',        tag: 'individual',   icon: '⚪' },
  { key: 'footwork',        label: 'Footwork & agility',  tag: 'individual',   icon: '👟' },
  { key: 'dodging',         label: 'Dodging',             tag: 'individual',   icon: '🏃' },
  { key: 'shooting',        label: 'Shooting',            tag: 'individual',   icon: '🎯' },
  { key: 'offense',         label: 'Offense & sets',      tag: 'team',         icon: '⚔️' },
  { key: 'specialoffense',  label: 'Man-up / EMO',        tag: 'specials',     icon: '➕' },
  { key: 'defense',         label: 'Team defense',        tag: 'team',         icon: '🛡' },
  { key: 'individualdefense',label: 'Individual defense', tag: 'individual',   icon: '🧱' },
  { key: 'dmid',            label: 'D-mids & poles',      tag: 'unit',         icon: '🪝' },
  { key: 'transition',      label: 'Transition',          tag: 'team',         icon: '↔️' },
  { key: 'ridecrear',       label: 'Riding & clearing',   tag: 'team',         icon: '🔁' },
  { key: 'sixes',           label: '6v6 & skeleton',      tag: 'team',         icon: '🔷' },
  { key: 'mandown',         label: 'Man-down',            tag: 'specials',     icon: '➖' },
  { key: 'faceoff',         label: 'Face-off',            tag: 'specials',     icon: '⚡' },
  { key: 'goalie',          label: 'Goalie',              tag: 'individual',   icon: '🧤' },
  { key: 'conditioning',    label: 'Conditioning',        tag: 'conditioning', icon: '💨' },
  { key: 'strength',        label: 'Strength & speed',    tag: 'conditioning', icon: '🏋️' },
  { key: 'mental',          label: 'Mental',              tag: 'install',      icon: '🧠' },
  { key: 'leadership',      label: 'Leadership & culture',tag: 'install',      icon: '🫱' },
  { key: 'tryouts',         label: 'Tryouts',             tag: 'install',      icon: '📋' },
  { key: 'planning',        label: 'Coaching & planning', tag: 'install',      icon: '📖' },
  { key: 'fun',             label: 'Fun',                 tag: 'warmup',       icon: '🎉' },
]

export function categoryFor(key: string | null | undefined): DrillCategory {
  return DRILL_CATEGORIES.find((c) => c.key === key) ?? DRILL_CATEGORIES[1]
}

/** Where a drill can actually be done — the thing that decides whether it can
 *  be a player's homework or only a practice rep. */
export type DrillSetting = 'wall' | 'solo' | 'partner' | 'team' | 'film'

export const SETTING_LABELS: Record<DrillSetting, string> = {
  wall: 'Wall',
  solo: 'On your own',
  partner: 'With a friend',
  team: 'At practice',
  film: 'Watch it',
}

/** The settings a player can do away from practice. */
export const HOMEWORK_SETTINGS: DrillSetting[] = ['wall', 'solo', 'partner']

export function isHomework(setting: string | null | undefined): boolean {
  return HOMEWORK_SETTINGS.includes(String(setting) as DrillSetting)
}

export const DRILL_SETTINGS = Object.keys(SETTING_LABELS) as DrillSetting[]
export const isDrillSetting = (v: unknown): v is DrillSetting => DRILL_SETTINGS.includes(v as DrillSetting)

/** A drill a player can be sent home with: any of its places is one he can do alone. */
export const drillIsHomework = (d: Pick<Drill, 'settings'>) => d.settings.some(isHomework)

/** The one place a set of places is filed under: the first take-home one, else the first. */
export const primarySetting = (list: DrillSetting[]): DrillSetting => list.find(isHomework) ?? list[0] ?? 'team'

export interface Drill {
  id: string
  name: string
  category: string
  /** Defaults to 'team' — a drill nobody has vouched for is never homework. */
  setting: DrillSetting
  /** Every place it can be done (0051), as the coaches tick them — none until they do. `setting` is the first take-home one. */
  settings: DrillSetting[]
  minutes: number
  description: string | null
  /** How you set it up: cones, lines, balls, where the goalie stands. */
  setup: string | null
  /** Why we run it and what good looks like — what a coach needs to coach it. */
  context: string | null
  link: string | null
  link_label: string | null
  equipment: string | null
  /** Ways to change it up: harder, easier, live, weak hand (0054). */
  variations: string | null
  /** The drill drawn on the field (0048); null until someone draws it. */
  board: Board | null
  /** Competitions kept because they worked (0049). */
  competitions: SavedComp[]
  is_favorite: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

/**
 * Read a pasted list of drills: one per line, `Name | category | minutes | link`.
 *
 * Only the name is required — a plain list of drill names is a perfectly good
 * paste, and the category can be fixed afterwards in the bank.
 */
export interface ParsedDrill {
  name: string
  category: string
  minutes: number
  link: string | null
}

export function parseDrillPaste(raw: string, fallbackCategory = 'stickwork'): ParsedDrill[] {
  const out: ParsedDrill[] = []
  for (const line of String(raw || '').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const cells = (trimmed.includes('\t') ? trimmed.split('\t') : trimmed.split('|')).map((c) => c.trim())
    const name = cells[0]
    if (!name || /^(name|drill)$/i.test(name)) continue

    let category = fallbackCategory
    let minutes = 10
    let link: string | null = null
    for (const cell of cells.slice(1)) {
      if (!cell) continue
      if (/^https?:\/\//i.test(cell)) { link = cell; continue }
      if (/^\d{1,3}$/.test(cell)) { minutes = Number(cell); continue }
      const match = DRILL_CATEGORIES.find(
        (c) => c.key === cell.toLowerCase() || c.label.toLowerCase() === cell.toLowerCase()
      )
      if (match) category = match.key
    }
    out.push({ name, category, minutes, link })
  }
  return out
}

// ── How the bank is laid out ────────────────────────────────────────────────

/** The staff's order for the bank's groups, kept in app_settings. No SQL. */
export const DRILL_ORDER_KEY = 'drill_category_order'

/** "Recent": the drills the latest plans used. It moves with the categories. */
export const RECENT_GROUP: DrillCategory = { key: 'recent', label: 'Recent', tag: 'individual', icon: '🕘' }

/** "Favorites": every starred drill in one place. It moves with the categories too. */
export const FAVORITES_GROUP: DrillCategory = { key: 'favorites', label: 'Favorites', tag: 'individual', icon: '⭐' }

/** Groups that repeat drills filed elsewhere — not categories of their own. */
export const isShortcutGroup = (key: string) => key === 'recent' || key === 'favorites'

/** Every group in the staff's order: the saved ones first, anything new after. */
export function orderGroups(saved: unknown): DrillCategory[] {
  const all = [FAVORITES_GROUP, RECENT_GROUP, ...DRILL_CATEGORIES]
  const keys = Array.isArray(saved) ? saved.filter((k): k is string => typeof k === 'string') : []
  const picked = [...new Set(keys)].map((k) => all.find((c) => c.key === k)).filter((c): c is DrillCategory => !!c)
  return [...picked, ...all.filter((c) => !picked.includes(c))]
}

/** Written up: a video, a diagram, or any of setup / how it runs / why. */
export function drillHasDetails(d: Pick<Drill, 'link' | 'description' | 'setup' | 'context' | 'board'> & { variations?: string | null }): boolean {
  return !!(d.link?.trim() || d.description?.trim() || d.setup?.trim() || d.context?.trim() || d.variations?.trim() || (d.board && boardItemCount(d.board) > 0))
}

/** Written-up drills first, then favourites, then by name. */
export function sortDrills<T extends Drill>(list: T[]): T[] {
  return [...list].sort(
    (a, b) =>
      Number(drillHasDetails(b)) - Number(drillHasDetails(a)) ||
      Number(b.is_favorite) - Number(a.is_favorite) ||
      a.name.localeCompare(b.name),
  )
}
