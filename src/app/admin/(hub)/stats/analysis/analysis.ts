// The Analysis page's own arithmetic: the few per-game readings stats.ts
// doesn't already make (rolling averages, who scored first, records split by
// how a game went, chart scales), each built from stats.ts's numbers so this
// page can never disagree with the box score or the report.
//
// Pure, no React and no database: the page calls these on the server and
// hands plain objects to the client pieces, and a quick script can call them
// in plain Node. Nothing here divides by zero — an empty split comes back as
// null and is shown as "—" or left out, never as NaN or "Infinity%".

import {
  BENCHMARKS,
  METRICS,
  SHOT_LABELS,
  aggregate,
  fmtMetric,
  fmtPct,
  fmtRate,
  metricNumber,
  metricValue,
  playerLabel,
  recordOf,
  periodLabel,
  type GameSummary,
  type Insight,
  type MetricKey,
  type PlayerLine,
  type Rate,
  type ShotResult,
  type StatEvent,
  type StatPlayer,
  type TeamLine,
} from '@/lib/stats'

/** A rate is only judged against its target once it has this many attempts (the same bar insights() uses). */
export const MIN_ATTEMPTS = 5

/** Games in the rolling average. */
export const ROLLING_WINDOW = 3

export function isMetricKey(v: unknown): v is MetricKey {
  return METRICS.some((m) => m.key === v)
}

/** "7–3" with a proper dash, from the shared record. */
export function recordText(games: GameSummary[]): string {
  return recordOf(games).label.replace(/-/g, '–')
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "2026-03-14" → "Mar 14". Read straight off the string so no time zone can move the day. */
export function shortDate(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd)
  if (!m) return ymd
  const month = MONTHS[Number(m[2]) - 1]
  return month ? `${month} ${Number(m[3])}` : ymd
}

const byDate = (a: GameSummary, b: GameSummary) => a.game.game_date.localeCompare(b.game.game_date)

// ── Headline tiles and the trend ────────────────────────────────────────────

export interface TrendPoint {
  gameId: string
  opponent: string
  date: string
  /** The game's own value (rates as 0–1); null when there was nothing to divide. */
  value: number | null
  valueText: string
  /** "8/19" for a rate, null for a margin. */
  detail: string | null
  /** The last ROLLING_WINDOW games pooled, ending here; null until there are that many. */
  rolling: number | null
  rollingText: string
}

export interface MetricCard {
  key: MetricKey
  label: string
  help: string
  kind: 'rate' | 'margin'
  /** The stretch's number, as every page prints it. */
  valueText: string
  /** "8/13" under a rate; "per game" under a margin. */
  detail: string
  /** The stretch's number as a plain number, for the chart's average line. */
  average: number | null
  target: number | null
  targetText: string | null
  /** Against the target: on it, under it, or too few attempts to say. */
  status: 'on' | 'under' | 'thin' | null
  points: TrendPoint[]
}

/**
 * Every headline number for a stretch of games, with its game-by-game line.
 *
 * The rolling average pools the window's attempts (8/19 + 5/12 + … over the
 * three games together) rather than averaging three percentages, so a game
 * with 2 shots can't swing it like a game with 20. For a margin the two are
 * the same thing. The line starts at the third game; before that there isn't
 * a full window.
 */
export function metricCards(games: GameSummary[], events: StatEvent[]): MetricCard[] {
  const sorted = [...games].sort(byDate)
  const all = aggregate(sorted, events)
  // Each window's pooled lines, worked out once and shared by every metric.
  const windows = sorted.map((_, i) =>
    i + 1 >= ROLLING_WINDOW ? aggregate(sorted.slice(i + 1 - ROLLING_WINDOW, i + 1), events) : null
  )
  return METRICS.map((m) => {
    const v = metricValue(m.key, all)
    const target = BENCHMARKS[m.key] ?? null
    const rateV = v != null && typeof v === 'object' ? v : null
    const status: MetricCard['status'] =
      target == null || !rateV
        ? null
        : rateV.pct == null || rateV.att < MIN_ATTEMPTS
          ? 'thin'
          : rateV.pct >= target
            ? 'on'
            : 'under'
    const points: TrendPoint[] = sorted.map((g, i) => {
      const own = metricValue(m.key, { games: 1, lines: g.lines })
      const w = windows[i]
      const rolling = w ? metricNumber(m.key, w) : null
      return {
        gameId: g.game.id,
        opponent: g.game.opponent || 'Opponent',
        date: shortDate(g.game.game_date),
        value: own == null ? null : typeof own === 'number' ? own : own.pct,
        valueText: fmtMetric(m.key, own),
        detail: own != null && typeof own === 'object' ? fmtRate(own) : null,
        rolling,
        rollingText: fmtMetric(m.key, rolling),
      }
    })
    return {
      key: m.key,
      label: m.label,
      help: m.help,
      kind: m.kind,
      valueText: fmtMetric(m.key, v),
      detail: rateV ? fmtRate(rateV) : 'per game',
      average: metricNumber(m.key, all),
      target,
      targetText: target == null ? null : fmtPct(target),
      status,
      points,
    }
  })
}

