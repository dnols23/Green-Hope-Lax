import { getViewer } from '@/lib/permissions'
import { canSee } from '@/lib/sections'
import { HubTabs, type HubTab } from './HubTabs'

/**
 * Roster is one place: the rosters themselves, every player, and the depth
 * chart built from them. A coach sees the tabs his access allows.
 */
export async function RosterTabs({ active }: { active: 'rosters' | 'players' | 'depth' }) {
  const viewer = await getViewer()
  const tabs: HubTab[] = [
    ...(canSee(viewer, 'rosters') ? [{ key: 'rosters', label: 'Rosters', icon: '🥍', href: '/admin/rosters' }] : []),
    ...(canSee(viewer, 'hub') ? [{ key: 'players', label: 'Players', icon: '🧍', href: '/admin/hub/players' }] : []),
    ...(canSee(viewer, 'depth') ? [{ key: 'depth', label: 'Depth Chart', icon: '📶', href: '/admin/depth' }] : []),
  ]
  return <HubTabs title="Roster" tabs={tabs} active={active} />
}
