// Pure description of the admin's sections and who may see them.
//
// Deliberately free of server-only imports: the Coach Access form is a client
// component and needs this list to render its checkboxes. Anything that reads
// cookies or the database lives in permissions.ts instead.

import { DEFAULT_TEAM, TEAMS, isTeam, type Team } from './teams'

/**
 * What the coach actually is.
 *
 * Not an evaluation setting — the job. It decides which walk-round he gets the
 * first time he signs in, what the War Room calls him, and whether he may
 * delete somebody else's evaluation.
 */
export type StaffRole = 'head' | 'jv-head' | 'assistant'

export const STAFF_ROLES: { key: StaffRole; label: string; hint: string }[] = [
  { key: 'head', label: 'Head coach', hint: 'Runs the program.' },
  { key: 'jv-head', label: 'JV head coach', hint: 'Runs the JV team.' },
  { key: 'assistant', label: 'Assistant', hint: 'Coaches a group.' },
]

export function isStaffRole(v: unknown): v is StaffRole {
  return v === 'head' || v === 'jv-head' || v === 'assistant'
}

/** Runs a team, either of them. */
export function runsATeam(role: StaffRole): boolean {
  return role === 'head' || role === 'jv-head'
}

/**
 * Which side of the program a coach works on.
 *
 * Separate from the tick-boxes, and deliberately so. The tick-boxes answer
 * "which pages", and the answer for a JV head coach is most of them — he runs
 * a team. This answers "whose", and for him the answer is JV: the JV shed, the
 * JV schedule, the JV week, and no way into the varsity ones. One switch, set
 * once, rather than a JV twin of every page.
 */
export type StaffTeam = 'all' | 'varsity' | 'jv'

export const STAFF_TEAMS: { key: StaffTeam; label: string; hint: string }[] = [
  { key: 'all', label: 'Both teams', hint: 'Works across varsity and JV.' },
  { key: 'varsity', label: 'Varsity only', hint: 'Cannot open or change anything JV.' },
  { key: 'jv', label: 'JV only', hint: 'Cannot open or change anything varsity.' },
]

export function isStaffTeam(value: unknown): value is StaffTeam {
  return value === 'all' || value === 'varsity' || value === 'jv'
}

/** Which heading a section sits under in the admin menu. */
export type SectionGroup = 'Coaches Hub' | 'Team' | 'Content' | 'Admin'

export const SECTION_GROUPS: SectionGroup[] = ['Coaches Hub', 'Team', 'Content', 'Admin']

/**
 * Who else can see what this page produces, and where they see it.
 *
 * A coach building a page should not have to guess how it lands for a parent
 * or a player — or open a private window to find out. Each audience listed
 * here becomes a button in the admin bar on that page.
 */
export type Audience = 'public' | 'team' | 'player' | 'parent' | 'coach'

export const AUDIENCE_LABELS: Record<Audience, string> = {
  public: 'Public view',
  team: 'Team view',
  player: 'Player view',
  parent: 'Parent view',
  coach: 'Coach view',
}

export interface SectionView {
  audience: Audience
  href: string
}

export interface AdminSection {
  key: string
  label: string
  href: string
  group: SectionGroup
  /** Only the owner may ever open this, no matter what is ticked. */
  ownerOnly?: boolean
  /** Every coach gets this without it being ticked — it's the job. */
  always?: boolean
  /**
   * Kept out of the admin menu even for whoever can see it. For a page that
   * belongs to one place — the Coaches Hub sidebar — and would only be noise
   * repeated in the panel nav.
   */
  hidden?: boolean
  /** The same content, seen by everyone else who can see it. */
  views?: SectionView[]
}

