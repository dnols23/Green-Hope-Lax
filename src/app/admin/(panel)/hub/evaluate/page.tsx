import Link from 'next/link'
import { getAllPlayers } from '@/lib/queries'
import { getCurrentCoach } from '@/lib/coach'
import { createServiceClient } from '@/lib/supabase-server'
import { listRosters, rosterMembers } from '@/lib/rosters'
import { TEAM_LABELS, type Player, type TeamGroup } from '@/lib/types'

export const metadata = { title: 'Evaluate players' }
export const dynamic = 'force-dynamic'

const SEASON = '2026'

/** Players this coach has already rated this season. */
async function ratedBy(email: string | undefined): Promise<Set<string>> {
  const done = new Set<string>()
  if (!email) return done
  const svc = createServiceClient()
  const { data } = await svc
    .from('evaluations')
    .select('player_id')
    .eq('evaluator_email', email)
    .eq('season', SEASON)
  for (const e of (data as { player_id: string }[]) ?? []) done.add(e.player_id)
  return done
}

function PlayerCard({ p, done }: { p: Player; done: boolean }) {
  return (
    <Link
      href={`/admin/hub/evaluate/${p.id}`}
      className="card p-3 flex items-center gap-3 hover:shadow-md transition-shadow"
    >
      <span
        className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center font-black text-white text-sm overflow-hidden"
        style={{ background: 'var(--gh-green)' }}
      >
        {p.number ?? '–'}
      </span>
      <span className="min-w-0 flex-1">
        <span className="font-bold block truncate">{p.name}</span>
        <span className="text-xs text-gray-500">
          {[p.position, p.class_year].filter(Boolean).join(' · ') || '—'}
        </span>
      </span>
      {done ? (
        <span className="text-xs font-bold text-[var(--gh-green)] shrink-0">✓ Done</span>
      ) : (
        <span className="text-xs font-semibold text-gray-400 shrink-0">Rate →</span>
      )}
    </Link>
  )
}

/**
 * Evaluations start from a roster.
 *
 * Every player in the program in one list mixes last season's squad with this
 * season's group, which is a long scroll and an easy way to rate the wrong
 * Jack. Pick the roster you're working through first — the counter then tells
 * you how far into it you are.
 */
export default async function EvaluatePicker({
  searchParams,
}: {
  searchParams: Promise<{ list?: string }>
}) {
  const { list } = await searchParams
  const coach = await getCurrentCoach()
  const [rosters, done] = await Promise.all([listRosters(), ratedBy(coach?.email)])

  const back = (
    <Link href="/admin/hub" className="text-sm font-bold text-[var(--gh-green)]">
      ← Coaches Hub
    </Link>
  )

  // ── A roster picked, or no rosters to pick from ──
  const chosen = list && list !== 'all' ? rosters.find((r) => r.id === list) : undefined

  if (chosen) {
    const players = await rosterMembers(chosen.id)
    const rated = players.filter((p) => done.has(p.id)).length
    return (
      <div>
        <Link href="/admin/hub/evaluate" className="text-sm font-bold text-[var(--gh-green)]">
          ← All rosters
        </Link>
        <h1 className="text-xl font-black mt-2 mb-1">{chosen.name}</h1>
        <p className="text-gray-500 text-sm mb-6">
          {rated} of {players.length} rated by you. A ✓ means you&rsquo;ve already submitted yours —
          tap to update it.
        </p>
        {players.length === 0 ? (
          <div className="card p-6 text-sm text-gray-500">
            Nobody on this roster yet.{' '}
            <Link href={`/admin/rosters/${chosen.id}`} className="font-semibold text-[var(--gh-green)]">
              Add players to it
            </Link>
            .
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {players.map((p) => (
              <PlayerCard key={p.id} p={p} done={done.has(p.id)} />
            ))}
          </div>
        )}
      </div>
    )
  }

  // ── Everyone in the program, grouped by team ──
  if (list === 'all' || rosters.length === 0) {
    const players = await getAllPlayers()
    const groups = new Map<TeamGroup, Player[]>()
    for (const p of players) {
      if (!groups.has(p.team)) groups.set(p.team, [])
      groups.get(p.team)!.push(p)
    }
    return (
      <div>
        {rosters.length === 0 ? (
          back
        ) : (
          <Link href="/admin/hub/evaluate" className="text-sm font-bold text-[var(--gh-green)]">
            ← All rosters
          </Link>
        )}
        <h1 className="text-xl font-black mt-2 mb-1">Everyone in the program</h1>
        <p className="text-gray-500 text-sm mb-6">
          Every player on file, this season and last. A ✓ means you&rsquo;ve already submitted yours.
        </p>
        {players.length === 0 ? (
          <div className="card p-6 text-sm text-gray-500">
            No players yet — add them in Roster, or build a roster and paste your list into it.
          </div>
        ) : (
          <div className="space-y-8">
            {[...groups.entries()].map(([team, group]) => (
              <section key={team}>
                <h2 className="font-black text-gray-700 mb-3">{TEAM_LABELS[team]}</h2>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {group.map((p) => (
                    <PlayerCard key={p.id} p={p} done={done.has(p.id)} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ── The picker itself ──
  const counts = await Promise.all(
    rosters.map(async (r) => {
      const players = await rosterMembers(r.id)
      return { roster: r, total: players.length, rated: players.filter((p) => done.has(p.id)).length }
    })
  )

  return (
    <div>
      {back}
      <h1 className="text-xl font-black mt-2 mb-1">Evaluate a player</h1>
      <p className="text-gray-500 text-sm mb-6">
        Which group are you working through?
      </p>

      <div className="space-y-2">
        {counts.map(({ roster, total, rated }) => (
          <Link
            key={roster.id}
            href={`/admin/hub/evaluate?list=${roster.id}`}
            className="card p-4 flex items-center justify-between gap-3 hover:shadow-md transition-shadow"
          >
            <div className="min-w-0">
              <div className="font-bold flex items-center gap-2 flex-wrap">
                {roster.name}
                {roster.is_public && <span className="badge badge-win">On the public site</span>}
              </div>
              <div className="text-xs text-gray-500">
                {[roster.season, roster.notes].filter(Boolean).join(' · ') || 'No season set'}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-lg font-black" style={{ color: 'var(--gh-green)' }}>
                {rated}/{total}
              </div>
              <div className="text-xs text-gray-400">rated by you</div>
            </div>
          </Link>
        ))}

        <Link
          href="/admin/hub/evaluate?list=all"
          className="card p-4 flex items-center justify-between gap-3 hover:shadow-md transition-shadow"
        >
          <div>
            <div className="font-bold">Everyone in the program</div>
            <div className="text-xs text-gray-500">
              Every player on file, grouped by team — for anyone not on a roster yet.
            </div>
          </div>
          <span className="text-xs font-semibold text-gray-400 shrink-0">Open →</span>
        </Link>
      </div>
    </div>
  )
}
