import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireSection, canTeam, isSandboxed, mayReview } from '@/lib/permissions'
import { canSeePlan, getPlan, isAuthor } from '@/lib/plans'
import { listRosters, rosterMembers } from '@/lib/rosters'
import { listStaff } from '@/lib/staff'
import { listDrills } from '@/lib/drillsData'
import { adoptPlan, deletePlan, duplicatePlan, sendPlanForReview } from '@/lib/actions'
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
  // Somebody else's draft isn't there at all, as far as this coach can tell.
  if (!plan || !canSeePlan(viewer, plan)) notFound()
  /* Anyone may read the other team's plan — seeing what varsity is running is
     half the point of being on the same staff. Changing it is the part that is
     checked, here and again in savePlan. */
  const mine = isAuthor(viewer, plan)
  const reviewer = !mine && plan.private && mayReview(viewer, plan.team)
  const sandboxed = isSandboxed(viewer)
  const canWrite =
    canTeam(viewer, plan.team) &&
    (sandboxed ? plan.private && mine : !plan.private || mine || reviewer)

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
  const author = plan.created_by
    ? staff.find((c) => c.email.toLowerCase() === plan.created_by!.toLowerCase())?.name ?? plan.created_by.split('@')[0]
    : 'A coach'

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
          {canTeam(viewer, plan.team) && (
            <form action={duplicatePlan}>
              <input type="hidden" name="id" value={plan.id} />
              <button type="submit" className="text-xs font-bold text-gray-500 hover:text-gray-800">
                {sandboxed && !plan.private ? 'Make my own copy' : 'Duplicate'}
              </button>
            </form>
          )}
          {canWrite && <DeleteButton id={plan.id} action={deletePlan} label="Delete" />}
        </div>
      </div>

      {plan.private && mine && (
        <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 mb-3 flex items-center gap-3 flex-wrap">
          <p className="text-sm text-gray-700 flex-1 min-w-[12rem]">
            {plan.review_requested_at ? (
              <>
                <span className="font-bold">Sent to the head coach.</span> Keep working on it — they see your latest save.
              </>
            ) : (
              <>
                <span className="font-bold">Your draft.</span> Only you can see it.
              </>
            )}
          </p>
          <form action={sendPlanForReview}>
            <input type="hidden" name="id" value={plan.id} />
            <input type="hidden" name="on" value={plan.review_requested_at ? 'false' : 'true'} />
            <button type="submit" className={`btn ${plan.review_requested_at ? 'btn-ghost' : 'btn-primary'} !py-1.5 text-sm`}>
              {plan.review_requested_at ? 'Take it back' : 'Send to head coach for review'}
            </button>
          </form>
        </div>
      )}
      {reviewer && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 mb-3 flex items-center gap-3 flex-wrap">
          <p className="text-sm text-amber-900 flex-1 min-w-[12rem]">
            <span className="font-bold">{author} sent this for review.</span> Nobody else sees it until you add it.
          </p>
          <form action={adoptPlan}>
            <input type="hidden" name="id" value={plan.id} />
            <button type="submit" className="btn btn-primary !py-1.5 text-sm">
              Add to the {plan.team === 'varsity' ? 'varsity' : 'JV'} planner
            </button>
          </form>
        </div>
      )}

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