export const SECTIONS: AdminSection[] = [
  { key: 'hub',          label: 'Coaches Hub',  href: '/admin/hub',          group: 'Coaches Hub', always: true },
  { key: 'film',         label: 'Film Room',    href: '/admin/film',         group: 'Coaches Hub', always: true },
  { key: 'planner',      label: 'Planner',      href: '/admin/planner',      group: 'Coaches Hub', always: true,
    views: [{ audience: 'coach', href: '/admin/hub' }, { audience: 'team', href: '/team' }] },
  { key: 'drills',       label: 'Drill Bank',   href: '/admin/drills',       group: 'Coaches Hub', always: true },
  { key: 'playboard',    label: 'Playboard',    href: '/admin/playboard',    group: 'Coaches Hub', always: true },
  { key: 'library',      label: 'Library',      href: '/admin/library',      group: 'Coaches Hub', always: true },
  // The calendar. Every coach reads it and sets his own availability on it;
  // who may put events on it is decided per team in calendarData.mayPostTo.
  { key: 'calendar',     label: 'Calendar',     href: '/admin/calendar',     group: 'Coaches Hub', always: true },
  // The deck of what we actually run. Every coach may read it once the head
  // coach publishes it; only he ever writes it, which the pages enforce.
  { key: 'playbook',     label: 'Playbook',     href: '/admin/playbook',     group: 'Coaches Hub', always: true, hidden: true },
  { key: 'priorities',   label: 'Priorities',   href: '/admin/priorities',   group: 'Coaches Hub', always: true },
  { key: 'rosters',      label: 'Rosters',      href: '/admin/rosters',      group: 'Coaches Hub', always: true,
    views: [{ audience: 'public', href: '/roster' }] },
  // The head coach's review of his own staff. Lives only in the hub sidebar.
  { key: 'coach-reviews', label: 'Coach Reviews', href: '/admin/coach-reviews', group: 'Coaches Hub',
    ownerOnly: true, hidden: true },
  { key: 'inventory',    label: 'Inventory',    href: '/admin/inventory',    group: 'Coaches Hub' },
  { key: 'inventory-jv', label: 'JV Inventory', href: '/admin/inventory',    group: 'Coaches Hub' },
  { key: 'schedule',     label: 'Schedule',     href: '/admin/schedule',     group: 'Coaches Hub',
    views: [{ audience: 'public', href: '/schedule' }, { audience: 'team', href: '/team' }] },
  { key: 'team',         label: 'Team Hub',     href: '/admin/team',         group: 'Coaches Hub',
    views: [{ audience: 'team', href: '/team' }] },
  { key: 'roster',       label: 'Roster',       href: '/admin/roster',       group: 'Team',
    views: [{ audience: 'public', href: '/roster' }] },
  { key: 'roster-jv',    label: 'JV Roster',    href: '/admin/roster',       group: 'Team',
    views: [{ audience: 'public', href: '/roster' }] },
  { key: 'parents',      label: 'Parent Hub',   href: '/admin/parents',      group: 'Team',
    views: [{ audience: 'parent', href: '/parents' }] },
  { key: 'members',      label: 'Members',      href: '/admin/members',      group: 'Team' },
  { key: 'coaches',      label: 'Coaches',      href: '/admin/coaches',      group: 'Team',
    views: [{ audience: 'public', href: '/coaches' }] },
  { key: 'news',         label: 'News',         href: '/admin/news',         group: 'Content',
    views: [{ audience: 'public', href: '/news' }] },
  { key: 'awards',       label: 'Awards',       href: '/admin/awards',       group: 'Content',
    views: [{ audience: 'public', href: '/awards' }] },
  { key: 'record-books', label: 'Record Books', href: '/admin/record-books', group: 'Content',
    views: [{ audience: 'public', href: '/record-books' }] },
  { key: 'shop',         label: 'Shop',         href: '/admin/shop',         group: 'Content',
    views: [{ audience: 'public', href: '/shop' }] },
  { key: 'pages',        label: 'Pages',        href: '/admin/pages',        group: 'Content',
    views: [{ audience: 'public', href: '/' }] },
  { key: 'submissions',  label: 'Submissions',  href: '/admin/submissions',  group: 'Admin' },
  { key: 'dashboard',    label: 'Dashboard',    href: '/admin/dashboard',    group: 'Admin', ownerOnly: true },
  { key: 'notifications', label: 'Notifications', href: '/admin/notifications', group: 'Admin', ownerOnly: true },
  { key: 'signin',       label: 'Sign-in',      href: '/admin/signin',       group: 'Admin', ownerOnly: true },
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
  /** Varsity, JV, or both. The owner runs the program, so always both. */
  team: StaffTeam
  /** True when no owner row exists yet, so this user is standing in as one. */
  bootstrap: boolean
}

/** The teams this viewer may work in, in sidebar order. */
export function teamsFor(viewer: Viewer | null): Team[] {
  if (!viewer) return []
  if (viewer.isOwner || viewer.team === 'all') return TEAMS.map((t) => t.key)
  return TEAMS.map((t) => t.key).filter((t) => t === viewer.team)
}

export function canTeam(viewer: Viewer | null, team: Team): boolean {
  return teamsFor(viewer).includes(team)
}

/**
 * The team a page should open on, given what the URL asked for.
 *
 * Every coach can look at either side of the program — a JV coach should be
 * able to see what varsity is running, and often has to. What his team setting
 * decides is what he can *change*, which is canTeam() and is checked on every
 * write rather than by hiding the door.
 */
export function teamFor(_viewer: Viewer | null, asked: unknown): Team {
  return isTeam(asked) ? asked : DEFAULT_TEAM
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
    if (s.hidden) return false
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
  // A coach kept to JV is kept to JV whichever of the two grants he holds.
  const jvOnly = !!viewer && !viewer.isOwner && viewer.team === 'jv'
  if (canSee(viewer, fullKey)) return jvOnly ? 'jv' : 'all'
  if (canSee(viewer, jvKey)) return 'jv'
  return 'none'
}
