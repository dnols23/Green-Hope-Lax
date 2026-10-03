import { HubTabs } from '@/components/admin/HubTabs'

/**
 * Evaluations is one place with three views: score a player, what you've
 * filed, and every coach's scores side by side.
 */
export function EvalTabs({ active }: { active: 'evaluate' | 'mine' | 'board' }) {
  return (
    <HubTabs
      title="Evaluations"
      active={active}
      tabs={[
        { key: 'evaluate', label: 'Evaluate', icon: '📝', href: '/admin/hub/evaluate' },
        { key: 'mine', label: 'Mine', icon: '📋', href: '/admin/hub/mine' },
        { key: 'board', label: 'Board', icon: '📊', href: '/admin/hub/board' },
      ]}
    />
  )
}
