import { HubTabs } from '@/components/admin/HubTabs'

export type ContentTab = 'board' | 'calendar' | 'series' | 'media' | 'playbook'

/** The Content Studio's pages, across the top of each. */
export function ContentTabs({ active }: { active: ContentTab | null }) {
  return (
    <HubTabs
      title="Instagram · @ghlacrosse"
      active={active ?? ''}
      tabs={[
        { key: 'board', label: 'Board', icon: '🗂', href: '/admin/content' },
        { key: 'calendar', label: 'Calendar', icon: '📅', href: '/admin/content/calendar' },
        { key: 'series', label: 'Series & Voices', icon: '🎬', href: '/admin/content/series' },
        { key: 'media', label: 'Media Releases', icon: '✅', href: '/admin/content/media' },
        { key: 'playbook', label: 'Process', icon: '📋', href: '/admin/content/playbook' },
      ]}
    />
  )
}
