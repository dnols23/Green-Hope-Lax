import { HubTabs } from '@/components/admin/HubTabs'

/** The Drill Bank's two halves: the drills, and the routines built from them. */
export function DrillTabs({ active }: { active: 'drills' | 'progressions' }) {
  return (
    <HubTabs
      title="Drill Bank"
      active={active}
      tabs={[
        { key: 'drills', label: 'Drills', icon: '📓', href: '/admin/drills' },
        { key: 'progressions', label: 'Positional Progressions', icon: '🪜', href: '/admin/drills/progressions' },
      ]}
    />
  )
}
