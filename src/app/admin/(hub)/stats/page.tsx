import Link from 'next/link'
import { requireTeam } from '@/lib/permissions'
import { loadSeason } from '@/lib/statsData'
import { aggregate, filterGames, fmtMetric, fmtRate, gamesInSeason, metricValue, pickSeason, recordOf, METRICS, type GameSummary, type MetricKey, type StatEvent } from '@/lib/stats'
import { teamLabel, withTeam, type Team } from '@/lib/teams'
import { ymdOf } from '@/lib/zoned'
import { StatsTabs } from './StatsTabs'
import { NewGameForm } from './NewGameForm'
import { OutcomeChip, clock, monthDay, scoreText, vsAt, whenLabel } from './gameBits'

export const metadata = { title: 'Stats' }
export const dynamic = 'force-dynamic'

/** The four numbers a coach asks about first, in the order he asks. */
const HEADLINES: MetricKey[] = ['shooting', 'clears', 'faceoffs', 'saving']

/** Calm little heading over each part of the page. */
function Label({ children }: { children: React.ReactNode }) {
  return <h2 className="text-[0.65rem] font-black uppercase tracking-[0.18em] text-gray-400 mb-2">{children}</h2>
}

/**
 * Stats home: how the season is going, the game to track today, and every
 * game with its box score.
 */
export default async function StatsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { team, canWrite } = await requireTeam('stats', (await searchParams).team)
  const season = await loadSeason(team)
  // "Today" is Cary's today, worked out here so the client never guesses.
  const today = ymdOf(new Date())

  const dated = season.games.map((g) => ({ ...g, ymd: ymdOf(g.game.game_date) }))
  const active = (g: GameSummary) => g.game.status !== 'postponed' && g.game.status !== 'canceled'

  // Being tracked but not finished: the first thing he needs if he closed the tab mid-game.
  const inProgress = dated
    .filter((g) => g.tracked && g.game.status !== 'final' && active(g))
    .sort((a, b) => b.game.game_date.localeCompare(a.game.game_date))
  // Today's games, or failing that the next one on the schedule.
  const ahead = dated
    .filter((g) => !g.tracked && g.game.status === 'scheduled' && g.ymd >= today)
    .sort((a, b) => a.game.game_date.localeCompare(b.game.game_date))
  const todays = ahead.filter((g) => g.ymd === today)
  const next = todays.length ? todays : ahead.slice(0, 1)

  // Played (today and before) newest first; the rest of the schedule tucked away.
  const played = dated.filter((g) => g.ymd <= today || g.tracked).sort((a, b) => b.game.game_date.localeCompare(a.game.game_date))
  const later = dated.filter((g) => !(g.ymd <= today || g.tracked)).sort((a, b) => a.game.game_date.localeCompare(b.game.game_date))
  // A year heading only earns its place once there's more than one season here.
  const years = new Set(played.map((g) => g.ymd.slice(0, 4)))

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <StatsTabs team={team} active="games" />
        <h1 className="sr-only">{teamLabel(team)} stats</h1>
      </div>

      {/* This season only: last spring's record isn't this spring's. */}
      <Snapshot games={gamesInSeason(season.games, pickSeason(season.games, null))} events={season.events} team={team} />

      {canWrite && (
        <section>
          <Label>Track a game</Label>
          <div className="space-y-2">
            {inProgress.map((g) => (
              <TrackCard key={g.game.id} g={g} today={today} resume />
            ))}
            {next.map((g) => (
              <TrackCard key={g.game.id} g={g} today={today} />
            ))}
            {!inProgress.length && !next.length && (
              <p className="text-sm text-gray-500 pb-1">
                Nothing on the schedule today. Playing a scrimmage or a game that isn&rsquo;t listed? Start one here.
              </p>
            )}
            <div className="pt-1">
              <NewGameForm team={team} today={today} />
            </div>
          </div>
        </section>
      )}

      <section>
        <Label>All games</Label>
        {season.games.length === 0 ? (
          <div className="card p-6 text-sm text-gray-600 space-y-2">
            <p className="font-bold text-gray-900">No {teamLabel(team)} games yet.</p>
            {canWrite ? (
              <p>
                Tap <b>＋ New game</b> above to start tracking one right now, or put the season on the{' '}
                <Link href={withTeam('/admin/schedule', team)} className="text-[var(--gh-green)] font-semibold">
                  schedule
                </Link>{' '}
                and every game shows up here, ready to track.
              </p>
            ) : (
              <p>Once the {teamLabel(team)} staff tracks a game, its box score shows up here.</p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {later.length > 0 && (
              <details className="card px-4 py-3">
                <summary className="cursor-pointer list-none flex items-center gap-2 text-sm font-bold text-gray-700">
                  <span className="caret text-xs">▸</span> Coming up
                  <span className="font-normal text-gray-400 tabular-nums">{later.length}</span>
                </summary>
                <ul className="mt-2 divide-y divide-gray-100">
                  {later.map((g) => (
                    <GameRow key={g.game.id} g={g} team={team} canWrite={canWrite} upcoming />
                  ))}
                </ul>
              </details>
            )}
            {played.length === 0 ? (
              <div className="card p-6 text-sm text-gray-600">
                No games played yet. First up:{' '}
                <b className="text-gray-900">
                  {whenLabel(later[0].ymd, later[0].game.game_date, today)} {vsAt(later[0].game)} {later[0].game.opponent}
                </b>
                .
              </div>
            ) : (
              <ul className="card px-4 divide-y divide-gray-100">
                {played.map((g, i) => {
                  const year = g.ymd.slice(0, 4)
                  const newYear = years.size > 1 && (i === 0 || played[i - 1].ymd.slice(0, 4) !== year)
                  return (
                    <GameRow key={g.game.id} g={g} team={team} canWrite={canWrite} year={newYear ? year : undefined} />
                  )
                })}
              </ul>
            )}
          </div>
        )}
      </section>
    </div>
  )
}

