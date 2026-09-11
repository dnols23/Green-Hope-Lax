// Which coaching modes the hub sidebar carries.
//
// Pure, so the settings screen and the sidebar agree on the list. The head coach
// switches modes off for everyone; what a coach may open is still decided by
// their own permissions.

export const HUB_MODES_KEY = 'hub_modes_off'

export interface HubMode {
  key: string
  label: string
  /** The permission that also has to allow it. */
  section: string
  icon: string
  href: string
  /** Always on — the hub itself can't be switched off from inside the hub. */
  fixed?: boolean
}

export const HUB_MODES: HubMode[] = [
  { key: 'warroom',   label: 'War Room',         section: 'hub',      icon: '🎛', href: '/admin/hub', fixed: true },
  { key: 'planner',   label: 'Planner',          section: 'planner',  icon: '🗒', href: '/admin/planner' },
  { key: 'drills',    label: 'Drill Bank',       section: 'drills',   icon: '📓', href: '/admin/drills' },
  { key: 'team',      label: 'Team Hub',         section: 'team',     icon: '🗣', href: '/admin/team' },
  { key: 'players',   label: 'Players',          section: 'hub',      icon: '🧍', href: '/admin/hub/players' },
  { key: 'evaluate',  label: 'Evaluate',         section: 'hub',      icon: '📝', href: '/admin/hub/evaluate' },
  { key: 'mine',      label: 'My evaluations',   section: 'hub',      icon: '📋', href: '/admin/hub/mine' },
  { key: 'board',     label: 'Evaluation board', section: 'hub',      icon: '📊', href: '/admin/hub/board' },
  { key: 'rosters',   label: 'Rosters',          section: 'rosters',  icon: '🥍', href: '/admin/rosters' },
  { key: 'schedule',  label: 'Schedule',         section: 'schedule', icon: '📅', href: '/admin/schedule' },
  { key: 'film',      label: 'Film Room',        section: 'film',     icon: '🎬', href: '/admin/film' },
  { key: 'inventory', label: 'Inventory',        section: 'inventory',icon: '📦', href: '/admin/inventory' },
]

export const HUB_MODE_KEYS = HUB_MODES.map((m) => m.key)

export function parseModesOff(value: string | null | undefined): string[] {
  if (!value) return []
  try {
    const raw = JSON.parse(value)
    return Array.isArray(raw) ? raw.map(String).filter((k) => HUB_MODE_KEYS.includes(k)) : []
  } catch {
    return []
  }
}

export function isModeOn(off: string[], key: string): boolean {
  const mode = HUB_MODES.find((m) => m.key === key)
  if (mode?.fixed) return true
  return !off.includes(key)
}
