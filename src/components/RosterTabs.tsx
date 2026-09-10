'use client'
import { useState } from 'react'
import { RosterView } from './RosterView'
import type { Player } from '@/lib/types'

export interface PublicRoster {
  id: string
  name: string
  season: string | null
  players: Player[]
}

/**
 * The public roster page when more than one roster is published.
 *
 * Two published rosters used to arrive as one merged list, which is how last
 * season's squad and an off-season group ended up indistinguishable. They keep
 * their own names and you pick between them.
 */
export function RosterTabs({
  rosters,
  awards = {},
}: {
  rosters: PublicRoster[]
  awards?: Record<string, string>
}) {
  const [active, setActive] = useState(rosters[0]?.id)
  const current = rosters.find((r) => r.id === active) ?? rosters[0]

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-6">
        {rosters.map((r) => {
          const on = r.id === current?.id
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => setActive(r.id)}
              className="px-4 py-2 rounded-full text-sm font-bold transition-colors"
              style={{
                background: on ? 'var(--gh-green)' : 'transparent',
                color: on ? '#fff' : 'var(--text-secondary, #4b5563)',
                border: `1.5px solid ${on ? 'var(--gh-green)' : 'var(--border, #e5e7eb)'}`,
              }}
            >
              {r.name}
              <span className="ml-2 font-normal opacity-70">{r.players.length}</span>
            </button>
          )
        })}
      </div>

      {current && <RosterView key={current.id} players={current.players} awards={awards} />}
    </div>
  )
}
