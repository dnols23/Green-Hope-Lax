// Pure description of the admin's sections and who may see them.
//
// Deliberately free of server-only imports: the Coach Access form is a client
// component and needs this list to render its checkboxes. Anything that reads
// cookies or the database lives in permissions.ts instead.

export type StaffRole = 'head' | 'assistant'

export interface AdminSection {
  key: string
  label: string
  href: string
  /** Only the owner may ever open this, no matter what is ticked. */
  ownerOnly?: boolean
  /** Every coach gets this without it being ticked — it's the job. */
  always?: boolean
}

export const SECTIONS: AdminSection[] = [
  { key: 'hub',          label: 'Coaches Hub',  href: '/admin/hub',          always: true },
  { key: 'film',         label: 'Film Room',    href: '/team/video',         always: true },
  { key: 'rosters',      label: 'Rosters',      href: '/admin/rosters',      always: true },
  { key: 'team',         label: 'Team Hub',     href: '/admin/team' },
  { key: 'schedule',     label: 'Schedule',     href: '/admin/schedule' },
  { key: 'roster',       label: 'Roster',       href: '/admin/roster' },
  { key: 'roster-jv',    label: 'JV Roster',    href: '/admin/roster' },
  { key: 'inventory',    label: 'Inventory',    href: '/admin/inventory' },
  { key: 'inventory-jv', label: 'JV Inventory', href: '/admin/inventory' },
  { key: 'news',         label: 'News',         href: '/admin/news' },
  { key: 'record-books', label: 'Record Books', href: '/admin/record-books' },
  { key: 'awards',       label: 'Awards',       href: '/admin/awards' },
  { key: 'coaches',      label: 'Coaches',      href: '/admin/coaches' },
  { key: 'members',      label: 'Members',      href: '/admin/members' },
  { key: 'submissions',  label: 'Submissions',  href: '/admin/submissions' },
  { key: 'shop',         label: 'Shop',         href: '/admin/shop' },
  { key: 'pages',        label: 'Pages',        href: '/admin/pages' },
  { key: 'access',       label: 'Coach Access', href: '/admin/access', ownerOnly: true },
]

/** Sections an owner can hand out — everything a coach doesn't already have. */
export const GRANTABLE = SECTIONS.filter((s) => !s.always && !s.ownerOnly)

export interface Viewer {
  email: string
  name: string
  role: StaffRole
  isOwner: boolean
  permissions: string[]
  /** True when no owner row exists yet, so this user is standing in as one. */
  bootstrap: boolean
}

export function canSee(viewer: Viewer | null, key: string): boolean {
  if (!viewer) return false
  const section = SECTIONS.find((s) => s.key === key)
  if (!section) return false
  if (section.ownerOnly) return viewer.isOwner
  if (viewer.isOwner) return true
  if (section.always) return true
  return viewer.permissions.includes(key)
}

/**
 * Sections to show this viewer in the nav, in SECTIONS order.
 *
 * A JV-scoped section points at the same page as its full-team counterpart, so
 * someone holding both would otherwise get the link twice. SECTIONS lists the
 * broader one first, so keeping the first entry per page shows "Roster" to the
 * head coach and "JV Roster" to the JV coach.
 */
export function visibleSections(viewer: Viewer | null): AdminSection[] {
  const seen = new Set<string>()
  return SECTIONS.filter((s) => {
    if (!canSee(viewer, s.key)) return false
    if (seen.has(s.href)) return false
    seen.add(s.href)
    return true
  })
}

/**
 * A page reachable by either a full-team or a JV-only grant. Returns which one
 * applies, so the page can lock a JV coach to their own team.
 */
export function teamScope(
  viewer: Viewer | null,
  fullKey: string,
  jvKey: string
): 'none' | 'jv' | 'all' {
  if (canSee(viewer, fullKey)) return 'all'
  if (canSee(viewer, jvKey)) return 'jv'
  return 'none'
}
