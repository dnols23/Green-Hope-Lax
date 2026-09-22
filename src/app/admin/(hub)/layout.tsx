import { AdminShell } from '@/components/admin/AdminShell'
import { HubSidebar, type HubLink } from '@/components/admin/HubSidebar'
import { HubTour } from '@/components/admin/HubTour'
import { getViewer, canSee, teamsFor } from '@/lib/permissions'
import { isPageOn } from '@/lib/pages'
import { readModesOff } from '@/lib/hubSettings'
import { HUB_MODES, isModeOn } from '@/lib/hubModes'
import { TEAMS, withTeam } from '@/lib/teams'

/**
 * The Coaches Hub and the tools that belong to it.
 *
 * Coaching is a different job from running the website: you move between the
 * plan, the roster, the evaluations and the film in one sitting, and going
 * through the top menu each time costs two clicks and your place. These pages
 * keep a sidebar of those modes, in whatever order the coach drags them into.
 *
 * The sidebar is in three parts. Varsity and JV each get their own War Room and
 * their own planner, because the two staffs plan two different weeks. Everything
 * else — the drill bank, the playboard, the library, the film — is the
 * program's, shared by both, and sits under Program.
 */

/**
 * The modes that belong to one team rather than to the program.
 *
 * Four of them now. A War Room and a planner because the two staffs plan two
 * different weeks; priorities and inventory because what JV noticed on Saturday
 * and what is in the JV bag are not the varsity staff's business — and, more to
 * the point, a shared board is one where things get written in the wrong place.
 */
const TEAM_MODES = new Set(['warroom', 'planner', 'priorities', 'inventory', 'playbook'])

export default async function HubLayout({ children }: { children: React.ReactNode }) {
  const [viewer, filmOn, modesOff] = await Promise.all([getViewer(), isPageOn('film-coaches'), readModesOff()])

  // Two gates, and both have to open: the head coach switched this mode on for
  // the staff, and this coach's own permissions allow the page behind it.
  const modes = HUB_MODES.filter((m) => {
    if (!isModeOn(modesOff, m.key)) return false
    if (m.key === 'film' && !filmOn) return false
    if (m.section === 'inventory') return canSee(viewer, 'inventory') || canSee(viewer, 'inventory-jv')
    return canSee(viewer, m.section)
  })

  /* Inventory is the one mode granted per team rather than per coach: the JV
     grant opens the JV shed and nothing else, so a JV coach counting helmets
     never sees the varsity board at all. */
  const forTeam = (mode: string, team: string) =>
    mode !== 'inventory'
      ? true
      : team === 'jv'
        ? canSee(viewer, 'inventory') || canSee(viewer, 'inventory-jv')
        : canSee(viewer, 'inventory')

  /* Only the sides of the program this coach works on. A JV head coach has no
     varsity group at all rather than a group full of doors that 404. */
  const mine = new Set(teamsFor(viewer))
  const teams = TEAMS.filter((t) => mine.has(t.key))

  const links: HubLink[] = [
    // The War Room, the planner, the priorities and the shed — one of each per
    // team, in the team's own group.
    ...teams.flatMap((t) =>
      modes
        .filter((m) => TEAM_MODES.has(m.key) && forTeam(m.key, t.key))
        .map((m) => ({
          // The key carries the team, or one coach's saved order would move
          // both War Rooms at once.
          key: `${t.key}:${m.key}`,
          label: m.label,
          href: withTeam(m.href, t.key),
          icon: m.icon,
          group: t.label,
        }))
    ),
    ...modes
      .filter((m) => !TEAM_MODES.has(m.key))
      .map((m) => ({
        key: m.key,
        label: m.label,
        href: m.href,
        icon: m.icon,
        group: 'Program',
      })),
  ]

  return (
    <AdminShell>
      <div className="flex flex-col md:flex-row gap-6 items-start">
        <HubSidebar links={links} noFold={teams.length < 2 ? teams.map((t) => t.label) : []} />
        <div className="flex-1 min-w-0 w-full">{children}</div>
      </div>
      {/* Shown once, the first time a coach lands in the hub. */}
      <HubTour name={viewer?.name?.split(' ')[0] ?? ''} />
    </AdminShell>
  )
}
