import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireSection, canTeam } from '@/lib/permissions'
import { getPlan } from '@/lib/plans'
import { listRosters, rosterMembers } from '@/lib/rosters'
import { listStaff } from '@/lib/staff'
import { listDrills } from '@/lib/drillsData'
import { deletePlan, duplicatePlan } from '@/lib/actions'
import { DeleteButton } from '@/components/admin/DeleteButton'
import { PlanEditor } from '@/components/planner/PlanEditor'
import { PLAN_KINDS } from '@/lib/planner'
import { teamLabel, withTeam } from '@/lib/teams'
import { listPlays } from '@/lib/plays'
import { getGames } from '@/lib/queries'
import { readGamePlan } from '@/lib/gamePlan'
import { formatDate, formatTime } from '@/lib/format'
import { hmOf, ymdOf } from '@/lib/zoned'
import type { GameOption, PlayOption } from '@/components/planner/GamePlanEditor'

export const dynamic = 'force-dynamic'

export default async function PlanPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireSection('planner')
  const { id } = await params
  const plan = await getPlan(id)
  if (!plan) notFound()
  /* Anyone may read the other team's plan — seeing what varsity is running is
     half the point of being on the same staff. Changing it is the part that is
     checked, here and again in savePlan. */
  const canWrite = canTeam(viewer, plan.team)

  const [live, staff, drills] = await Promise.all([listRosters(), listStaff(), listDrills()])
  /* A plan written last season still points at last season's roster. Offering
     only the live ones would show this plan's own roster as blank and quietly
     change it on the next save — so a plan keeps its own, archived or not. */
  const rosters = live.some((r) => r.id === plan.roster_id)
    ? live
    : [...live, ...(await listRosters(true)).filter((r) => r.id === plan.roster_id)]
  /* Every roster's players travel with the page: switching the roster in the
     editor then changes who you can pick straight away, rather than waiting for
     a save and a reload — which looked like the switch doing nothing at all. */
  const playersByRoster: Record<string, { id: string; name: string; number: string | null }[]> = {}
  await Promise.all(
    rosters.map(async (r) => {
      const members = await rosterMembers(r.id)
      playersByRoster[r.id] = members.map((p) => ({ id: p.id, name: p.name, number: p.number }))
    })
  )
  const kind = PLAN_KINDS.find((k) => k.key === plan.kind)

  /* A game plan points at the Library's plays and at a game on the schedule.
     The games are this team's from today on, plus the one it is already linked
     to if that has been played. */
  let plays: PlayOption[] = []
  let games: GameOption[] = []
  if (plan.kind === 'game') {
    const linked = readGamePlan(plan.details).gameId
    const today = ymdOf(new Date())
    const [shelf, schedule] = await Promise.all([listPlays(), getGames(undefined, 'admin', plan.team)])
    plays = shelf.map((p) => ({ id: p.id, name: p.name, board: p.board }))
    games = schedule
      .filter((g) => ymdOf(g.game_date) >= today || g.id === linked)
      .map((g) => ({
        id: g.id,
        opponent: g.opponent,
        homeAway: g.home_away,
        location: g.location,
        ymd: ymdOf(g.game_date),
        hm: hmOf(g.game_date),
        when: `${formatDate(g.game_date)} · ${formatTime(g.game_date)}`,
      }))
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        {/* Back to the list this plan is actually in, not whichever one you
            happened to come from. */}
        <Link href={withTeam('/admin/planner', plan.team)} className="text-sm font-bold text-[var(--gh-green)]">
          ← {plan.team === 'varsity' ? 'Planner' : `${teamLabel(plan.team)} planner`}
        </Link>
        <div className="flex items-center gap-3">
          {plan.team !== 'varsity' && (
            <span
              className="text-xs font-bold px-2 py-0.5 rounded-full"
              style={{ background: '#fde8ea', color: 'var(--gh-maroon)' }}
            >
              {teamLabel(plan.team)}
            </span>
          )}
          <span className="text-xs text-gray-400">{kind?.icon} {kind?.label}</span>
          {canWrite && (
            <>
              <form action={duplicatePlan}>
                <input type="hidden" name="id" value={plan.id} />
                <button type="submit" className="text-xs font-bold text-gray-500 hover:text-gray-800">Duplicate</button>
              </form>
              <DeleteButton id={plan.id} action={deletePlan} label="Delete" />
            </>
          )}
        </div>
      </div>

      <PlanEditor
        plan={plan}
        rosters={rosters.map((r) => ({ id: r.id, name: r.name, is_archived: r.is_archived }))}
        playersByRoster={playersByRoster}
        coaches={staff.map((c) => c.name).sort((a, b) => a.localeCompare(b))}
        drills={drills}
        plays={plays}
        games={games}
        canWrite={canWrite}
      />
    </div>
  )
}