/** A tidy axis: round ends and 3–5 round ticks. */
export interface Scale {
  min: number
  max: number
  ticks: number[]
}

function niceStep(raw: number): number {
  const p = Math.pow(10, Math.floor(Math.log10(raw)))
  const f = raw / p
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p
}

/**
 * The value axis for a trend. A rate always starts at 0% and never runs past
 * 100%; a margin always shows its zero line, so above and below break-even
 * read at a glance.
 */
export function trendScale(values: (number | null | undefined)[], kind: 'rate' | 'margin'): Scale {
  const vs = values.filter((v): v is number => v != null && Number.isFinite(v))
  // 5% headroom, so a point sitting on a round number isn't drawn on the chart's edge.
  let lo = kind === 'rate' ? 0 : Math.min(0, ...vs) * 1.05
  let hi = Math.max(0, ...vs) * 1.05
  if (hi - lo < 1e-9) {
    if (kind === 'rate') hi = 0.5
    else {
      lo = -1
      hi = 1
    }
  }
  // Margins step in whole numbers: half a goal isn't a gridline anyone wants.
  const step = Math.max(niceStep((hi - lo) / 4), kind === 'margin' ? 1 : 0.05)
  let min = Math.floor(lo / step + 1e-9) * step
  let max = Math.ceil(hi / step - 1e-9) * step
  if (kind === 'rate') {
    min = 0
    max = Math.min(1, max)
  }
  if (max - min < 1e-9) max = min + step
  min = Math.round(min * 1e6) / 1e6
  max = Math.round(max * 1e6) / 1e6
  const ticks: number[] = []
  for (let t = min; t <= max + 1e-9; t += step) ticks.push(Math.round(t * 1e6) / 1e6)
  return { min, max, ticks }
}

// ── Takeaways ───────────────────────────────────────────────────────────────

/**
 * Up to `max` of insights(), the rest held back for a "more" fold. The tiles
 * already show every number against its target, so the sentences that say
 * something the tiles can't — the recent trend, wins against losses, the weak
 * quarter — go first; "above/below the X% we aim for" lines fill what's left.
 * Shown in insights()' own order.
 */
export function pickTakeaways(list: Insight[], max = 6): { shown: Insight[]; more: Insight[] } {
  if (list.length <= max) return { shown: list, more: [] }
  const isTargetLine = (i: Insight) => /we aim for/i.test(i.text)
  const ranked = list.map((ins, idx) => ({ ins, idx })).sort((a, b) => Number(isTargetLine(a.ins)) - Number(isTargetLine(b.ins)) || a.idx - b.idx)
  const keep = new Set(ranked.slice(0, max).map((r) => r.idx))
  return {
    shown: list.filter((_, i) => keep.has(i)),
    more: list.filter((_, i) => !keep.has(i)),
  }
}

// ── What wins games ─────────────────────────────────────────────────────────

/**
 * Who scored the game's first goal. Events are ordered by quarter, then by
 * the order they were logged, so a goal entered late (a correction typed in
 * the fourth for something in the first) still lands in its own quarter.
 * Null when nobody scored.
 */
export function firstGoal(gameEvents: StatEvent[]): 'us' | 'them' | null {
  let best: StatEvent | null = null
  for (const e of gameEvents) {
    if (e.kind !== 'shot' || e.result !== 'goal') continue
    if (!best || e.period < best.period || (e.period === best.period && e.seq < best.seq)) best = e
  }
  return best ? best.side : null
}

