'use client'
import { useState } from 'react'
import Link from 'next/link'
import type { Player, TeamGroup } from '@/lib/types'
import { TEAM_LABELS } from '@/lib/types'
import { FalconHead } from './Logo'

// `awards` maps a lowercased player name → the award label(s) they won.
export function RosterView({ players, awards = {} }: { players: Player[]; awards?: Record<string, string> }) {
  const [group, setGroup] = useState<TeamGroup>('boys_varsity')
  const filtered = players.filter((p) => p.team === group)

  return (
    <div>
      <div className="mb-6">
        <label htmlFor="roster-team" className="field-label">Team</label>
        <select
          id="roster-team"
          value={group}
          onChange={(e) => setGroup(e.target.value as TeamGroup)}
          className="field max-w-xs"
        >
          <option value="boys_varsity">Boys Varsity</option>
          <option value="boys_jv">Boys JV</option>
          <option value="girls">Girls</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="text-gray-500">No players listed for this team yet.</p>
      ) : (
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((p) => (
            <div key={p.id} className="card overflow-hidden">
              <div className="aspect-[4/5] flex items-center justify-center relative" style={{ background: 'linear-gradient(160deg,#f0f4f1,#e4eae6)' }}>
                {p.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.photo_url} alt={p.name} className="w-full h-full object-cover" />
                ) : (
                  <FalconHead size={64} className="opacity-30" />
                )}
                {p.number && (
                  <span className="absolute top-2 left-2 text-white font-black text-sm px-2 py-0.5 rounded" style={{ background: 'var(--gh-maroon)' }}>
                    #{p.number}
                  </span>
                )}
              </div>
              <div className="p-3">
                <div className="font-bold leading-tight flex items-center gap-1">
                  <span>{p.name}</span>
                  {awards[p.name.toLowerCase()] && (
                    <Link
                      href="/awards"
                      title={`${awards[p.name.toLowerCase()]} — view team awards`}
                      aria-label="Team award winner"
                      className="text-base leading-none shrink-0"
                    >
                      🏆
                    </Link>
                  )}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {[p.position, p.class_year].filter(Boolean).join(' · ') || '—'}
                </div>
                <div className="mt-1 text-[0.65rem] font-bold tracking-wide uppercase" style={{ color: 'var(--gh-green)' }}>
                  {TEAM_LABELS[p.team]}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
