'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { GAME_FILTERS, type GameFilter } from '@/lib/stats'
import { withTeam, type Team } from '@/lib/teams'
import { isMetricKey } from './analysis'

/**
 * Which games the page looks at, as links: the stretch is in the address, so
 * it can be bookmarked or sent. Client-side only so each link carries the
 * number picked for the trend (which changes without a page load) across.
 */
export function FilterChips({ team, filter }: { team: Team; filter: GameFilter }) {
  const params = useSearchParams()
  const metric = params.get('metric')
  const href = (f: GameFilter) => {
    const q = new URLSearchParams()
    if (f !== 'all') q.set('filter', f)
    if (isMetricKey(metric) && metric !== 'shooting') q.set('metric', metric)
    const season = params.get('season')
    if (season && /^\d{4}$/.test(season)) q.set('season', season)
    const qs = q.toString()
    return withTeam(`/admin/stats/analysis${qs ? `?${qs}` : ''}`, team)
  }
  return (
    <nav className="flex flex-wrap gap-1.5" aria-label="Which games">
      {GAME_FILTERS.map((f) => {
        const on = f.key === filter
        return (
          <Link
            key={f.key}
            href={href(f.key)}
            aria-current={on ? 'page' : undefined}
            scroll={false}
            className={`px-3 min-h-8 inline-flex items-center rounded-full border text-xs font-bold transition-colors ${
              on ? 'bg-gray-900 border-gray-900 text-white' : 'bg-white text-gray-600 hover:text-gray-900 hover:border-gray-300'
            }`}
            style={on ? undefined : { borderColor: 'var(--border)' }}
          >
            {f.label}
          </Link>
        )
      })}
    </nav>
  )
}