export interface Split {
  w: number
  l: number
  t: number
  games: number
  text: string
  /** Wins ÷ games (a tie counts as a game not won). */
  winPct: number
}

function split(games: GameSummary[]): Split {
  const r = recordOf(games)
  const n = r.w + r.l + r.t
  return { w: r.w, l: r.l, t: r.t, games: n, text: r.label.replace(/-/g, '–'), winPct: n ? r.w / n : 0 }
}

export interface ConditionRow {
  key: string
  /** "Win the faceoff battle". */
  label: string
  /** How the line is drawn, for the fine print. */
  how: string
  yes: Split
  no: Split
  /** Win % when it happens minus win % when it doesn't. */
  swing: number
}

interface Condition {
  key: string
  label: string
  how: string
  /** True or false for a game, or null when that game didn't track enough to say. */
  test: (g: GameSummary, ev: StatEvent[]) => boolean | null
}

const pctTest = (r: Rate, target: number) => (r.pct == null ? null : r.pct >= target)

/** Each split the page offers. Thresholds are the shared BENCHMARKS, so "the target" means one thing everywhere. */
function conditions(): Condition[] {
  const clearT = BENCHMARKS.clears ?? 0.8
  const shootT = BENCHMARKS.shooting ?? 0.3
  const saveT = BENCHMARKS.saving ?? 0.55
  const both = (g: GameSummary, f: (l: TeamLine) => number) => f(g.lines.us) + f(g.lines.them)
  return [
    {
      key: 'first',
      label: 'Score first',
      how: 'Who scored the first goal of the game.',
      test: (_g, ev) => {
        const f = firstGoal(ev)
        return f == null ? null : f === 'us'
      },
    },
    {
      key: 'half',
      label: 'Lead at halftime',
      how: 'Goals in Q1 and Q2.',
      test: (g) => {
        const half = g.periods.filter((p) => p.period <= 2)
        return half.reduce((s, p) => s + p.goalsFor, 0) > half.reduce((s, p) => s + p.goalsAgainst, 0)
      },
    },
    {
      key: 'faceoffs',
      label: 'Win the faceoff battle',
      how: 'More than half the faceoffs.',
      test: (g) => (g.lines.us.faceoffs.att ? g.lines.us.faceoffs.made * 2 > g.lines.us.faceoffs.att : null),
    },
    {
      key: 'groundBalls',
      label: 'Win the ground ball battle',
      how: 'More ground balls than them.',
      test: (g) => (both(g, (l) => l.groundBalls) ? g.lines.us.groundBalls > g.lines.them.groundBalls : null),
    },
    {
      key: 'turnovers',
      label: 'Commit fewer turnovers',
      how: 'Fewer turnovers than them.',
      test: (g) => (both(g, (l) => l.turnovers) ? g.lines.us.turnovers < g.lines.them.turnovers : null),
    },
    {
      key: 'clears',
      label: `Clear ${fmtPct(clearT)} or better`,
      how: 'Our clearing % in the game.',
      test: (g) => pctTest(g.lines.us.clears, clearT),
    },
    {
      key: 'shooting',
      label: `Shoot ${fmtPct(shootT)} or better`,
      how: 'Our shooting % in the game.',
      test: (g) => pctTest(g.lines.us.shooting, shootT),
    },
    {
      key: 'saving',
      label: `Save ${fmtPct(saveT)} or better`,
      how: 'Our save % in the game.',
      test: (g) => pctTest(g.lines.us.saving, saveT),
    },
    {
      key: 'shots',
      label: 'Outshoot them',
      how: 'More shots than them.',
      test: (g) => (both(g, (l) => l.shots) ? g.lines.us.shots > g.lines.them.shots : null),
    },
  ]
}

/**
 * Our record split by how each game went — "when we win the faceoff battle:
 * 6–1, otherwise 2–4". Only finished games count, a game that didn't track
 * the thing in question sits that split out, and a split only shows when
 * there are games on both sides of it (a 6–1 with nothing to compare it to
 * says nothing), and only when the stretch has both wins and losses.
 * Biggest swing in win % first.
 */
