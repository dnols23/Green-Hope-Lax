import Link from 'next/link'
import { HubTabs } from '@/components/admin/HubTabs'
import { TEAMS, withTeam, type Team } from '@/lib/teams'

export type StatsTab = 'games' | 'analysis' | 'report'

/**
 * The Stats pages' tabs — Games (track, box scores), Analysis, Report — and
 * the Varsity/JV switch, which keeps you on the same tab and filter.
 */
export function StatsTabs({
  team,
  active,
  query = '',
}: {
  team: Team
  active: StatsTab | null
  /** Extra query (e.g. "filter=last5") carried onto the tabs and the team switch. */
  query?: string
}) {
  const href = (path: string, t: Team = team) => withTeam(query ? `${path}?${query}` : path, t)
  const here = active === 'analysis' ? '/admin/stats/analysis' : active === 'report' ? '/admin/stats/report' : '/admin/stats'
  return (
    <div className="flex items-start justify-between gap-3 flex-wrap">
      <HubTabs
        title="Stats"
        active={active ?? ''}
        tabs={[
          { key: 'games', label: 'Games', icon: '🥍', href: href('/admin/stats') },
          { key: 'analysis', label: 'Analysis', icon: '📈', href: href('/admin/stats/analysis') },
          { key: 'report', label: 'Report', icon: '🖨', href: href('/admin/stats/report') },
        ]}
      />
      <nav className="inline-flex rounded-full border p-0.5 bg-white mt-5" style={{ borderColor: 'var(--border)' }} aria-label="Team">
        {TEAMS.map((t) => {
          const on = t.key === team
          return (
            <Link
              key={t.key}
              href={href(here, t.key)}
              aria-current={on ? 'page' : undefined}
              className={`px-3 min-h-8 inline-flex items-center rounded-full text-xs font-black uppercase tracking-wide ${
                on ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              {t.label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
