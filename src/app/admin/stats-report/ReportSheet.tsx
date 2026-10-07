import Link from 'next/link'
import {
  BENCHMARKS,
  METRICS,
  aggregate,
  byJersey,
  fmtMetric,
  fmtPct,
  fmtRate,
  insights,
  metricValue,
  periodLabel,
  playerLabel,
  playerLines,
  type GameSummary,
  type Insight,
  type MetricKey,
  type PeriodLine,
  type PlayerLine,
  type Rate,
  type StatEvent,
  type StatPlayer,
  type TeamLine,
} from '@/lib/stats'
import { gameDate, opponentLabel, scoreLabel } from './format'
import { PrintNow } from './PrintNow'
import type { SectionKey } from './sections'

/*
 * The stats report on paper: letter, portrait, black on white.
 *
 * It goes to a school laser printer and then into a team meeting, so nothing
 * relies on colour — a good number gets a filled mark and a bad one an open
 * one, rules are hairlines, every number is in tabular figures so columns line
 * up, and each part keeps itself on one page. A full season fits on two.
 *
 * Every number comes from lib/stats; this file only lays them out.
 */

const CSS = `
@page { size: letter portrait; margin: 0.5in; }
.sr { min-height: 100vh; background: #e6e8e6; color: #111; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.sr-bar { position: sticky; top: 0; z-index: 10; display: flex; align-items: center; gap: 12px; padding: 10px 16px;
  background: #fff; border-bottom: 1px solid #d4d8d4; }
.sr-bar a.sr-back { font-weight: 700; font-size: 14px; color: #111; white-space: nowrap; padding: 6px 2px; }
.sr-bar .sr-tip { flex: 1; min-width: 0; font-size: 12px; color: #666; text-align: right; }
.sr-paper { box-sizing: border-box; width: 8.5in; margin: 24px auto 48px; padding: 0.5in; background: #fff;
  box-shadow: 0 1px 2px rgba(0,0,0,.08), 0 8px 28px rgba(0,0,0,.08);
  font-size: 10.5px; line-height: 1.4; font-variant-numeric: tabular-nums; }
@media print {
  html, body { background: #fff !important; }
  body { padding: 0 !important; }
  .safe-top, .sr-bar { display: none !important; }
  .sr { min-height: 0; background: #fff; }
  .sr-paper { width: auto; margin: 0; padding: 0; box-shadow: none; }
}

.sr-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px;
  padding-bottom: 8px; border-bottom: 2.5px solid #111; }
.sr-head h1 { font-size: 17px; font-weight: 900; letter-spacing: -.01em; line-height: 1.15; }
.sr-scope { font-size: 12.5px; font-weight: 700; margin-top: 3px; }
.sr-scope span { font-weight: 500; color: #444; }
.sr-gen { font-size: 8.5px; color: #555; text-align: right; white-space: nowrap; line-height: 1.35; }

.sr-sec { margin-top: 16px; break-inside: avoid; page-break-inside: avoid; }
.sr-sec > h2 { display: flex; justify-content: space-between; align-items: baseline; gap: 12px;
  font-size: 9.5px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase;
  padding-bottom: 3px; border-bottom: 1px solid #111; margin-bottom: 6px; break-after: avoid; }
.sr-sec > h2 small { font-size: 8.5px; font-weight: 500; letter-spacing: .02em; text-transform: none; color: #555; }
.sr-cols { display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr); gap: 0 24px; align-items: start; }

.sr-metrics { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0 18px; }
.sr-metric { padding: 5px 0 6px; border-bottom: .5px solid #999; }
.sr-metric-label { font-size: 8.5px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: #333; }
.sr-metric-value { display: flex; align-items: center; gap: 6px; font-size: 19px; font-weight: 800; line-height: 1.15; margin-top: 1px; }
.sr-metric-sub { font-size: 8.5px; color: #444; }

.sr-mark { display: inline-block; width: 12px; height: 12px; flex: none; vertical-align: -2px; }
.sr-take { list-style: none; padding: 0; margin: 0; }
.sr-take li { display: flex; gap: 7px; align-items: flex-start; padding: 2px 0; font-size: 11px; }
.sr-take li .sr-mark { margin-top: 1.5px; }
.sr-empty { font-size: 10.5px; color: #444; font-style: italic; }

.sr-t { width: 100%; border-collapse: collapse; }
.sr-t th, .sr-t td { padding: 2.5px 6px; text-align: right; white-space: nowrap; }
.sr-t th { font-size: 8px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: #333;
  border-bottom: 1px solid #111; vertical-align: bottom; }
.sr-t td { border-bottom: .5px solid #aaa; }
.sr-t th:first-child, .sr-t td:first-child { text-align: left; padding-left: 0; white-space: normal; }
.sr-t th:last-child, .sr-t td:last-child { padding-right: 0; }
.sr-t tbody tr:last-child td { border-bottom: 0; }
.sr-t tfoot td { border-top: 1px solid #111; border-bottom: 0; font-weight: 800; }
.sr-t .sub { color: #555; font-size: 8.5px; font-weight: 500; margin-left: 4px; }
.sr-t .nil { color: #999; }
.sr-t td.per { color: #555; }
.sr-t .win { font-weight: 800; }
.sr-t .gap td { border-top: 1px solid #111; }
.sr-t td.opp { max-width: 2.2in; overflow: hidden; text-overflow: ellipsis; }

.sr-leaders { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px 18px; }
.sr-board h3 { font-size: 8.5px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase;
  border-bottom: .5px solid #111; padding-bottom: 2px; margin-bottom: 2px; display: flex; justify-content: space-between; }
.sr-board h3 small { font-weight: 500; letter-spacing: 0; text-transform: none; color: #555; }
.sr-board ol { list-style: none; padding: 0; margin: 0; }
.sr-board li { display: flex; gap: 6px; align-items: baseline; padding: 1.5px 0; border-bottom: .5px solid #ccc; }
.sr-board li:last-child { border-bottom: 0; }
.sr-board .who { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sr-board .val { font-weight: 800; }
.sr-board .sub { color: #555; font-size: 8.5px; }

.sr-notes p { white-space: pre-wrap; font-size: 11.5px; line-height: 1.5; margin-bottom: 4px; }
.sr-line { height: 25px; border-bottom: .5px solid #888; }
.sr-msg { margin-top: 24px; padding: 18px 20px; border: 1px solid #111; font-size: 12px; line-height: 1.5; }
.sr-msg strong { display: block; font-size: 13px; margin-bottom: 2px; }
/* One game has to fit one page, and a long season two: tighter rows and gaps. */
.sr-compact .sr-sec { margin-top: 12px; }
.sr-compact .sr-t th, .sr-compact .sr-t td { padding-top: 1.5px; padding-bottom: 1.5px; line-height: 1.25; }
.sr-compact .sr-t td { font-size: 10px; }
.sr-compact .sr-foot { margin-top: 12px; }
.sr-compact .sr-take li { padding: 1px 0; }
.sr-compact .sr-line { height: 23px; }
/* A long table may carry on over the page rather than leave a gap; its
   header repeats and no row is split. */
.sr-sec.sr-flow { break-inside: auto; page-break-inside: auto; }
.sr-t tr { break-inside: avoid; }
.sr-goalie { margin-top: 10px; width: auto; min-width: 60%; break-inside: avoid; }
.sr-foot { margin-top: 18px; padding-top: 5px; border-top: .5px solid #999; font-size: 8px; color: #555;
  display: flex; justify-content: space-between; gap: 16px; break-inside: avoid; }
.sr-foot .sr-mark { width: 9px; height: 9px; vertical-align: -1.5px; }

/* A phone shows the sheet in one column; paper always gets the full layout. */
@media screen and (max-width: 8.9in) {
  .sr-paper { width: auto; margin: 0; padding: 20px 16px 40px; box-shadow: none; overflow-x: auto; }
  .sr-bar .sr-tip { display: none; }
  .sr-bar > :last-child { margin-left: auto; }
  .sr-head { flex-wrap: wrap; align-items: flex-start; }
  .sr-gen { text-align: left; }
  .sr-cols { grid-template-columns: minmax(0, 1fr); }
  .sr-metrics, .sr-leaders { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
`