export function conditionalRecords(games: GameSummary[], events: StatEvent[]): ConditionRow[] {
  const decided = games.filter((g) => g.outcome != null)
  // Looking only at wins (or only at losses) there is nothing to separate.
  if (!decided.some((g) => g.outcome === 'W') || !decided.some((g) => g.outcome === 'L')) return []
  const byGame = new Map<string, StatEvent[]>()
  for (const e of events) {
    const list = byGame.get(e.game_id)
    if (list) list.push(e)
    else byGame.set(e.game_id, [e])
  }
  const rows: ConditionRow[] = []
  for (const c of conditions()) {
    const yes: GameSummary[] = []
    const no: GameSummary[] = []
    for (const g of decided) {
      const r = c.test(g, byGame.get(g.game.id) ?? [])
      if (r === true) yes.push(g)
      else if (r === false) no.push(g)
    }
    if (!yes.length || !no.length) continue
    const y = split(yes)
    const n = split(no)
    rows.push({ key: c.key, label: c.label, how: c.how, yes: y, no: n, swing: y.winPct - n.winPct })
  }
  return rows.sort((a, b) => Math.abs(b.swing) - Math.abs(a.swing))
}

export interface WinLossRow {
  key: MetricKey
  label: string
  wins: string
  losses: string
  /** Wins minus losses: percentage points for a rate, goals/balls per game for a margin. */
  diff: number | null
  diffText: string
}

/** "+12 pts" for a rate, "+2.5" / "-1" for a margin (signed like fmtMetric), "—" when either side has nothing. */
export function diffText(kind: 'rate' | 'margin', d: number | null): string {
  if (d == null || !Number.isFinite(d)) return '—'
  if (kind === 'rate') {
    const pts = Math.round(d * 100)
    return pts === 0 ? 'even' : `${pts > 0 ? '+' : '-'}${Math.abs(pts)} ${Math.abs(pts) === 1 ? 'pt' : 'pts'}`
  }
  const r = Math.round(d * 10) / 10
  if (r === 0) return 'even'
  return `${r > 0 ? '+' : '-'}${Math.abs(r).toFixed(Number.isInteger(r) ? 0 : 1)}`
}

/** Every headline number in our wins against our losses. Null unless there's at least one of each. */
export function winsVsLosses(
  games: GameSummary[],
  events: StatEvent[]
): { wins: number; losses: number; rows: WinLossRow[] } | null {
  const wins = games.filter((g) => g.outcome === 'W')
  const losses = games.filter((g) => g.outcome === 'L')
  if (!wins.length || !losses.length) return null
  const w = aggregate(wins, events)
  const l = aggregate(losses, events)
  return {
    wins: wins.length,
    losses: losses.length,
    rows: METRICS.map((m) => {
      const a = metricNumber(m.key, w)
      const b = metricNumber(m.key, l)
      const d = a != null && b != null ? a - b : null
      return {
        key: m.key,
        label: m.label,
        wins: fmtMetric(m.key, metricValue(m.key, w)),
        losses: fmtMetric(m.key, metricValue(m.key, l)),
        diff: d,
        diffText: diffText(m.kind, d),
      }
    }),
  }
}

// ── Quarters, shots and situations ──────────────────────────────────────────

export interface QuarterRow {
  period: number
  label: string
  goalsFor: number
  goalsAgainst: number
  diff: number
  shotsFor: number
  shotsAgainst: number
}

/** The stretch's quarters (and any overtime) with each one's goal differential. */
export function quarterRows(periods: { period: number; goalsFor: number; goalsAgainst: number; shotsFor: number; shotsAgainst: number }[]): QuarterRow[] {
  return periods.map((p) => ({
    period: p.period,
    label: periodLabel(p.period),
    goalsFor: p.goalsFor,
    goalsAgainst: p.goalsAgainst,
    diff: p.goalsFor - p.goalsAgainst,
    shotsFor: p.shotsFor,
    shotsAgainst: p.shotsAgainst,
  }))
}

/** "+3", "-2", "0" — signed the way fmtMetric signs a margin, so the page reads one way. */
export function signed(n: number): string {
  return n > 0 ? `+${n}` : String(n)
}

/**
 * Shot results in order of how close the shot came: in, saved, off the pipe,
 * blocked, missed. The chart's shading runs the same way.
 */
export const SHOT_ORDER: ShotResult[] = ['goal', 'saved', 'post', 'blocked', 'missed']

