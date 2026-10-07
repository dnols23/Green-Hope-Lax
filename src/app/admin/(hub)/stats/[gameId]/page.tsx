import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireSection } from '@/lib/permissions'
import { canTeam } from '@/lib/sections'
import { getStatGame, loadSeason, playerMap } from '@/lib/statsData'
import {
  byJersey,
  describeEvent,
  fmtPct,
  fmtRate,
  periodLabel,
  playerLabel,
  playerLines,
  teamLines,
  type GameSummary,
  type PlayerLine,
  type Rate,
  type StatEvent,
  type StatPlayer,
  type TeamLine,
} from '@/lib/stats'
import { withTeam } from '@/lib/teams'
import { StatsTabs } from '../StatsTabs'
import { OutcomeChip, US, longDate, siteLabel, vsAt } from '../gameBits'

export const metadata = { title: 'Box score' }
export const dynamic = 'force-dynamic'

/** Calm little heading over each part of the page. */
function Label({ children }: { children: React.ReactNode }) {
  return <h2 className="text-[0.65rem] font-black uppercase tracking-[0.18em] text-gray-400 mb-2">{children}</h2>
}

/**
 * One game, everything about it: where he lands after "Finish game", and the
 * page he pulls up on Monday before film.
 */
export default async function BoxScorePage({ params }: { params: Promise<{ gameId: string }> }) {
  const viewer = await requireSection('stats')
  const game = await getStatGame((await params).gameId)
  if (!game) notFound()
  const team = game.level
  const canWrite = canTeam(viewer, team)

  /* Through the season, so this box score is the very summary the Games list
     and the analysis use, and players who have since left the team still have
     their names. A game that isn't one of this team's boys' games isn't here. */
  const season = await loadSeason(team)
  const s = season.games.find((g) => g.game.id === game.id)
  if (!s) notFound()
  const events = season.events.filter((e) => e.game_id === game.id)
  const players = playerMap(season.players)
  const trackHref = `/admin/track/${game.id}`

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <StatsTabs team={team} active="games" />
        <Link href={withTeam('/admin/stats', team)} className="text-sm font-semibold text-gray-500 hover:text-gray-900">
          ← All games
        </Link>
      </div>

      <Header s={s} />

      <div className="flex flex-wrap gap-2 -mt-4">
        {/* An untracked game's Track button lives in the empty state below. */}
        {canWrite && s.tracked && (
          <Link href={trackHref} className="btn btn-primary">
            Resume tracking
          </Link>
        )}
        <Link href={withTeam('/admin/stats/analysis', team)} className="btn btn-ghost">
          Analysis →
        </Link>
        {s.tracked && (
          <a href={`/admin/stats-report?game=${game.id}`} className="btn btn-ghost">
            Print game report
          </a>
        )}
      </div>

      {!s.tracked ? (
        <div className="card p-6 sm:p-8 text-center">
          <p className="font-black text-lg">No stats for this game yet</p>
          <p className="text-sm text-gray-500 mt-1 max-w-sm mx-auto">
            {canWrite
              ? 'Open the tracker on your phone at the field and tap each shot, ground ball and faceoff as it happens. The box score fills in here.'
              : 'Nobody tracked this one. Once the staff does, the box score shows up here.'}
          </p>
          {canWrite && game.status !== 'canceled' && (
            <Link href={trackHref} className="btn btn-primary mt-4 !px-8 !py-3 !text-base">
              Track this game
            </Link>
          )}
        </div>
      ) : (
        <>
          <TeamComparison us={s.lines.us} them={s.lines.them} opponent={game.opponent} />
          <ByQuarter s={s} opponent={game.opponent} />
          <Players events={events} players={players} />
          <PlayByPlay events={events} players={players} />
        </>
      )}
    </div>
  )
}

// ── Header ──────────────────────────────────────────────────────────────────