/**
 * Record, goals a game and the four headline percentages — one tap from the
 * whole analysis. Before anything is tracked it stays quiet: just the record,
 * if there is one, and what to do to fill the rest in.
 */
function Snapshot({ games, events, team }: { games: GameSummary[]; events: StatEvent[]; team: Team }) {
  const record = recordOf(games)
  const decided = record.w + record.l + record.t
  const tracked = filterGames(games, 'all')
  if (!tracked.length) {
    if (!decided) return null
    return (
      <div className="card p-4 sm:p-5 flex items-center gap-4">
        <div>
          <div className="text-[0.65rem] font-black uppercase tracking-[0.18em] text-gray-400">Record</div>
          <div className="text-3xl font-black tabular-nums">{record.label}</div>
        </div>
        <p className="text-sm text-gray-500 border-l pl-4" style={{ borderColor: 'var(--border)' }}>
          Track a game and shooting, clearing, faceoff and save percentages show up here.
        </p>
      </div>
    )
  }

  const all = aggregate(tracked, events)
  const perGame = (v: number | null) => (v == null ? '—' : v.toFixed(1))
  return (
    <Link
      href={withTeam('/admin/stats/analysis', team)}
      className="card block p-4 sm:p-5 transition-colors hover:border-gray-300 group"
    >
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div className="flex items-end gap-6">
          <div>
            <div className="text-[0.65rem] font-black uppercase tracking-[0.18em] text-gray-400">Record</div>
            <div className="text-3xl font-black tabular-nums leading-tight">{decided ? record.label : '—'}</div>
          </div>
          <div>
            <div className="text-[0.65rem] font-black uppercase tracking-[0.18em] text-gray-400">Goals a game</div>
            <div className="text-lg font-bold tabular-nums leading-tight pb-0.5">
              {perGame(all.perGame.goalsFor)} <span className="text-gray-400 font-semibold">for</span>
              <span className="text-gray-300 mx-1.5">·</span>
              {perGame(all.perGame.goalsAgainst)} <span className="text-gray-400 font-semibold">against</span>
            </div>
          </div>
        </div>
        <span className="text-sm font-bold text-[var(--gh-green)] group-hover:underline">Analysis →</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
        {HEADLINES.map((key) => {
          const def = METRICS.find((m) => m.key === key)!
          const v = metricValue(key, all)
          return (
            <div key={key} className="rounded-lg bg-gray-50 px-3 py-2.5" title={def.help}>
              <div className="text-xs font-semibold text-gray-500">{def.label}</div>
              <div className="text-2xl font-black tabular-nums leading-tight">{fmtMetric(key, v)}</div>
              <div className="text-xs text-gray-400 tabular-nums">
                {v != null && typeof v !== 'number' && v.att > 0 ? fmtRate(v) : 'none yet'}
              </div>
            </div>
          )
        })}
      </div>
      <p className="text-xs text-gray-400 mt-3">
        From {tracked.length} tracked game{tracked.length === 1 ? '' : 's'}
      </p>
    </Link>
  )
}

