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

export interface Drill {
  id: string
  name: string
  category: string
  /** Defaults to 'team' — a drill nobody has vouched for is never homework. */
  setting: DrillSetting
  minutes: number
  description: string | null
  link: string | null
  link_label: string | null
  equipment: string | null
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
