// Pure description of the admin's sections and who may see them.
//
// Deliberately free of server-only imports: the Coach Access form is a client
// component and needs this list to render its checkboxes. Anything that reads
// cookies or the database lives in permissions.ts instead.

export type StaffRole = 'head' | 'assistant'

/** Which heading a section sits under in the admin menu. */
export type SectionGroup = 'Coaches Hub' | 'Team' | 'Content' | 'Admin'

export const SECTION_GROUPS: SectionGroup[] = ['Coaches Hub', 'Team', 'Content', 'Admin']

export interface AdminSection {
  key: string
  label: string
  href: string
  group: SectionGroup
  /** Only the owner may ever open this, no matter what is ticked. */
  ownerOnly?: boolean
  /** Every coach gets this without it being ticked — it's the job. */
  always?: boolean
}

export const SECTIONS: AdminSection[] = [
  { key: 'hub',          label: 'Coaches Hub',  href: '/admin/hub',          group: 'Coaches Hub', always: true },
  { key: 'film',         label: 'Film Room',    href: '/admin/film',         group: 'Coaches Hub', always: true },
  { key: 'planner',      label: 'Planner',      href: '/admin/planner',      group: 'Coaches Hub', always: true },
  { key: 'drills',       label: 'Drill Bank',   href: '/admin/drills',       group: 'Coaches Hub', always: true },
  { key: 'rosters',      label: 'Rosters',      href: '/admin/rosters',      group: 'Coaches Hub', always: true },
  { key: 'inventory',    label: 'Inventory',    href: '/admin/inventory',    group: 'Coaches Hub' },
  { key: 'inventory-jv', label: 'JV Inventory', href: '/admin/inventory',    group: 'Coaches Hub' },
  { key: 'schedule',     label: 'Schedule',     href: '/admin/schedule',     group: 'Coaches Hub' },
  { key: 'team',         label: 'Team Hub',     href: '/admin/team',         group: 'Coaches Hub' },
  { key: 'roster',       label: 'Roster',       href: '/admin/roster',       group: 'Team' },
  { key: 'roster-jv',    label: 'JV Roster',    href: '/admin/roster',       group: 'Team' },
  { key: 'members',      label: 'Members',      href: '/admin/members',      group: 'Team' },
  { key: 'coaches',      label: 'Coaches',      href: '/admin/coaches',      group: 'Team' },
  { key: 'news',         label: 'News',         href: '/admin/news',         group: 'Content' },
  { key: 'awards',       label: 'Awards',       href: '/admin/awards',       group: 'Content' },
  { key: 'record-books', label: 'Record Books', href: '/admin/record-books', group: 'Content' },
  { key: 'shop',         label: 'Shop',         href: '/admin/shop',         group: 'Content' },
  { key: 'pages',        label: 'Pages',        href: '/admin/pages',        group: 'Content' },
  { key: 'submissions',  label: 'Submissions',  href: '/admin/submissions',  group: 'Admin' },
  { key: 'notifications', label: 'Notifications', href: '/admin/notifications', group: 'Admin', ownerOnly: true },
  { key: 'access',       label: 'Coach Access', href: '/admin/access',       group: 'Admin', ownerOnly: true },
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
