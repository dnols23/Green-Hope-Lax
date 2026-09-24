import Link from 'next/link'
import { createPlan } from '@/lib/actions'
import { orderedSchedule, readGamePlan, stepClock, stepWhen, type GameDayStep } from '@/lib/gamePlan'
import type { Plan } from '@/lib/planner'
import { formatShortDate, formatTime } from '@/lib/format'
import { withTeam, type Team } from '@/lib/teams'
import { hmOf, ymdOf } from '@/lib/zoned'
import type { Game } from '@/lib/types'

// The War Room's game-day tiles: the button that starts a game plan, and the
// schedule that gets everyone from the bus to the opening faceoff. Server-
// rendered, like the rest of the War Room — a reload moves the "now" marker.

/** The calendar day of a game where the team is, not where the server is. */
export function gameDay(game: Game): string {
  return ymdOf(game.game_date)
}

/**
 * The game plan written for a game: the one made from it on the schedule, or
 * failing that one dated to the same day (a plan started from the planner
 * rather than from the game).
 */
export function findGamePlan(plans: Plan[], game: Game): Plan | null {
  const games = plans.filter((p) => p.kind === 'game')
  return (
    games.find((p) => readGamePlan(p.details).gameId === game.id) ??
    games.find((p) => p.plan_date === gameDay(game)) ??
    null
  )
}

/** "Sep 24" style date for a plan's calendar day, read at noon so no zone can move it a day. */
export function planDateLabel(ymd: string | null): string {
  return ymd ? formatShortDate(`${ymd}T12:00:00Z`) : 'no date'
}

/**
 * Starts the game plan for a game, already named, dated, timed and pointed at
 * the opponent — the coach lands on the plan with the game day laid out
 * against the real faceoff, not on a blank form.
 */
export function MakeGamePlanButton({ game, team }: { game: Game; team: Team }) {
  return (
    <form action={createPlan}>
      <input type="hidden" name="kind" value="game" />
      <input type="hidden" name="team" value={team} />
      <input type="hidden" name="title" value={`Game plan — ${game.opponent}`} />
      <input type="hidden" name="opponent" value={game.opponent} />
      <input type="hidden" name="game_id" value={game.id} />
      <input type="hidden" name="plan_date" value={gameDay(game)} />
      <input type="hidden" name="start_time" value={hmOf(game.game_date)} />
      <button type="submit" className="btn btn-primary max-w-full">
        <span className="truncate">Make the game plan for {game.opponent}</span>
      </button>
    </form>
  )
}

/** Minutes past midnight of an "HH:MM" clock, or null when it isn't one. */
function minutesOf(hm: string | null): number | null {
  const m = hm ? /^(\d{1,2}):(\d{2})/.exec(hm) : null
  return m ? Number(m[1]) * 60 + Number(m[2]) : null
}

/**
 * Where game day is right now: the step under way and the one after it. Only
 * the timed, pre-game steps can be placed — once the ball is down it stays on
 * the faceoff, since nobody can say when halftime will come.
 */
function whereWeAre(
  steps: GameDayStep[],
  faceoff: string | null,
  nowHm: string,
): { now: string | null; next: string | null } {
  const start = minutesOf(faceoff)
  const now = minutesOf(nowHm)
  if (start === null || now === null) return { now: null, next: null }
  const pre = steps.filter((s) => s.phase === 'pre')
  let current: GameDayStep | null = null
  let upNext: GameDayStep | null = null
  for (const s of pre) {
    if (start + s.at <= now) current = s
    else if (!upNext) upNext = s
  }
  return { now: current?.id ?? null, next: upNext?.id ?? null }
}

/**
 * The "Game day" tile: the next game's schedule, a line a step, with the
 * players' and coaches' part a tap away so the list still fits a phone.
 */
