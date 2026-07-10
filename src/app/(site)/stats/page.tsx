import type { Metadata } from 'next'
import Link from 'next/link'
import { getGames } from '@/lib/queries'
import { assertPageVisible } from '@/lib/pages'
import { seasonYear, summarizeSeason, recordLabel } from '@/lib/format'

export const metadata: Metadata = {
  title: 'Stats',
  description: 'Season records and team statistics for Green Hope Falcons lacrosse.',
}

export default async function StatsPage() {
  await assertPageVisible('stats')
  const games = await getGames()

  // Seasons present in the schedule, newest first.
  const years = [...new Set(games.map((g) => seasonYear(g.game_date)))].sort((a, b) => b - a)
  const summaries = years.map((y) => summarizeSeason(games, y))
  const current = summaries.find((s) => s.played > 0) ?? summaries[0]

  // All-time totals across every finished game on record.
  const allTime = summaries.reduce(
    (acc, s) => ({
      wins: acc.wins + s.wins,
      losses: acc.losses + s.losses,
      ties: acc.ties + s.ties,
      goalsFor: acc.goalsFor + s.goalsFor,
      goalsAgainst: acc.goalsAgainst + s.goalsAgainst,
    }),
    { wins: 0, losses: 0, ties: 0, goalsFor: 0, goalsAgainst: 0 },
  )

  return (
    <div className="max-w-screen-xl mx-auto px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div>
          <div className="section-label">Green Hope Falcons</div>
          <h1 className="page-title">Stats</h1>
        </div>
        <Link href="/record-books" className="text-sm font-bold" style={{ color: 'var(--gh-green)' }}>
          All-time Record Books →
        </Link>
      </div>

      {/* ── Current season at a glance ── */}
      {current && (current.played > 0 || current.scheduled > 0) ? (
        <section className="mb-12">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="font-black text-xl">{current.year} Season</h2>
            {current.played === 0 && <span className="badge badge-sched">Upcoming</span>}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatBox label="Record" value={recordLabel(current)} />
            <StatBox label="Conference" value={`${current.confWins}–${current.confLosses}`} />
            <StatBox label="Goals For" value={current.played ? String(current.goalsFor) : '—'} />
            <StatBox label="Goals Against" value={current.played ? String(current.goalsAgainst) : '—'} />
          </div>
          <p className="text-xs text-gray-400 mt-3">
            Computed automatically from the{' '}
            <Link href="/schedule" className="font-semibold" style={{ color: 'var(--gh-green)' }}>schedule</Link>{' '}
            — it updates as soon as final scores are entered in the admin panel.
          </p>
        </section>
      ) : null}

      {/* ── Season-by-season ── */}
      {summaries.some((s) => s.played > 0) ? (
        <section className="mb-12">
          <h2 className="font-black text-xl mb-4">Season by Season</h2>
          <div className="card table-scroll">
            <table className="data-table">
              <thead>
                <tr><th>Season</th><th>Record</th><th>Conference</th><th>Goals For</th><th>Goals Against</th></tr>
              </thead>
              <tbody>
                {summaries.filter((s) => s.played > 0).map((s) => (
                  <tr key={s.year}>
                    <td className="font-semibold">{s.year}</td>
                    <td className="font-bold">{recordLabel(s)}</td>
                    <td className="text-gray-600">{s.confWins}–{s.confLosses}</td>
                    <td className="text-gray-600">{s.goalsFor}</td>
                    <td className="text-gray-600">{s.goalsAgainst}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-bold" style={{ borderTop: '2px solid var(--surface-2, #e5e7eb)' }}>
                  <td>All-Time</td>
                  <td>{allTime.ties > 0 ? `${allTime.wins}–${allTime.losses}–${allTime.ties}` : `${allTime.wins}–${allTime.losses}`}</td>
                  <td>—</td>
                  <td>{allTime.goalsFor}</td>
                  <td>{allTime.goalsAgainst}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      ) : (
        <div className="card p-8 text-center text-gray-500">
          <p className="font-semibold text-gray-700">No season stats yet.</p>
          <p className="text-sm mt-1">
            Season records appear here automatically once games have final scores on the schedule.
          </p>
        </div>
      )}
    </div>
  )
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-5 text-center">
      <div className="text-3xl font-black tracking-tight" style={{ color: 'var(--gh-green)' }}>{value}</div>
      <div className="text-xs font-bold uppercase tracking-wide text-gray-400 mt-1">{label}</div>
    </div>
  )
}