/** The game to track now, with one big button. */
function TrackCard({ g, today, resume = false }: { g: GameSummary & { ymd: string }; today: string; resume?: boolean }) {
  const score = scoreText(g.goalsFor, g.goalsAgainst)
  return (
    <div className="card p-4 flex items-center gap-4">
      <div className="min-w-0 flex-1">
        <div className="text-xs font-bold uppercase tracking-wide text-[var(--gh-maroon)]">
          {resume ? 'In progress' : whenLabel(g.ymd, g.game.game_date, today)}
          <span className="text-gray-400 font-semibold normal-case tracking-normal">
            {' · '}
            {resume ? whenLabel(g.ymd, g.game.game_date, today) : clock(g.game.game_date)}
          </span>
        </div>
        <div className="text-lg font-black truncate">
          <span className="text-gray-400 font-semibold">{vsAt(g.game)}</span> {g.game.opponent}
        </div>
        {resume && (
          <div className="text-sm text-gray-500 tabular-nums">
            {score} · {g.eventCount} stat{g.eventCount === 1 ? '' : 's'} so far
          </div>
        )}
      </div>
      <Link href={`/admin/track/${g.game.id}`} className="btn btn-primary !px-6 !py-3 !text-base shrink-0">
        {resume ? 'Resume' : 'Track'}
      </Link>
    </div>
  )
}

/**
 * One game on one line: date, opponent, score and result, and what you can do
 * with it. On a phone the row itself opens the box score, so the only button
 * is Track or Resume; on a wider screen Box score gets its own button too.
 */
function GameRow({
  g,
  team,
  canWrite,
  upcoming = false,
  year,
}: {
  g: GameSummary & { ymd: string }
  team: Team
  canWrite: boolean
  upcoming?: boolean
  year?: string
}) {
  const { month, day } = monthDay(g.game.game_date)
  const off = g.game.status === 'postponed' || g.game.status === 'canceled'
  const inProgress = g.tracked && g.game.status !== 'final' && !off
  const score = scoreText(g.goalsFor, g.goalsAgainst)
  const boxHref = withTeam(`/admin/stats/${g.game.id}`, team)

  const status = off
    ? g.game.status === 'postponed'
      ? 'Postponed'
      : 'Canceled'
    : g.tracked
      ? `${inProgress ? 'In progress' : 'Tracked'} · ${g.eventCount} stat${g.eventCount === 1 ? '' : 's'}`
      : upcoming
        ? clock(g.game.game_date)
        : 'Not tracked'

  const body = (
    <>
      <div className="w-10 shrink-0 text-center leading-none">
        <div className="text-[0.6rem] font-black uppercase tracking-wider text-gray-400">{month}</div>
        <div className="text-lg font-black tabular-nums mt-0.5">{day}</div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-bold truncate">
          <span className="text-gray-400 font-semibold">{vsAt(g.game)}</span> {g.game.opponent}
          {g.game.is_conference && (
            <span className="ml-1.5 align-middle text-[0.6rem] font-black uppercase tracking-wider text-gray-400" title="Conference game">
              Conf
            </span>
          )}
        </div>
        <div className={`text-xs truncate ${inProgress ? 'text-[var(--gh-maroon)] font-semibold' : 'text-gray-500'}`}>{status}</div>
      </div>
      {score && !off && (
        <div className="shrink-0 flex items-center gap-1.5">
          <span className={`font-black tabular-nums ${inProgress ? 'text-gray-500' : ''}`}>{score}</span>
          <OutcomeChip outcome={g.outcome} className="!px-1.5" />
        </div>
      )}
    </>
  )

  const action = !canWrite || off || (g.tracked && !inProgress) ? null : inProgress ? 'Resume' : 'Track'

  return (
    <>
      {year && (
        <li className="pt-4 pb-1 text-[0.65rem] font-black uppercase tracking-[0.18em] text-gray-400 list-none">{year}</li>
      )}
      <li className="flex items-center gap-2 py-2.5">
        {g.tracked ? (
          <Link href={boxHref} className="flex flex-1 min-w-0 items-center gap-3 rounded-lg -mx-1 px-1 py-1 hover:bg-gray-50">
            {body}
            <span aria-hidden className="text-gray-300 sm:hidden">›</span>
          </Link>
        ) : (
          <div className="flex flex-1 min-w-0 items-center gap-3 py-1">{body}</div>
        )}
        {g.tracked && (
          <Link href={boxHref} className="btn btn-ghost !py-1.5 !px-3 !text-xs shrink-0 hidden sm:inline-flex">
            Box score
          </Link>
        )}
        {action && (
          <Link
            href={`/admin/track/${g.game.id}`}
            className={`btn !py-1.5 !px-3.5 !text-xs shrink-0 ${inProgress ? 'btn-primary' : 'btn-ghost'}`}
          >
            {action}
          </Link>
        )}
      </li>
    </>
  )
}
