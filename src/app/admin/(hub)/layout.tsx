import { AdminShell } from '@/components/admin/AdminShell'
import { HubSidebar, type HubLink } from '@/components/admin/HubSidebar'
import { getViewer, canSee } from '@/lib/permissions'
import { isPageOn } from '@/lib/pages'

/**
 * The Coaches Hub and the tools that belong to it.
 *
 * Coaching is a different job from running the website: you move between the
 * roster, the evaluations and the film in one sitting, and going through the
 * top menu each time costs two clicks and your place. These pages keep a
 * sidebar of those modes, in whatever order the coach drags them into.
 */
export default async function HubLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer()
  const filmOn = await isPageOn('film-coaches')

  // Only what this coach may actually open — the sidebar is not a menu of doors
  // that 404.
  const all: (HubLink & { show: boolean })[] = [
    { key: 'hub', label: 'Coaches Hub', href: '/admin/hub', icon: '🏠', show: canSee(viewer, 'hub') },
    { key: 'evaluate', label: 'Evaluate', href: '/admin/hub/evaluate', icon: '📝', show: canSee(viewer, 'hub') },
    { key: 'mine', label: 'My evaluations', href: '/admin/hub/mine', icon: '📋', show: canSee(viewer, 'hub') },
    { key: 'board', label: 'Evaluation board', href: '/admin/hub/board', icon: '📊', show: canSee(viewer, 'hub') },
    { key: 'rosters', label: 'Rosters', href: '/admin/rosters', icon: '🥍', show: canSee(viewer, 'rosters') },
    { key: 'schedule', label: 'Schedule', href: '/admin/schedule', icon: '📅', show: canSee(viewer, 'schedule') },
    { key: 'film', label: 'Film Room', href: '/admin/film', icon: '🎬', show: canSee(viewer, 'film') && filmOn },
    {
      key: 'inventory',
      label: canSee(viewer, 'inventory') ? 'Inventory' : 'JV Inventory',
      href: '/admin/inventory',
      icon: '📦',
      show: canSee(viewer, 'inventory') || canSee(viewer, 'inventory-jv'),
    },
  ]
  const links = all.filter((l) => l.show).map(({ show: _show, ...link }) => link)

  return (
    <AdminShell>
      <div className="flex flex-col md:flex-row gap-6 items-start">
        <HubSidebar links={links} />
        <div className="flex-1 min-w-0 w-full">{children}</div>
      </div>
    </AdminShell>
  )
}