export function GameDayPanel({
  game,
  plan,
  team,
  today,
  nowHm,
  mayPlan,
}: {
  game: Game | null
  plan: Plan | null
  team: Team
  today: string
  nowHm: string
  mayPlan: boolean
}) {
  if (!game) {
    return (
      <p className="text-sm text-gray-500">
        No game on the schedule.{' '}
        <Link href="/admin/schedule" className="font-semibold text-[var(--gh-green)]">
          Open the Games page →
        </Link>
      </p>
    )
  }

  const isToday = gameDay(game) === today
  const faceoff = plan?.start_time ?? hmOf(game.game_date)
  const steps = plan ? orderedSchedule(readGamePlan(plan.details).schedule) : []
  const marks = isToday ? whereWeAre(steps, faceoff, nowHm) : { now: null, next: null }

  const heading = (
    <div className="text-sm mb-2">
      <div className="font-bold text-base leading-tight flex items-center gap-2 flex-wrap">
        <span className="min-w-0 break-words">
          {game.home_away === 'away' ? '@' : 'vs'} {game.opponent}
        </span>
        {isToday && (
          <span
            className="text-[0.65rem] font-black uppercase tracking-wide px-2 py-0.5 rounded-full text-white"
            style={{ background: 'var(--gh-maroon)' }}
          >
            Today
          </span>
        )}
      </div>
      <div className="text-gray-500 text-xs">
        {formatShortDate(game.game_date)} · Faceoff {formatTime(game.game_date)}
        {game.location ? ` · ${game.location}` : ''}
      </div>
    </div>
  )

  if (!plan || steps.length === 0) {
    return (
      <div>
        {heading}
        <p className="text-sm text-gray-500 mb-3">
          {plan
            ? 'The game plan has no game-day schedule yet.'
            : 'No game plan yet — making one lays out a standard game day against this faceoff.'}
        </p>
        {plan ? (
          <Link
            href={withTeam(`/admin/planner/${plan.id}`, team)}
            className="text-sm font-semibold text-[var(--gh-green)]"
          >
            Open the game plan →
          </Link>
        ) : mayPlan ? (
          <MakeGamePlanButton game={game} team={team} />
        ) : null}
      </div>
    )
  }

  return (
    <div>
      {heading}
      <ol className="space-y-0.5">
        {steps.map((s) => {
          const clock = stepClock(faceoff, s) ?? stepWhen(s)
          const isNow = marks.now === s.id
          const isNext = marks.next === s.id
          const hasMore = Boolean(s.players.trim() || s.coaches.trim())
          const row = (
            <>
              <span
                className="w-[4.5rem] shrink-0 text-xs font-black tabular-nums leading-tight"
                style={{ color: isNow ? 'var(--gh-green)' : 'var(--text-muted)' }}
              >
                {clock}
              </span>
              {/* w-0 so a long step title truncates instead of widening the
                  War Room's column past the edge of a phone. */}
              <span className="flex-1 w-0 truncate text-sm font-semibold">{s.title || 'Untitled'}</span>
              {isNow || isNext ? (
                <span
                  className="shrink-0 text-[0.65rem] font-black uppercase px-1.5 py-0.5 rounded-full text-white"
                  style={{ background: isNow ? 'var(--gh-green)' : 'var(--gh-maroon)' }}
                >
                  {isNow ? 'Now' : 'Next'}
                </span>
              ) : null}
              {s.lead && (
                <span className="shrink-0 max-w-[30%] truncate text-xs text-gray-500">{s.lead}</span>
              )}
            </>
          )
          const highlight = isNow
            ? { background: 'color-mix(in srgb, var(--gh-green) 12%, transparent)' }
            : undefined
          return (
            <li key={s.id} className="rounded-md" style={highlight}>
              {hasMore ? (
                /* The detail opens on a tap; on game day the step under way
                   starts open, since that's the one somebody is checking. */
                <details open={isNow}>
                  <summary className="flex items-center gap-2 min-h-9 px-1.5 cursor-pointer list-none">
                    {row}
                    <span className="caret text-xs shrink-0" aria-hidden>▸</span>
                  </summary>
                  <div className="pl-[5.25rem] pr-1.5 pb-2 space-y-1 text-xs text-gray-600">
                    {s.players.trim() && (
                      <p>
                        <span className="font-bold text-gray-700">Players: </span>
                        {s.players}
                      </p>
                    )}
                    {s.coaches.trim() && (
                      <p>
                        <span className="font-bold text-gray-700">Coaches: </span>
                        {s.coaches}
                      </p>
                    )}
                  </div>
                </details>
              ) : (
                <div className="flex items-center gap-2 min-h-9 px-1.5">{row}</div>
              )}
            </li>
          )
        })}
      </ol>
      <Link
        href={withTeam(`/admin/planner/${plan.id}`, team)}
        className="inline-block mt-3 text-sm font-semibold text-[var(--gh-green)]"
      >
        Open the game plan →
      </Link>
    </div>
  )
}