function Header({ s }: { s: GameSummary }) {
  const g = s.game
  const final = g.status === 'final'
  const hasScore = s.goalsFor != null && s.goalsAgainst != null
  const state =
    g.status === 'postponed' ? 'Postponed' : g.status === 'canceled' ? 'Canceled' : final ? 'Final' : s.tracked ? 'In progress' : 'No result yet'
  const ink = (mine: number | null, theirs: number | null) =>
    mine != null && theirs != null && mine < theirs ? 'text-gray-400' : ''

  return (
    <header className="card p-5 sm:p-6">
      <div className="text-xs text-gray-500 flex flex-wrap gap-x-2 gap-y-0.5">
        <span>{longDate(g.game_date)}</span>
        <span aria-hidden className="text-gray-300">·</span>
        <span>{siteLabel(g)}</span>
        {g.is_conference && (
          <>
            <span aria-hidden className="text-gray-300">·</span>
            <span>Conference</span>
          </>
        )}
      </div>
      <h1 className="text-2xl sm:text-3xl font-black tracking-tight mt-1 break-words">
        <span className="text-gray-400 font-bold">{vsAt(g)}</span> {g.opponent}
      </h1>

      {hasScore && (
        <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3 mt-5">
          <div className="min-w-0">
            <div className="text-xs font-bold uppercase tracking-wide text-[var(--gh-green)] truncate">{US}</div>
            <div className={`text-5xl sm:text-6xl font-black tabular-nums leading-none mt-1 ${ink(s.goalsFor, s.goalsAgainst)}`}>
              {s.goalsFor}
            </div>
          </div>
          <div className="pb-1 text-center">
            <OutcomeChip outcome={s.outcome} />
          </div>
          <div className="min-w-0 text-right">
            <div className="text-xs font-bold uppercase tracking-wide text-gray-500 truncate">{g.opponent}</div>
            <div className={`text-5xl sm:text-6xl font-black tabular-nums leading-none mt-1 ${ink(s.goalsAgainst, s.goalsFor)}`}>
              {s.goalsAgainst}
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 text-xs font-bold uppercase tracking-wide">
        <span className={state === 'In progress' ? 'text-[var(--gh-maroon)]' : 'text-gray-500'}>{state}</span>
        {hasScore && !s.tracked && <span className="text-gray-400 normal-case tracking-normal font-semibold"> · score from the schedule</span>}
      </div>
    </header>
  )
}

// ── Team comparison ─────────────────────────────────────────────────────────

/** One side's figure on a row: the number, and the made/attempts under a rate. */
interface Cell {
  main: string
  sub?: string
}

interface CompareRow {
  label: string
  cell: (l: TeamLine) => Cell
  /** What decides who "won" the row; null when there's nothing to compare. */
  value: (l: TeamLine) => number | null
  lowerIsBetter?: boolean
  /** Left out when neither side has anything (no penalties, no man-up chances). */
  optional?: (us: TeamLine, them: TeamLine) => boolean
}

const count = (n: number): Cell => ({ main: String(n) })
const pct = (r: Rate): Cell => ({ main: fmtPct(r), sub: r.att ? fmtRate(r) : undefined })

const ROWS: CompareRow[] = [
  { label: 'Goals', cell: (l) => count(l.goals), value: (l) => l.goals },
  { label: 'Shots', cell: (l) => count(l.shots), value: (l) => l.shots },
  { label: 'Shots on goal', cell: (l) => count(l.shotsOnGoal), value: (l) => l.shotsOnGoal },
  { label: 'Shooting %', cell: (l) => pct(l.shooting), value: (l) => l.shooting.pct },
  { label: 'Ground balls', cell: (l) => count(l.groundBalls), value: (l) => l.groundBalls },
  {
    label: 'Faceoffs',
    cell: (l) => ({ main: `${l.faceoffs.made}–${l.faceoffs.att - l.faceoffs.made}`, sub: l.faceoffs.att ? fmtPct(l.faceoffs) : undefined }),
    value: (l) => l.faceoffs.pct,
  },
  { label: 'Turnovers', cell: (l) => count(l.turnovers), value: (l) => l.turnovers, lowerIsBetter: true },
  { label: 'Caused turnovers', cell: (l) => count(l.causedTurnovers), value: (l) => l.causedTurnovers },
  { label: 'Clearing', cell: (l) => pct(l.clears), value: (l) => l.clears.pct },
  { label: 'Riding', cell: (l) => pct(l.rides), value: (l) => l.rides.pct },
  { label: 'Saves', cell: (l) => count(l.saving.made), value: (l) => l.saving.made },
  { label: 'Save %', cell: (l) => pct(l.saving), value: (l) => l.saving.pct },
  {
    label: 'Penalties',
    cell: (l) => ({ main: String(l.penalties), sub: l.penalties ? `${l.penaltyMinutes} min` : undefined }),
    // Minutes are what cost you; with no minutes logged, the count decides.
    value: (l) => l.penaltyMinutes * 100 + l.penalties,
    lowerIsBetter: true,
  },
  { label: 'Man-up', cell: (l) => pct(l.manUp), value: (l) => l.manUp.pct, optional: (u, t) => u.manUp.att + t.manUp.att > 0 },
  { label: 'Man-down', cell: (l) => pct(l.manDown), value: (l) => l.manDown.pct, optional: (u, t) => u.manDown.att + t.manDown.att > 0 },
]

/**
 * Green Hope on the left, them on the right, the stat between — the way a
 * broadcast shows it. The side that won each row is in full ink; the other
 * fades back, so the story reads at a glance.
 */
function TeamComparison({ us, them, opponent }: { us: TeamLine; them: TeamLine; opponent: string }) {
  const rows = ROWS.filter((r) => !r.optional || r.optional(us, them))
  return (
    <section>
      <Label>Team stats</Label>
      <div className="card px-4 sm:px-6 py-2">
        <div className="grid grid-cols-[1fr_auto_1fr] gap-x-3 py-2 border-b border-gray-100 text-xs font-bold uppercase tracking-wide">
          <span className="text-[var(--gh-green)] truncate">{US}</span>
          <span />
          <span className="text-gray-500 text-right truncate">{opponent}</span>
        </div>
        <div className="divide-y divide-gray-100">
          {rows.map((r) => {
            const a = r.value(us)
            const b = r.value(them)
            const lead = a == null || b == null || a === b ? 0 : (a > b) !== !!r.lowerIsBetter ? 1 : -1
            const left = r.cell(us)
            const right = r.cell(them)
            return (
              <div key={r.label} className="grid grid-cols-[1fr_auto_1fr] items-center gap-x-3 py-2.5">
                <Side cell={left} lead={lead === 1} dim={lead === -1} />
                <span className="text-sm text-gray-500 text-center whitespace-nowrap">{r.label}</span>
                <Side cell={right} lead={lead === -1} dim={lead === 1} right />
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function Side({ cell, lead, dim, right = false }: { cell: Cell; lead: boolean; dim: boolean; right?: boolean }) {
  return (
    <div className={`tabular-nums leading-tight ${right ? 'text-right' : ''}`}>
      <span className={`text-lg ${lead ? 'font-black text-gray-900' : dim ? 'font-semibold text-gray-400' : 'font-bold text-gray-700'}`}>
        {cell.main}
      </span>
      {cell.sub && <span className="block text-xs text-gray-400">{cell.sub}</span>}
    </div>
  )
}

// ── By quarter ──────────────────────────────────────────────────────────────

/** The line score: goals and shots per quarter, overtime if there was any. */
function ByQuarter({ s, opponent }: { s: GameSummary; opponent: string }) {
  const periods = s.periods
  const block = (title: string, ours: (p: (typeof periods)[number]) => number, theirs: (p: (typeof periods)[number]) => number, totals: [number, number]) => (
    <>
      <tr>
        <th colSpan={periods.length + 2} className="pt-4 pb-1 text-left text-[0.65rem] font-black uppercase tracking-[0.14em] text-gray-400">
          {title}
        </th>
      </tr>
      {[
        { key: 'us', name: US, cls: 'text-[var(--gh-green)]', get: ours, total: totals[0] },
        { key: 'them', name: opponent, cls: 'text-gray-500', get: theirs, total: totals[1] },
      ].map((side) => (
        <tr key={side.key} className="border-t border-gray-100">
          <th scope="row" className={`py-2 pr-3 text-left text-sm font-bold truncate max-w-[8rem] sm:max-w-[12rem] ${side.cls}`}>
            {side.name}
          </th>
          {periods.map((p) => (
            <td key={p.period} className="py-2 px-1 text-center tabular-nums text-gray-700">
              {side.get(p)}
            </td>
          ))}
          <td className="py-2 pl-2 text-center tabular-nums font-black">{side.total}</td>
        </tr>
      ))}
    </>
  )
  return (
    <section>
      <Label>By quarter</Label>
      <div className="card px-4 sm:px-6 pb-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="pt-3 text-left" />
              {periods.map((p) => (
                <th key={p.period} scope="col" className="pt-3 px-1 text-center text-xs font-bold text-gray-400 w-10">
                  {periodLabel(p.period)}
                </th>
              ))}
              <th scope="col" className="pt-3 pl-2 text-center text-xs font-black text-gray-500 w-10">
                T
              </th>
            </tr>
          </thead>
          <tbody>
            {block('Goals', (p) => p.goalsFor, (p) => p.goalsAgainst, [s.lines.us.goals, s.lines.them.goals])}
            {block('Shots', (p) => p.shotsFor, (p) => p.shotsAgainst, [s.lines.us.shots, s.lines.them.shots])}
          </tbody>
        </table>
      </div>
    </section>
  )
}

// ── Players ─────────────────────────────────────────────────────────────────

const name = (p: StatPlayer | undefined) => (p ? playerLabel({ ...p, number: null }, true) : 'Unknown')

/** Points, then goals, then jersey order. */
function byPoints(players: Map<string, StatPlayer>) {
  return (a: PlayerLine, b: PlayerLine) => {
    if (b.points !== a.points) return b.points - a.points
    if (b.goals !== a.goals) return b.goals - a.goals
    const pa = players.get(a.playerId)
    const pb = players.get(b.playerId)
    return pa && pb ? byJersey(pa, pb) : pa ? -1 : pb ? 1 : 0
  }
}

const FIELD_COLS: { key: string; label: string; title: string; get: (l: PlayerLine) => string; strong?: boolean }[] = [
  { key: 'g', label: 'G', title: 'Goals', get: (l) => String(l.goals) },
  { key: 'a', label: 'A', title: 'Assists', get: (l) => String(l.assists) },
  { key: 'pts', label: 'Pts', title: 'Points', get: (l) => String(l.points), strong: true },
  { key: 'sh', label: 'Sh', title: 'Shots', get: (l) => String(l.shots) },
  { key: 'sog', label: 'SOG', title: 'Shots on goal', get: (l) => String(l.shotsOnGoal) },
  { key: 'gb', label: 'GB', title: 'Ground balls', get: (l) => String(l.groundBalls) },
  { key: 'to', label: 'TO', title: 'Turnovers', get: (l) => String(l.turnovers) },
  { key: 'ct', label: 'CT', title: 'Caused turnovers', get: (l) => String(l.causedTurnovers) },
  { key: 'fo', label: 'FO', title: 'Faceoffs won–lost', get: (l) => (l.faceoffs.att ? `${l.faceoffs.made}–${l.faceoffs.att - l.faceoffs.made}` : '') },
  { key: 'pen', label: 'Pen', title: 'Penalties (minutes)', get: (l) => (l.penalties ? `${l.penalties} (${l.penaltyMinutes}m)` : '') },
]

/**
 * Our players who show up in this game. On a phone the table slides sideways
 * inside its own box with the name pinned, so the page itself never does.
 */
function Players({ events, players }: { events: StatEvent[]; players: Map<string, StatPlayer> }) {
  const lines = playerLines(events)
  const sort = byPoints(players)
  const field = lines
    .filter(
      (l) =>
        l.goals + l.assists + l.shots + l.groundBalls + l.turnovers + l.causedTurnovers + l.faceoffs.att + l.penalties > 0,
    )
    .sort(sort)
  const goalies = lines.filter((l) => l.saves + l.goalsAgainst > 0).sort((a, b) => b.saves + b.goalsAgainst - (a.saves + a.goalsAgainst))
  if (!field.length && !goalies.length) return null

  const sticky = 'sticky left-0 z-10 bg-[var(--surface)] shadow-[1px_0_0_var(--border)]'
  const nameCell = (l: PlayerLine) => {
    const p = players.get(l.playerId)
    return (
      <th scope="row" className={`${sticky} py-2 pl-4 pr-3 text-left font-semibold whitespace-nowrap`}>
        <span className="inline-block w-7 text-xs font-black tabular-nums text-[var(--gh-green)]">{p?.number ?? ''}</span>
        {name(p)}
      </th>
    )
  }
  const headName = (
    <th scope="col" className={`${sticky} py-2 pl-4 pr-3 text-left`}>
      <span className="inline-block w-7">#</span>Player
    </th>
  )
  const th = 'py-2 px-2.5 text-center text-[0.65rem] font-black uppercase tracking-wider text-gray-400 whitespace-nowrap'
  const td = 'py-2 px-2.5 text-center tabular-nums whitespace-nowrap'

  return (
    <section className="space-y-4">
      {field.length > 0 && (
        <div>
          <Label>Players</Label>
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-100 text-[0.65rem] font-black uppercase tracking-wider text-gray-400">
                  <tr>
                    {headName}
                    {FIELD_COLS.map((c) => (
                      <th key={c.key} scope="col" className={th}>
                        <abbr title={c.title} className="no-underline">{c.label}</abbr>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {field.map((l) => (
                    <tr key={l.playerId}>
                      {nameCell(l)}
                      {FIELD_COLS.map((c) => {
                        const v = c.get(l)
                        return (
                          <td key={c.key} className={`${td} ${c.strong ? 'font-black' : v === '0' || !v ? 'text-gray-300' : 'text-gray-700'}`}>
                            {v || '–'}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {goalies.length > 0 && (
        <div>
          <Label>{goalies.length === 1 ? 'Goalie' : 'Goalies'}</Label>
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-100 text-[0.65rem] font-black uppercase tracking-wider text-gray-400">
                  <tr>
                    {headName}
                    <th scope="col" className={th}><abbr title="Saves" className="no-underline">Sv</abbr></th>
                    <th scope="col" className={th}><abbr title="Goals against" className="no-underline">GA</abbr></th>
                    <th scope="col" className={th}><abbr title="Save percentage" className="no-underline">Sv%</abbr></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {goalies.map((l) => (
                    <tr key={l.playerId}>
                      {nameCell(l)}
                      <td className={`${td} text-gray-700`}>{l.saves}</td>
                      <td className={`${td} text-gray-700`}>{l.goalsAgainst}</td>
                      <td className={`${td} font-black`}>{fmtPct(l.saving)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

// ── Play-by-play ────────────────────────────────────────────────────────────

/** The whole log, quarter by quarter, tucked away until he wants it. */
function PlayByPlay({ events, players }: { events: StatEvent[]; players: Map<string, StatPlayer> }) {
  const ordered = [...events].sort((a, b) => a.seq - b.seq)
  // The score after each goal, from the same math as everything else.
  const scoreAfter = new Map<string, string>()
  ordered.forEach((e, i) => {
    if (e.kind === 'shot' && e.result === 'goal') {
      const { us, them } = teamLines(ordered.slice(0, i + 1))
      scoreAfter.set(e.id, `${us.goals}–${them.goals}`)
    }
  })
  const periods = [...new Set(ordered.map((e) => e.period))].sort((a, b) => a - b)

  return (
    <section>
      <details className="card">
        <summary className="cursor-pointer list-none flex items-center gap-2 px-4 sm:px-6 py-3.5 font-bold text-gray-700">
          <span className="caret text-sm">▸</span> Play-by-play
          <span className="font-normal text-sm text-gray-400 tabular-nums">{ordered.length}</span>
        </summary>
        <div className="px-4 sm:px-6 pb-4 space-y-4 border-t border-gray-100">
          {periods.map((p) => (
            <div key={p}>
              <h3 className="pt-4 pb-1 text-[0.65rem] font-black uppercase tracking-[0.18em] text-gray-400">{periodLabel(p)}</h3>
              <ol className="space-y-0.5">
                {ordered
                  .filter((e) => e.period === p)
                  .map((e) => {
                    const goal = scoreAfter.get(e.id)
                    return (
                      <li key={e.id} className="flex items-baseline gap-2.5 text-sm py-0.5">
                        <span
                          aria-hidden
                          className={`h-1.5 w-1.5 shrink-0 rounded-full translate-y-[-1px] ${e.side === 'us' ? 'bg-[var(--gh-green)]' : 'bg-gray-300'}`}
                        />
                        <span className={`min-w-0 flex-1 ${goal ? 'font-bold' : e.side === 'us' ? 'text-gray-800' : 'text-gray-500'}`}>
                          {describeEvent(e, players)}
                        </span>
                        {goal && <span className="shrink-0 font-black tabular-nums">{goal}</span>}
                      </li>
                    )
                  })}
              </ol>
            </div>
          ))}
        </div>
      </details>
    </section>
  )
}
