'use client'
import { useState } from 'react'
import type { Game, ProgramGender } from '@/lib/types'
import { formatDate, formatTime, gameResult, homeAwayLabel } from '@/lib/format'
import { SCHOOL } from '@/lib/brand'

export function ScheduleView({ games }: { games: Game[] }) {
  const [gender, setGender] = useState<ProgramGender>('boys')
  const filtered = games
    .filter((g) => g.gender === gender)
    .sort((a, b) => +new Date(a.game_date) - +new Date(b.game_date))

  const maxpreps = gender === 'boys' ? SCHOOL.maxprepsBoys : SCHOOL.maxprepsGirls

  return (
    <div>
      {/* Toggle */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div className="inline-flex rounded-full border border-gray-200 bg-white p-1">
          {(['boys', 'girls'] as ProgramGender[]).map((g) => (
            <button
              key={g}
              onClick={() => setGender(g)}
              className="px-5 py-1.5 rounded-full text-sm font-bold transition-colors"
              style={
                gender === g
                  ? { background: g === 'boys' ? 'var(--gh-green)' : 'var(--gh-maroon)', color: '#fff' }
                  : { color: '#6b7280' }
              }
            >
              {g === 'boys' ? 'Boys' : 'Girls'}
            </button>
          ))}
        </div>
        <a href={maxpreps} target="_blank" rel="noopener noreferrer" className="text-sm font-bold" style={{ color: 'var(--gh-green)' }}>
          Official stats on MaxPreps ↗
        </a>
      </div>

      {filtered.length === 0 ? (
        <p className="text-gray-500">No games scheduled yet for this team.</p>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="space-y-3 sm:hidden">
            {filtered.map((g) => {
              const res = gameResult(g)
              return (
                <div key={g.id} className="card p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-400">{formatDate(g.game_date)}</span>
                    {res ? <span className={`badge ${res.cls}`}>{res.label}</span>
                      : <span className="badge badge-sched">{formatTime(g.game_date)}</span>}
                  </div>
                  <div className="font-bold mt-1">
                    <span className="text-gray-400 font-semibold">{homeAwayLabel(g)}</span> {g.opponent}
                  </div>
                  {g.location && <div className="text-xs text-gray-500 mt-0.5">📍 {g.location}</div>}
                  <div className="mt-1 flex gap-2">
                    {g.is_conference && <span className="badge badge-conf">Conf</span>}
                    {g.status === 'postponed' && <span className="badge badge-sched">Postponed</span>}
                    {g.status === 'canceled' && <span className="badge badge-loss">Canceled</span>}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block card table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th><th>Time</th><th></th><th>Opponent</th><th>Location</th><th>Result</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((g) => {
                  const res = gameResult(g)
                  return (
                    <tr key={g.id}>
                      <td className="font-semibold whitespace-nowrap">{formatDate(g.game_date)}</td>
                      <td className="text-gray-500 whitespace-nowrap">{formatTime(g.game_date)}</td>
                      <td className="text-gray-400 font-semibold">{homeAwayLabel(g)}</td>
                      <td className="font-bold">
                        {g.opponent}
                        {g.is_conference && <span className="badge badge-conf ml-2">Conf</span>}
                      </td>
                      <td className="text-gray-500">{g.location ?? '—'}</td>
                      <td>
                        {res ? <span className={`badge ${res.cls}`}>{res.label}</span>
                          : g.status === 'postponed' ? <span className="badge badge-sched">Postponed</span>
                          : g.status === 'canceled' ? <span className="badge badge-loss">Canceled</span>
                          : <span className="text-gray-400">—</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
