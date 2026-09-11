import Link from 'next/link'
import { getAllPlayers } from '@/lib/queries'
import { getCurrentCoach } from '@/lib/coach'
import { createServiceClient } from '@/lib/supabase-server'
import { listRosters, rosterMembers } from '@/lib/rosters'
import { compileScores, type Evaluation } from '@/lib/evaluations'
import { TEAM_LABELS, type Player, type TeamGroup } from '@/lib/types'
import { EvaluateList, type EvalRow } from './EvaluateList'
import { SplitNameNotice } from '@/components/admin/SplitNameNotice'

export const metadata = { title: 'Evaluate players' }
export const dynamic = 'force-dynamic'

/** Every evaluation on file, compiled per player, plus what this coach has done. */
async function scoreboard(email: string | undefined) {
  const svc = createServiceClient()
  const { data } = await svc.from('evaluations').select('*')
  const evals = (data as Evaluation[]) ?? []
  return {
    scores: compileScores(evals),
    // Deliberately every season: a coach asking "have I rated this player" means
    // ever, not this season only.
    mine: new Set(evals.filter((e) => e.evaluator_email === email).map((e) => e.player_id)),
  }
}

function toRows(
  players: Player[],
  scores: Map<string, { average: number; count: number }>,
  mine: Set<string>
): EvalRow[] {
  return players.map((p) => {
    const score = scores.get(p.id)
    return {
      id: p.id,
      name: p.name,
      number: p.number,
      position: p.position,
      classYear: p.class_year,
      teamLabel: TEAM_LABELS[p.team as TeamGroup],
      average: score?.average ?? 0,
      raters: score?.count ?? 0,
      ratedByMe: mine.has(p.id),
    }
  })
}

/**
 * Evaluations start from a roster.
 *
 * Every player in the program in one list mixes last season's squad with this
 * season's group, which is a long scroll and an easy way to rate the wrong Jack.
 * Pick the list first; the filters and ordering are then the same whichever one
 * you picked.
 */
export default async function EvaluatePicker({
  searchParams,
}: {
  searchParams: Promise<{ list?: string }>
}) {
  const { list } = await searchParams
  const coach = await getCurrentCoach()
  const rosters = await listRosters()

  const chosen = list && list !== 'all' ? rosters.find((r) => r.id === list) : undefined
  const showAll = list === 'all' || (!chosen && rosters.length === 0)

  // ── A list is open ──
  if (chosen || showAll) {
    const [players, { scores, mine }] = await Promise.all([
      chosen ? rosterMembers(chosen.id) : getAllPlayers(),
      scoreboard(coach?.email),
    ])
    const rows = toRows(players, scores, mine)
    const ratedByMe = rows.filter((r) => r.ratedByMe).length

    return (
      <div>
        <Link
          href={rosters.length === 0 ? '/admin/hub' : '/admin/hub/evaluate'}
          className="text-sm font-bold text-[var(--gh-green)]"
        >
          {rosters.length === 0 ? '← Coaches Hub' : '← All rosters'}
        </Link>
        <h1 className="text-xl font-black mt-2 mb-1">
          {chosen ? chosen.name : 'Everyone in the program'}
        </h1>
        <p className="text-gray-500 text-sm mb-5">
          {chosen
            ? `${ratedByMe} of ${rows.length} rated by you.`
            : `Every player on file, this season and past ones. ${ratedByMe} rated by you.`}{' '}
          Scores are every coach&rsquo;s ratings compiled.
        </p>

        <SplitNameNotice />

        {rows.length === 0 ? (
          <div className="card p-6 text-sm text-gray-500">
            {chosen ? (
              <>
                Nobody on this roster yet.{' '}
                <Link href={`/admin/rosters/${chosen.id}`} className="font-semibold text-[var(--gh-green)]">
                  Add players to it
                </Link>
                .
              </>
            ) : (
              'No players yet — add them in Roster, or build a roster and paste your list into it.'
            )}
          </div>
        ) : (
          <EvaluateList players={rows} />
        )}
      </div>
    )
  }

  // ── The picker ──
  const { mine } = await scoreboard(coach?.email)
  const counts = await Promise.all(
    rosters.map(async (r) => {
      const players = await rosterMembers(r.id)
      return { roster: r, total: players.length, rated: players.filter((p) => mine.has(p.id)).length }
    })
  )

  return (
    <div>
      <Link href="/admin/hub" className="text-sm font-bold text-[var(--gh-green)]">
        ← Coaches Hub
      </Link>
      <h1 className="text-xl font-black mt-2 mb-1">Evaluate a player</h1>
      <p className="text-gray-500 text-sm mb-6">Which group are you working through?</p>

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
              Every player on file, past and present, with the same filters.
            </div>
          </div>
          <span className="text-xs font-semibold text-gray-400 shrink-0">Open →</span>
        </Link>
      </div>
    </div>
  )
}