export interface ShotSide {
  total: number
  parts: { result: ShotResult; label: string; count: number; share: number }[]
}

export function shotProfile(line: TeamLine): ShotSide {
  const total = line.shots
  return {
    total,
    parts: SHOT_ORDER.map((r) => ({
      result: r,
      label: SHOT_LABELS[r],
      count: line.shotResults[r],
      share: total ? line.shotResults[r] / total : 0,
    })),
  }
}

export interface SituationGoals {
  even: number
  manUp: number
  shortHanded: number
  total: number
}

/**
 * Goals by situation for each side. Situations are logged from our side, so
 * their goal while we're a man down is THEIR man-up goal, and their goal while
 * we're a man up is short-handed for them.
 */
export function situationGoals(events: StatEvent[], gameIds: Set<string>): { us: SituationGoals; them: SituationGoals } {
  const blank = (): SituationGoals => ({ even: 0, manUp: 0, shortHanded: 0, total: 0 })
  const us = blank()
  const them = blank()
  for (const e of events) {
    if (e.kind !== 'shot' || e.result !== 'goal' || !gameIds.has(e.game_id)) continue
    const s = e.side === 'us' ? us : them
    s.total++
    if (e.situation === 'even') s.even++
    else if ((e.situation === 'man_up') === (e.side === 'us')) s.manUp++
    else s.shortHanded++
  }
  return { us, them }
}

// ── Players ─────────────────────────────────────────────────────────────────

/** Fewer than this many shots and a shooting % is shown faded and sorted last. */
export const MIN_SHOTS = 10
/** The same for faceoff %. */
export const MIN_FACEOFFS = 10
/** And for a goalie's save %, in shots on goal faced. */
export const MIN_FACED = 10

export interface SkaterRow {
  id: string
  number: string | null
  name: string
  gp: number
  g: number
  a: number
  pts: number
  sh: number
  shPct: number | null
  shQualified: boolean
  sog: number
  gb: number
  ct: number
  to: number
  foW: number
  foL: number
  foPct: number | null
  foQualified: boolean
  pen: number
  pim: number
}

export interface GoalieRow {
  id: string
  number: string | null
  name: string
  gp: number
  saves: number
  ga: number
  faced: number
  svPct: number | null
  qualified: boolean
}

/**
 * The leaderboard's rows, straight from aggregate().players. A goalie who did
 * nothing but stand in the cage is a goalie, not a skater with a line of
 * zeroes; one who also picked up a ground ball shows in both.
 */
export function playerRows(lines: PlayerLine[], players: Map<string, StatPlayer>): { skaters: SkaterRow[]; goalies: GoalieRow[] } {
  const who = (id: string) => {
    const p = players.get(id)
    return { number: p?.number ?? null, name: p ? p.name : playerLabel(undefined) }
  }
  const skaters: SkaterRow[] = []
  const goalies: GoalieRow[] = []
  for (const l of lines) {
    const skated =
      l.shots + l.goals + l.assists + l.groundBalls + l.turnovers + l.causedTurnovers + l.faceoffs.att + l.penalties > 0
    if (skated) {
      skaters.push({
        id: l.playerId,
        ...who(l.playerId),
        gp: l.games,
        g: l.goals,
        a: l.assists,
        pts: l.points,
        sh: l.shots,
        shPct: l.shooting.pct,
        shQualified: l.shooting.att >= MIN_SHOTS,
        sog: l.shotsOnGoal,
        gb: l.groundBalls,
        ct: l.causedTurnovers,
        to: l.turnovers,
        foW: l.faceoffs.made,
        foL: l.faceoffs.att - l.faceoffs.made,
        foPct: l.faceoffs.pct,
        foQualified: l.faceoffs.att >= MIN_FACEOFFS,
        pen: l.penalties,
        pim: l.penaltyMinutes,
      })
    }
    if (l.saving.att > 0) {
      goalies.push({
        id: l.playerId,
        ...who(l.playerId),
        gp: l.games,
        saves: l.saves,
        ga: l.goalsAgainst,
        faced: l.saving.att,
        svPct: l.saving.pct,
        qualified: l.saving.att >= MIN_FACED,
      })
    }
  }
  goalies.sort((a, b) => b.faced - a.faced || a.name.localeCompare(b.name))
  return { skaters, goalies }
}