// ── Bits ──────────────────────────────────────────────────────────────────

/**
 * Good, bad or neither, in a shape rather than a colour: a filled circle with
 * a tick, an open circle with a cross, a small open dot.
 */
function Mark({ tone }: { tone: Insight['tone'] }) {
  if (tone === 'good')
    return (
      <svg className="sr-mark" viewBox="0 0 12 12" role="img" aria-label="good">
        <circle cx="6" cy="6" r="6" fill="#111" />
        <path d="M3.2 6.2l1.9 1.9 3.8-4" stroke="#fff" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  if (tone === 'bad')
    return (
      <svg className="sr-mark" viewBox="0 0 12 12" role="img" aria-label="needs work">
        <circle cx="6" cy="6" r="5.4" fill="none" stroke="#111" strokeWidth="1.2" />
        <path d="M4 4l4 4M8 4l-4 4" stroke="#111" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    )
  return (
    <svg className="sr-mark" viewBox="0 0 12 12" aria-hidden>
      <circle cx="6" cy="6" r="2.4" fill="none" stroke="#111" strokeWidth="1.2" />
    </svg>
  )
}

/** A real minus sign on paper. */
function signed(text: string): string {
  return text.startsWith('-') ? `−${text.slice(1)}` : text
}

function margin(n: number): string {
  return n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0'
}

/** A count; nothing reads as a faint dash so the numbers stand out. */
function Num({ n }: { n: number }) {
  if (!n) return <span className="nil">–</span>
  return <>{Number.isInteger(n) ? n : n.toFixed(1)}</>
}

/** "62% 8/13", or a faint dash with no attempts. */
function RateCell({ r }: { r: Rate }) {
  if (!r.att) return <span className="nil">–</span>
  return (
    <>
      {fmtPct(r)}
      <span className="sub">{fmtRate(r)}</span>
    </>
  )
}

function perGame(n: number, games: number): string {
  return games ? (n / games).toFixed(1) : '–'
}

/** A rate needs this many attempts before it gets a mark — the same bar the takeaways use. */
const ENOUGH = 5

// ── The frame: toolbar, header, footer ─────────────────────────────────────

export function ReportFrame({
  title,
  scope,
  scopeDetail,
  generated,
  backHref,
  backLabel,
  footNote,
  legend,
  compact = false,
  children,
}: {
  title: string
  scope: string
  scopeDetail?: string | null
  generated: string
  backHref: string
  backLabel: string
  footNote: string
  /** Whether the page has good/bad marks to explain. */
  legend: boolean
  /** Tighter rows, for a game that has to fit on one page or a long season on two. */
  compact?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="sr">
      <style>{CSS}</style>
      <div className="sr-bar">
        <Link href={backHref} className="sr-back">
          ← {backLabel}
        </Link>
        <span className="sr-tip">Letter, portrait. For a clean page, switch off headers and footers in the print options.</span>
        <PrintNow />
      </div>
      <article className={compact ? 'sr-paper sr-compact' : 'sr-paper'}>
        <header className="sr-head">
          <div>
            <h1>{title}</h1>
            <div className="sr-scope">
              {scope}
              {scopeDetail && <span> · {scopeDetail}</span>}
            </div>
          </div>
          <div className="sr-gen">
            Generated
            <br />
            {generated}
          </div>
        </header>
        {children}
        <footer className="sr-foot">
          <span>{footNote}</span>
          {legend && (
            <span>
              <Mark tone="good" /> on target or improving · <Mark tone="bad" /> below target or slipping
            </span>
          )}
        </footer>
      </article>
    </div>
  )
}

/** Shown in place of the stats when there is nothing to put on paper. */
export function NothingToReport({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="sr-msg">
      <strong>{title}</strong>
      {children}
    </div>
  )
}

// ── Parts ──────────────────────────────────────────────────────────────────

/** Each headline number, how it was made up, and whether it hits the target. */
function Headline({ games, lines }: { games: number; lines: { us: TeamLine; them: TeamLine } }) {
  return (
    <section className="sr-sec">
      <h2>
        Headline numbers <small>Targets are what a good high school team holds itself to</small>
      </h2>
      <div className="sr-metrics">
        {METRICS.map((m) => {
          const v = metricValue(m.key, { games, lines })
          const bench = BENCHMARKS[m.key]
          const rate = v != null && typeof v === 'object' ? v : null
          const judged = rate && rate.pct != null && bench != null && rate.att >= ENOUGH
          return (
            <div key={m.key} className="sr-metric">
              <div className="sr-metric-label">{m.label}</div>
              <div className="sr-metric-value">
                {signed(fmtMetric(m.key, v))}
                {judged && <Mark tone={rate.pct! >= bench! ? 'good' : 'bad'} />}
              </div>
              <div className="sr-metric-sub">
                {rate
                  ? [rate.att ? fmtRate(rate) : 'none tracked', bench != null ? `target ${fmtPct(bench)}` : null].filter(Boolean).join(' · ')
                  : 'per game'}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function Takeaways({ items, single }: { items: Insight[]; single: boolean }) {
  return (
    <section className="sr-sec">
      <h2>Takeaways</h2>
      {items.length ? (
        <ul className="sr-take">
          {items.map((t, i) => (
            <li key={i}>
              <Mark tone={t.tone} />
              <span>{t.text}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="sr-empty">
          {single
            ? 'Nothing stood out against our targets in this game — or too little was tracked to say.'
            : 'Not enough tracked yet to say anything with confidence. A number needs at least 5 attempts before it’s called out.'}
        </p>
      )}
    </section>
  )
}

type CompareRow =
  | { label: string; kind: 'count'; us: number; them: number; lowerIsBetter?: boolean }
  | { label: string; kind: 'rate'; us: Rate; them: Rate }

const metricLabel = (k: MetricKey) => METRICS.find((m) => m.key === k)?.label ?? k

function compareRows(us: TeamLine, them: TeamLine): CompareRow[] {
  return [
    { label: 'Goals', kind: 'count', us: us.goals, them: them.goals },
    { label: 'Shots', kind: 'count', us: us.shots, them: them.shots },
    { label: metricLabel('shooting'), kind: 'rate', us: us.shooting, them: them.shooting },
    { label: metricLabel('onGoal'), kind: 'rate', us: us.onGoal, them: them.onGoal },
    { label: metricLabel('saving'), kind: 'rate', us: us.saving, them: them.saving },
    { label: 'Ground balls', kind: 'count', us: us.groundBalls, them: them.groundBalls },
    { label: metricLabel('faceoffs'), kind: 'rate', us: us.faceoffs, them: them.faceoffs },
    { label: 'Turnovers', kind: 'count', us: us.turnovers, them: them.turnovers, lowerIsBetter: true },
    { label: 'Caused turnovers', kind: 'count', us: us.causedTurnovers, them: them.causedTurnovers },
    { label: metricLabel('clears'), kind: 'rate', us: us.clears, them: them.clears },
    { label: metricLabel('rides'), kind: 'rate', us: us.rides, them: them.rides },
    { label: 'Penalties', kind: 'count', us: us.penalties, them: them.penalties, lowerIsBetter: true },
    { label: 'Penalty minutes', kind: 'count', us: us.penaltyMinutes, them: them.penaltyMinutes, lowerIsBetter: true },
    { label: metricLabel('manUp'), kind: 'rate', us: us.manUp, them: them.manUp },
  ]
}

/** Which side the row went to, so it can be set in bold. Null for level, or nothing to compare. */
function edge(r: CompareRow): 'us' | 'them' | null {
  if (r.kind === 'rate') {
    if (r.us.pct == null || r.them.pct == null || r.us.pct === r.them.pct) return null
    return r.us.pct > r.them.pct ? 'us' : 'them'
  }
  if (r.us === r.them) return null
  return r.us > r.them !== !!r.lowerIsBetter ? 'us' : 'them'
}

/**
 * Us beside them. Over a stretch of games the counts get a per-game column
 * too; a rate is already per attempt, so it spans both.
 */
function Compare({
  lines,
  games,
  opponent,
}: {
  lines: { us: TeamLine; them: TeamLine }
  /** Null for one game: no per-game columns. */
  games: number | null
  opponent: string
}) {
  const rows = compareRows(lines.us, lines.them)
  const cell = (r: CompareRow, side: 'us' | 'them') => {
    const won = edge(r) === side ? 'win' : undefined
    if (r.kind === 'rate')
      return (
        <td className={won} colSpan={games != null ? 2 : 1}>
          <RateCell r={r[side]} />
        </td>
      )
    return (
      <>
        <td className={won}>
          <Num n={r[side]} />
        </td>
        {games != null && <td className="per">{perGame(r[side], games)}</td>}
      </>
    )
  }
  return (
    <section className="sr-sec">
      <h2>
        {games != null ? 'Team vs opponents' : 'Team vs opponent'} <small>Bold: who had the better of it</small>
      </h2>
      <table className="sr-t">
        <thead>
          <tr>
            <th />
            <th>Green Hope</th>
            {games != null && <th>/ game</th>}
            <th>{opponent}</th>
            {games != null && <th>/ game</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <td>{r.label}</td>
              {cell(r, 'us')}
              {cell(r, 'them')}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

/**
 * Quarter by quarter. Over a stretch: goals and shots for and against with the
 * margin; for one game, the familiar box-score line for each side.
 */
function Quarters({
  periods,
  lines,
  opponent,
  single,
}: {
  periods: PeriodLine[]
  lines: { us: TeamLine; them: TeamLine }
  opponent: string
  single: boolean
}) {
  const rows: { label: string; cells: number[]; total: number; signedNums?: boolean; strong?: boolean; gap?: boolean }[] = single
    ? [
        { label: 'Green Hope', cells: periods.map((p) => p.goalsFor), total: lines.us.goals, strong: true },
        { label: opponent, cells: periods.map((p) => p.goalsAgainst), total: lines.them.goals, strong: true },
        { label: 'Shots — Green Hope', cells: periods.map((p) => p.shotsFor), total: lines.us.shots, gap: true },
        { label: `Shots — ${opponent}`, cells: periods.map((p) => p.shotsAgainst), total: lines.them.shots },
      ]
    : [
        { label: 'Goals for', cells: periods.map((p) => p.goalsFor), total: lines.us.goals },
        { label: 'Goals against', cells: periods.map((p) => p.goalsAgainst), total: lines.them.goals },
        {
          label: 'Margin',
          cells: periods.map((p) => p.goalsFor - p.goalsAgainst),
          total: lines.us.goals - lines.them.goals,
          signedNums: true,
          strong: true,
        },
        { label: 'Shots for', cells: periods.map((p) => p.shotsFor), total: lines.us.shots, gap: true },
        { label: 'Shots against', cells: periods.map((p) => p.shotsAgainst), total: lines.them.shots },
      ]
  return (
    <section className="sr-sec">
      <h2>{single ? 'Score by quarter' : 'By quarter'}</h2>
      <table className="sr-t">
        <thead>
          <tr>
            <th />
            {periods.map((p) => (
              <th key={p.period}>{periodLabel(p.period)}</th>
            ))}
            <th>{single ? 'Final' : 'Total'}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className={r.gap ? 'gap' : undefined}>
              <td className={r.strong ? 'win' : undefined}>{r.label}</td>
              {r.cells.map((n, i) => (
                <td key={i}>{r.signedNums ? margin(n) : n}</td>
              ))}
              <td className="win">{r.signedNums ? margin(r.total) : r.total}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

interface Board {
  title: string
  note?: string
  rows: { id: string; value: string; sub?: string }[]
}

/**
 * The top five in each thing worth a mention. The percentage boards only
 * count someone with a real share of the work, so a long pole who took one
 * faceoff and won it isn't top of the faceoff list.
 */
function leaderBoards(players: PlayerLine[], lines: { us: TeamLine; them: TeamLine }, who: Map<string, StatPlayer>): Board[] {
  const jersey = (a: PlayerLine, b: PlayerLine) => {
    const pa = who.get(a.playerId)
    const pb = who.get(b.playerId)
    return pa && pb ? byJersey(pa, pb) : a.playerId.localeCompare(b.playerId)
  }
  const top = (list: PlayerLine[], score: (l: PlayerLine) => number, then?: (l: PlayerLine) => number) =>
    list
      .filter((l) => score(l) > 0)
      .sort((a, b) => score(b) - score(a) || (then ? then(b) - then(a) : 0) || jersey(a, b))
      .slice(0, 5)

  const foMin = Math.max(ENOUGH, Math.ceil(lines.us.faceoffs.att * 0.1))
  const svMin = Math.max(ENOUGH, Math.ceil(lines.us.saving.att * 0.1))
  const pct = (r: Rate) => r.pct ?? 0

  return [
    {
      title: 'Points',
      rows: top(players, (l) => l.points, (l) => l.goals).map((l) => ({ id: l.playerId, value: String(l.points), sub: `${l.goals}G ${l.assists}A` })),
    },
    {
      title: 'Goals',
      rows: top(players, (l) => l.goals, (l) => pct(l.shooting)).map((l) => ({ id: l.playerId, value: String(l.goals), sub: `${fmtPct(l.shooting)} sh` })),
    },
    { title: 'Assists', rows: top(players, (l) => l.assists).map((l) => ({ id: l.playerId, value: String(l.assists) })) },
    { title: 'Ground balls', rows: top(players, (l) => l.groundBalls).map((l) => ({ id: l.playerId, value: String(l.groundBalls) })) },
    {
      title: 'Caused turnovers',
      rows: top(players, (l) => l.causedTurnovers).map((l) => ({ id: l.playerId, value: String(l.causedTurnovers) })),
    },
    {
      title: 'Faceoff %',
      note: `${foMin}+ taken`,
      rows: top(
        players.filter((l) => l.faceoffs.att >= foMin),
        (l) => pct(l.faceoffs) + 1e-9, // a man who won none still ranks, behind the rest
        (l) => l.faceoffs.att,
      ).map((l) => ({ id: l.playerId, value: fmtPct(l.faceoffs), sub: fmtRate(l.faceoffs) })),
    },
    {
      title: 'Save %',
      note: `${svMin}+ faced`,
      rows: top(
        players.filter((l) => l.saving.att >= svMin),
        (l) => pct(l.saving) + 1e-9,
        (l) => l.saving.att,
      ).map((l) => ({ id: l.playerId, value: fmtPct(l.saving), sub: fmtRate(l.saving) })),
    },
  ]
}

function Leaders({ players, lines, who }: { players: PlayerLine[]; lines: { us: TeamLine; them: TeamLine }; who: Map<string, StatPlayer> }) {
  const boards = leaderBoards(players, lines, who)
  return (
    <section className="sr-sec">
      <h2>Leaders</h2>
      <div className="sr-leaders">
        {boards.map((b) => (
          <div key={b.title} className="sr-board">
            <h3>
              {b.title}
              {b.note && <small>{b.note}</small>}
            </h3>
            {b.rows.length ? (
              <ol>
                {b.rows.map((r) => (
                  <li key={r.id}>
                    <span className="who">{playerLabel(who.get(r.id), true)}</span>
                    {r.sub && <span className="sub">{r.sub}</span>}
                    <span className="val">{r.value}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="sr-empty">None yet</p>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

/** One line per game, oldest first, with the stretch's totals underneath. */
function GameByGame({ games, lines }: { games: GameSummary[]; lines: { us: TeamLine; them: TeamLine } }) {
  const gb = (l: { us: TeamLine; them: TeamLine }) => signed(fmtMetric('gbMargin', metricValue('gbMargin', { games: 1, lines: l })))
  const anyConf = games.some((g) => g.game.is_conference)
  return (
    <section className="sr-sec">
      <h2>
        Game by game {anyConf && <small>* conference</small>}
      </h2>
      <table className="sr-t">
        <thead>
          <tr>
            <th>Date</th>
            <th style={{ textAlign: 'left' }}>Opponent</th>
            <th>Result</th>
            <th>Shooting</th>
            <th>Clears</th>
            <th>Faceoffs</th>
            <th>GB +/−</th>
            <th>TO</th>
          </tr>
        </thead>
        <tbody>
          {games.map((g) => (
            <tr key={g.game.id}>
              <td>{gameDate(g)}</td>
              <td className="opp" style={{ textAlign: 'left' }}>
                {opponentLabel(g)}
                {g.game.is_conference && ' *'}
              </td>
              <td>
                <b>{g.outcome ?? ''}</b> {scoreLabel(g) ?? '–'}
              </td>
              <td>
                <RateCell r={g.lines.us.shooting} />
              </td>
              <td>
                <RateCell r={g.lines.us.clears} />
              </td>
              <td>
                <RateCell r={g.lines.us.faceoffs} />
              </td>
              <td>{gb(g.lines)}</td>
              <td>{g.lines.us.turnovers}</td>
            </tr>
          ))}
        </tbody>
        {games.length > 1 && (
          <tfoot>
            <tr>
              <td colSpan={2}>Total</td>
              <td>
                {lines.us.goals}–{lines.them.goals}
              </td>
              <td>
                <RateCell r={lines.us.shooting} />
              </td>
              <td>
                <RateCell r={lines.us.clears} />
              </td>
              <td>
                <RateCell r={lines.us.faceoffs} />
              </td>
              <td>{gb(lines)}</td>
              <td>{lines.us.turnovers}</td>
            </tr>
          </tfoot>
        )}
      </table>
    </section>
  )
}

/**
 * One game's players: the field line for everyone who did something, the
 * team's total underneath (which also catches anything logged without a
 * name), then the goalie.
 */
function PlayerLines({ players, lines, who, opponent }: { players: PlayerLine[]; lines: { us: TeamLine; them: TeamLine }; who: Map<string, StatPlayer>; opponent: string }) {
  const field = players
    .filter((l) => l.goals + l.assists + l.shots + l.groundBalls + l.turnovers + l.causedTurnovers + l.faceoffs.att + l.penalties > 0)
    .sort((a, b) => {
      const pa = who.get(a.playerId)
      const pb = who.get(b.playerId)
      return b.points - a.points || b.goals - a.goals || b.groundBalls - a.groundBalls || (pa && pb ? byJersey(pa, pb) : 0)
    })
  const goalies = players.filter((l) => l.saving.att > 0).sort((a, b) => b.saving.att - a.saving.att)
  const us = lines.us
  return (
    <section className="sr-sec sr-flow">
      <h2>Player lines</h2>
      <table className="sr-t">
        <thead>
          <tr>
            <th>Player</th>
            <th>G</th>
            <th>A</th>
            <th>Pts</th>
            <th>Shots</th>
            <th>SOG</th>
            <th>GB</th>
            <th>CT</th>
            <th>TO</th>
            <th>Faceoffs</th>
            <th>PIM</th>
          </tr>
        </thead>
        <tbody>
          {field.map((l) => (
            <tr key={l.playerId}>
              <td>{playerLabel(who.get(l.playerId), true)}</td>
              <td>
                <Num n={l.goals} />
              </td>
              <td>
                <Num n={l.assists} />
              </td>
              <td className="win">
                <Num n={l.points} />
              </td>
              <td>
                <Num n={l.shots} />
              </td>
              <td>
                <Num n={l.shotsOnGoal} />
              </td>
              <td>
                <Num n={l.groundBalls} />
              </td>
              <td>
                <Num n={l.causedTurnovers} />
              </td>
              <td>
                <Num n={l.turnovers} />
              </td>
              <td>{l.faceoffs.att ? fmtRate(l.faceoffs) : <span className="nil">–</span>}</td>
              <td>
                <Num n={l.penaltyMinutes} />
              </td>
            </tr>
          ))}
          {!field.length && (
            <tr>
              <td colSpan={11} className="sr-empty">
                Nothing was logged against a player’s name.
              </td>
            </tr>
          )}
        </tbody>
        <tfoot>
          <tr>
            <td>Team</td>
            <td>{us.goals}</td>
            <td>{us.assists}</td>
            <td>{us.goals + us.assists}</td>
            <td>{us.shots}</td>
            <td>{us.shotsOnGoal}</td>
            <td>{us.groundBalls}</td>
            <td>{us.causedTurnovers}</td>
            <td>{us.turnovers}</td>
            <td>{us.faceoffs.att ? fmtRate(us.faceoffs) : '–'}</td>
            <td>{Number.isInteger(us.penaltyMinutes) ? us.penaltyMinutes : us.penaltyMinutes.toFixed(1)}</td>
          </tr>
        </tfoot>
      </table>

      <table className="sr-t sr-goalie">
        <thead>
          <tr>
            <th>Goalie</th>
            <th>Saves</th>
            <th>Goals against</th>
            <th>Shots on goal faced</th>
            <th>Save %</th>
          </tr>
        </thead>
        <tbody>
          {goalies.map((l) => (
            <tr key={l.playerId}>
              <td>{playerLabel(who.get(l.playerId), true)}</td>
              <td>{l.saves}</td>
              <td>{l.goalsAgainst}</td>
              <td>{l.saving.att}</td>
              <td className="win">{fmtPct(l.saving)}</td>
            </tr>
          ))}
          {!goalies.length && (
            <tr>
              <td colSpan={5} className="sr-empty">
                No goalie was logged for {opponent}’s shots.
              </td>
            </tr>
          )}
        </tbody>
        {goalies.length !== 1 || goalies[0].saving.att !== us.saving.att ? (
          <tfoot>
            <tr>
              <td>Team</td>
              <td>{us.saving.made}</td>
              <td>{us.goalsAgainst}</td>
              <td>{us.saving.att}</td>
              <td>{fmtPct(us.saving)}</td>
            </tr>
          </tfoot>
        ) : null}
      </table>
    </section>
  )
}

/** The coach's notes, then lines to write on — more of them when there are no notes. */
function Notes({ notes, lines = 7 }: { notes: string; lines?: number }) {
  return (
    <section className="sr-sec sr-notes">
      <h2>Coach’s notes</h2>
      {notes && <p>{notes}</p>}
      {Array.from({ length: notes ? 3 : lines }, (_, i) => (
        <div key={i} className="sr-line" />
      ))}
    </section>
  )
}

// ── The two reports ────────────────────────────────────────────────────────

/** A stretch of games: the season, the last five, the conference games … */
export function SeasonBody({
  games,
  events,
  who,
  sections,
  notes,
}: {
  /** Tracked games only, oldest first (filterGames). */
  games: GameSummary[]
  events: StatEvent[]
  who: Map<string, StatPlayer>
  sections: SectionKey[]
  notes: string
}) {
  const all = aggregate(games, events)
  const on = (k: SectionKey) => sections.includes(k)
  const parts: Record<SectionKey, React.ReactNode> = {
    headline: <Headline games={all.games} lines={all.lines} />,
    takeaways: <Takeaways items={insights(games, events)} single={false} />,
    compare: <Compare lines={all.lines} games={all.games} opponent="Opponents" />,
    quarters: <Quarters periods={all.periods} lines={all.lines} opponent="Opponents" single={false} />,
    leaders: <Leaders players={all.players} lines={all.lines} who={who} />,
    games: <GameByGame games={games} lines={all.lines} />,
    players: null,
    notes: <Notes notes={notes} lines={games.length > 20 ? 4 : 7} />,
  }
  return <Body sections={sections.filter(on)} parts={parts} columns={[['compare'], ['quarters']]} />
}

/** One game, as a box score. */
export function GameBody({
  game,
  events,
  who,
  sections,
  notes,
}: {
  game: GameSummary
  /** This game's events (or more; only this game's are used). */
  events: StatEvent[]
  who: Map<string, StatPlayer>
  sections: SectionKey[]
  notes: string
}) {
  const mine = events.filter((e) => e.game_id === game.game.id)
  const opponent = game.game.opponent || 'Opponent'
  const parts: Record<SectionKey, React.ReactNode> = {
    quarters: <Quarters periods={game.periods} lines={game.lines} opponent={opponent} single />,
    takeaways: <Takeaways items={insights([game], mine)} single />,
    compare: <Compare lines={game.lines} games={null} opponent={opponent} />,
    players: <PlayerLines players={playerLines(mine)} lines={game.lines} who={who} opponent={opponent} />,
    notes: <Notes notes={notes} lines={3} />,
    headline: null,
    leaders: null,
    games: null,
  }
  return <Body sections={sections} parts={parts} columns={[['quarters', 'takeaways'], ['compare']]} />
}

/**
 * The chosen parts in order, with some set in two columns when they are
 * there: each is narrow on its own, and side by side they keep a season on
 * two pages and a game on one. The columns land where the first of them would
 * have; with only one side ticked, everything prints full width.
 */
function Body({
  sections,
  parts,
  columns,
}: {
  sections: SectionKey[]
  parts: Record<SectionKey, React.ReactNode>
  columns: [SectionKey[], SectionKey[]]
}) {
  const [left, right] = columns.map((c) => c.filter((k) => sections.includes(k)))
  const paired = left.length > 0 && right.length > 0
  const out: React.ReactNode[] = []
  let placed = false
  for (const k of sections) {
    if (paired && (left.includes(k) || right.includes(k))) {
      if (!placed)
        out.push(
          <div key="cols" className="sr-cols">
            <div>{left.map((c) => <div key={c}>{parts[c]}</div>)}</div>
            <div>{right.map((c) => <div key={c}>{parts[c]}</div>)}</div>
          </div>,
        )
      placed = true
      continue
    }
    out.push(<div key={k}>{parts[k]}</div>)
  }
  return <>{out}</>
}
