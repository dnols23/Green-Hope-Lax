import { AdminShell } from '@/components/admin/AdminShell'
import { HubSidebar, type HubLink } from '@/components/admin/HubSidebar'
import { HubTour } from '@/components/admin/HubTour'
import { getViewer, canSee } from '@/lib/permissions'
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

/** The modes that belong to one team rather than to the program. */
const TEAM_MODES = new Set(['warroom', 'planner'])

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

  const links: HubLink[] = [
    // A War Room and a planner per team, in the team's own group.
    ...TEAMS.flatMap((t) =>
      modes
        .filter((m) => TEAM_MODES.has(m.key))
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
        label: m.section === 'inventory' && !canSee(viewer, 'inventory') ? 'JV Inventory' : m.label,
        href: m.href,
        icon: m.icon,
        group: 'Program',
      })),
  ]

  return (
    <AdminShell>
      <div className="flex flex-col md:flex-row gap-6 items-start">
        <HubSidebar links={links} />
        <div className="flex-1 min-w-0 w-full">{children}</div>
      </div>
      {/* Shown once, the first time a coach lands in the hub. */}
      <HubTour name={viewer?.name?.split(' ')[0] ?? ''} />
    </AdminShell>
  )
}
