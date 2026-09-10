import { AdminShell } from '@/components/admin/AdminShell'
import { HubSidebar } from '@/components/admin/HubSidebar'
import { getViewer, canSee } from '@/lib/permissions'
import { isPageOn } from '@/lib/pages'
import { readModesOff } from '@/lib/hubSettings'
import { HUB_MODES, isModeOn } from '@/lib/hubModes'

/**
 * The Coaches Hub and the tools that belong to it.
 *
 * Coaching is a different job from running the website: you move between the
 * plan, the roster, the evaluations and the film in one sitting, and going
 * through the top menu each time costs two clicks and your place. These pages
 * keep a sidebar of those modes, in whatever order the coach drags them into.
 */
export default async function HubLayout({ children }: { children: React.ReactNode }) {
  const [viewer, filmOn, modesOff] = await Promise.all([getViewer(), isPageOn('film-coaches'), readModesOff()])

  // Two gates, and both have to open: the head coach switched this mode on for
  // the staff, and this coach's own permissions allow the page behind it.
  const links = HUB_MODES.filter((m) => {
    if (!isModeOn(modesOff, m.key)) return false
    if (m.key === 'film' && !filmOn) return false
    if (m.section === 'inventory') return canSee(viewer, 'inventory') || canSee(viewer, 'inventory-jv')
    return canSee(viewer, m.section)
  }).map((m) => ({
    key: m.key,
    label:
      m.section === 'inventory' && !canSee(viewer, 'inventory') ? 'JV Inventory' : m.label,
    href: m.href,
    icon: m.icon,
  }))

  return (
    <AdminShell>
      <div className="flex flex-col md:flex-row gap-6 items-start">
        <HubSidebar links={links} />
        <div className="flex-1 min-w-0 w-full">{children}</div>
      </div>
    </AdminShell>
  )
}
