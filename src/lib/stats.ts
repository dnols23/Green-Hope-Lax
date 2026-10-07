// Game stats: what gets tracked, and every number worked out from it.
//
// A game is a log of events, one per thing that happened ("#12 shot, saved",
// "we won the faceoff", "they failed the clear"). Nothing else is stored:
// every total, percentage and split is computed here from the log, so fixing
// one tap fixes every number that depends on it.
//
// Pure, no imports: the tracker, the box score, the analysis page and the
// printed report all call the same functions, and the tests can run them in
// plain Node.
//
// Every situation is recorded from OUR point of view: a goal they score while
// we are a man down is situation 'man_down'.

// ── What can be tracked ─────────────────────────────────────────────────────

export type StatSide = 'us' | 'them'

export type StatKind = 'shot' | 'ground_ball' | 'faceoff' | 'turnover' | 'clear' | 'penalty'

export type ShotResult = 'goal' | 'saved' | 'missed' | 'blocked' | 'post'
export type FaceoffResult = 'won' | 'lost'
export type ClearResult = 'success' | 'fail'
export type TurnoverResult = 'caused' | 'unforced'
export type Situation = 'even' | 'man_up' | 'man_down'

/**
 * One thing that happened.
 *
 *  kind          side   player_id                 assist_id      result
 *  shot          us     shooter                   assister       goal|saved|missed|blocked|post
 *  shot          them   our goalie in the cage    —              goal|saved|missed|blocked|post
 *  ground_ball   us     who picked it up          —              —
 *  ground_ball   them   —                         —              —
 *  faceoff       us     our faceoff man           —              won|lost
 *  turnover      us     who gave it away          —              caused|unforced (by them)
 *  turnover      them   who caused it (if any)    —              caused|unforced
 *  clear         us     —                         —              success|fail   (our clear)
 *  clear         them   —                         —              success|fail   (their clear = our ride)
 *  penalty       us     who took it               —              —   minutes in penalty_minutes
 *  penalty       them   —                         —              —   (our man-up chance)
 */
export interface StatEvent {
  id: string
  game_id: string
  /** Order within the game. */
  seq: number
  /** 1–4, then 5 for OT1, 6 for OT2 … */
  period: number
  side: StatSide
  kind: StatKind
  result: string | null
  player_id: string | null
  assist_id: string | null
  situation: Situation
  penalty_minutes: number | null
  created_at: string
}

export const STAT_KINDS: StatKind[] = ['shot', 'ground_ball', 'faceoff', 'turnover', 'clear', 'penalty']
export const SHOT_RESULTS: ShotResult[] = ['goal', 'saved', 'missed', 'blocked', 'post']
export const SITUATIONS: Situation[] = ['even', 'man_up', 'man_down']
export const PENALTY_MINUTES = [0.5, 1, 1.5, 2, 3] as const
export const MAX_PERIOD = 8

export const KIND_LABELS: Record<StatKind, string> = {
  shot: 'Shot',
  ground_ball: 'Ground ball',
  faceoff: 'Faceoff',
  turnover: 'Turnover',
  clear: 'Clear',
  penalty: 'Penalty',
}

export const SHOT_LABELS: Record<ShotResult, string> = {
  goal: 'Goal',
  saved: 'Saved',
  missed: 'Missed',
  blocked: 'Blocked',
  post: 'Pipe',
}

export const SITUATION_LABELS: Record<Situation, string> = {
  even: 'Even',
  man_up: 'Man-up',
  man_down: 'Man-down',
}

/** Which results a kind may carry (null allowed where the table above shows —). */
export const KIND_RESULTS: Record<StatKind, readonly string[]> = {
  shot: SHOT_RESULTS,
  ground_ball: [],
  faceoff: ['won', 'lost'],
  turnover: ['caused', 'unforced'],
  clear: ['success', 'fail'],
  penalty: [],
}

export function isStatKind(v: unknown): v is StatKind {
  return typeof v === 'string' && (STAT_KINDS as string[]).includes(v)
}
export function isSituation(v: unknown): v is Situation {
  return typeof v === 'string' && (SITUATIONS as string[]).includes(v)
}

/** "Q1"…"Q4", then "OT", "2OT" … */
export function periodLabel(p: number): string {
  if (p <= 4) return `Q${p}`
  return p === 5 ? 'OT' : `${p - 4}OT`
}

/** What a stat looks like on its way in: the fields the table above constrains. */
export interface StatShape {
  side: unknown
  kind: unknown
  result: string | null
  playerId: string | null
  assistId: string | null
  penaltyMinutes?: number | null
}

/**
 * Check one stat against the table on StatEvent. Null when it fits, otherwise
 * what to tell the coach. The server action refuses anything this refuses, and
 * readStatEvent drops a stored row that fails it, so a stat that can't be
 * saved can't be counted either.
 */
export function statProblem(i: StatShape): string | null {
  if (!isStatKind(i.kind)) return 'Unknown stat.'
  if (i.side !== 'us' && i.side !== 'them') return 'Whose stat is it?'
  const results = KIND_RESULTS[i.kind]
  if (results.length && !(i.result && results.includes(i.result))) return 'Pick how it ended.'
  if (!results.length && i.result) return 'That stat has no result.'
  if (i.kind === 'faceoff' && i.side !== 'us') return 'Faceoffs are logged from our side.'
  if (i.assistId && !(i.kind === 'shot' && i.side === 'us' && i.result === 'goal')) return 'Only our goals have assists.'
  if (i.assistId && i.assistId === i.playerId) return 'A player can’t assist his own goal.'
  if (i.kind === 'penalty' && i.penaltyMinutes != null) {
    const m = Number(i.penaltyMinutes)
    // Penalties run in half minutes, and the column holds 0–10.
    if (!Number.isFinite(m) || m < 0 || m > 10 || Math.round(m * 2) !== m * 2) return 'Penalty time is in half minutes, up to 10.'
  }
  return null
}

/** A row from the database, cleaned. Null when it can't be a stat. */
export function readStatEvent(row: Record<string, unknown>): StatEvent | null {
  const kind = row.kind
  const side = row.side
  if (!isStatKind(kind) || (side !== 'us' && side !== 'them')) return null
  if (row.id == null || row.id === '' || row.game_id == null || row.game_id === '') return null
  const result = typeof row.result === 'string' && row.result ? row.result : null
  const player = typeof row.player_id === 'string' && row.player_id ? row.player_id : null
  const assist = typeof row.assist_id === 'string' && row.assist_id ? row.assist_id : null
  const raw = kind === 'penalty' && row.penalty_minutes != null && row.penalty_minutes !== '' ? Number(row.penalty_minutes) : null
  const minutes = raw != null && Number.isFinite(raw) && raw >= 0 && raw <= 10 ? raw : null
  // The same rules a new stat has to pass. A shot with no result, or a
  // faceoff logged for them, would otherwise be guessed at ("missed", "won")
  // and quietly move a percentage. A stray assist or odd penalty time is
  // cleaned up below rather than losing the whole stat.
  if (statProblem({ side, kind, result, playerId: player, assistId: null })) return null
  return {
    id: String(row.id),
    game_id: String(row.game_id),
    seq: Number(row.seq) || 0,
    period: Math.min(MAX_PERIOD, Math.max(1, Math.round(Number(row.period) || 1))),
    side,
    kind,
    result,
    player_id: player,
    // An assist only means something on our goal, and never to the scorer
    // himself. A stray one (a goal edited to a save) is dropped, not counted.
    assist_id: assist && kind === 'shot' && side === 'us' && result === 'goal' && assist !== player ? assist : null,
    situation: isSituation(row.situation) ? row.situation : 'even',
    penalty_minutes: minutes,
    created_at: String(row.created_at ?? ''),
  }
}

// ── Numbers ─────────────────────────────────────────────────────────────────

/** A share: made of attempts. `pct` is null with no attempts — never 0/0 shown as 0%. */
export interface Rate {
  made: number
  att: number
  pct: number | null
}

export function rate(made: number, att: number): Rate {
  return { made, att, pct: att > 0 ? made / att : null }
}

/** "62%", or "—" when there is nothing to divide. */
export function fmtPct(r: Rate | number | null, digits = 0): string {
  const v = typeof r === 'number' || r === null ? r : r.pct
  if (v == null || !Number.isFinite(v)) return '—'
  const s = (v * 100).toFixed(digits)
  // A hair below zero rounds to "-0%"; there is no such thing.
  return `${/^-0(\.0+)?$/.test(s) ? s.slice(1) : s}%`
}

/** "8/13". */
export function fmtRate(r: Rate): string {
  return `${r.made}/${r.att}`
}

/** One side's totals for a game, or for any set of games. */
export interface TeamLine {
  goals: number
  assists: number
  shots: number
  /** Goal or saved: shots that made the goalie deal with them. */
  shotsOnGoal: number
  shotResults: Record<ShotResult, number>
  /** Goals / shots. */
  shooting: Rate
  /** On goal / shots. */
  onGoal: Rate
  /** Saves by this side's goalie / shots on goal faced. */
  saving: Rate
  goalsAgainst: number
  groundBalls: number
  faceoffs: Rate
  turnovers: number
  /** Turnovers this side forced (the other side's caused turnovers). */
  causedTurnovers: number
  clears: Rate
  /** The other side's failed clears / their clear attempts. */
  rides: Rate
  penalties: number
  penaltyMinutes: number
  /**
   * Man-up goals / man-up chances. Chances aren't logged, so they are
   * approximated by the other side's penalties — never fewer than the man-up
   * goals actually scored (a non-releasable penalty can give up two), so this
   * never reads over 100%. Offsetting penalties still count as a chance each.
   */
  manUp: Rate
  /**
   * Man-down kills / man-down chances: chances are this side's penalties (never
   * fewer than the man-up goals given up), kills are the chances the other
   * side didn't score on. Never negative, never more than the chances.
   */
  manDown: Rate
}

const emptyResults = (): Record<ShotResult, number> => ({ goal: 0, saved: 0, missed: 0, blocked: 0, post: 0 })

/**
 * Both sides' totals from a log of events.
 *
 * Faceoffs are only ever logged from our side: a faceoff we lost is one they
 * won. Situation is ours, so their man-up goal is an event marked 'man_down'.
 */
export function teamLines(events: StatEvent[]): { us: TeamLine; them: TeamLine } {
  const results = { us: emptyResults(), them: emptyResults() }
  let foWon = 0
  let foTaken = 0
  const gb = { us: 0, them: 0 }
  const to = { us: 0, them: 0 }
  // Caused turnovers credited to the side that forced them.
  const ct = { us: 0, them: 0 }
  const clr = { us: { made: 0, att: 0 }, them: { made: 0, att: 0 } }
  const pen = { us: 0, them: 0 }
  const pim = { us: 0, them: 0 }
  let assists = 0
  // Goals scored with the extra man, by side.
  const muGoals = { us: 0, them: 0 }

  for (const e of events) {
    const s = e.side
    const o: StatSide = s === 'us' ? 'them' : 'us'
    switch (e.kind) {
      case 'shot': {
        const r = (SHOT_RESULTS as string[]).includes(e.result ?? '') ? (e.result as ShotResult) : 'missed'
        results[s][r]++
        if (r === 'goal') {
          if (s === 'us' && e.assist_id && e.assist_id !== e.player_id) assists++
          if (s === 'us' && e.situation === 'man_up') muGoals.us++
          if (s === 'them' && e.situation === 'man_down') muGoals.them++
        }
        break
      }
      case 'ground_ball':
        gb[s]++
        break
      case 'faceoff':
        foTaken++
        if (e.result === 'won') foWon++
        break
      case 'turnover':
        to[s]++
        if (e.result === 'caused') ct[o]++
        break
      case 'clear':
        clr[s].att++
        if (e.result === 'success') clr[s].made++
        break
      case 'penalty':
        pen[s]++
        pim[s] += e.penalty_minutes ?? 0
        break
    }
  }

  const line = (s: StatSide): TeamLine => {
    const o: StatSide = s === 'us' ? 'them' : 'us'
    const r = results[s]
    const shots = r.goal + r.saved + r.missed + r.blocked + r.post
    const sog = r.goal + r.saved
    const faced = results[o].goal + results[o].saved
    // Man-up chances for this side, and man-down chances for this side. One
    // side's man-up line and the other's man-down line are the same chances,
    // so their goals plus our kills always add up to them.
    const upChances = Math.max(pen[o], muGoals[s])
    const downChances = Math.max(pen[s], muGoals[o])
    return {
      goals: r.goal,
      assists: s === 'us' ? assists : 0,
      shots,
      shotsOnGoal: sog,
      shotResults: { ...r },
      shooting: rate(r.goal, shots),
      onGoal: rate(sog, shots),
      saving: rate(results[o].saved, faced),
      goalsAgainst: results[o].goal,
      groundBalls: gb[s],
      faceoffs: s === 'us' ? rate(foWon, foTaken) : rate(foTaken - foWon, foTaken),
      turnovers: to[s],
      causedTurnovers: ct[s],
      clears: rate(clr[s].made, clr[s].att),
      rides: rate(clr[o].att - clr[o].made, clr[o].att),
      penalties: pen[s],
      penaltyMinutes: pim[s],
      manUp: rate(muGoals[s], upChances),
      manDown: rate(downChances - muGoals[o], downChances),
    }
  }
  return { us: line('us'), them: line('them') }
}

/** Goals for and against, period by period (only periods that saw anything). */
export interface PeriodLine {
  period: number
  goalsFor: number
  goalsAgainst: number
  shotsFor: number
  shotsAgainst: number
}

export function periodLines(events: StatEvent[]): PeriodLine[] {
  const by = new Map<number, PeriodLine>()
  const get = (p: number) => {
    let l = by.get(p)
    if (!l) by.set(p, (l = { period: p, goalsFor: 0, goalsAgainst: 0, shotsFor: 0, shotsAgainst: 0 }))
    return l
  }
  // Q1–Q4 always show, so a quiet quarter reads as 0 rather than missing.
  for (let p = 1; p <= 4; p++) get(p)
  for (const e of events) {
    if (e.kind !== 'shot') continue
    const l = get(e.period)
    if (e.side === 'us') {
      l.shotsFor++
      if (e.result === 'goal') l.goalsFor++
    } else {
      l.shotsAgainst++
      if (e.result === 'goal') l.goalsAgainst++
    }
  }
  return [...by.values()].sort((a, b) => a.period - b.period)
}

/** One of our players over a game or a stretch of games. */
export interface PlayerLine {
  playerId: string
  games: number
  goals: number
  assists: number
  points: number
  shots: number
  shotsOnGoal: number
  shooting: Rate
  groundBalls: number
  turnovers: number
  causedTurnovers: number
  faceoffs: Rate
  penalties: number
  penaltyMinutes: number
  manUpGoals: number
  /** As our goalie: their shots on goal faced while he was in. */
  saves: number
  goalsAgainst: number
  saving: Rate
}

function blankPlayer(playerId: string): PlayerLine {
  return {
    playerId,
    games: 0,
    goals: 0,
    assists: 0,
    points: 0,
    shots: 0,
    shotsOnGoal: 0,
    shooting: rate(0, 0),
    groundBalls: 0,
    turnovers: 0,
    causedTurnovers: 0,
    faceoffs: rate(0, 0),
    penalties: 0,
    penaltyMinutes: 0,
    manUpGoals: 0,
    saves: 0,
    goalsAgainst: 0,
    saving: rate(0, 0),
  }
}

/**
 * Every one of our players who shows up in the events, with their line.
 * `games` counts the distinct games each player appears in.
 */
export function playerLines(events: StatEvent[]): PlayerLine[] {
  const by = new Map<string, PlayerLine & { _games: Set<string>; _foW: number; _foT: number }>()
  const get = (id: string, game: string) => {
    let l = by.get(id)
    if (!l) by.set(id, (l = { ...blankPlayer(id), _games: new Set(), _foW: 0, _foT: 0 }))
    l._games.add(game)
    return l
  }
  for (const e of events) {
    if (e.kind === 'shot' && e.side === 'us') {
      if (e.player_id) {
        const l = get(e.player_id, e.game_id)
        l.shots++
        if (e.result === 'goal' || e.result === 'saved') l.shotsOnGoal++
        if (e.result === 'goal') {
          l.goals++
          if (e.situation === 'man_up') l.manUpGoals++
        }
      }
      if (e.result === 'goal' && e.assist_id && e.assist_id !== e.player_id) get(e.assist_id, e.game_id).assists++
    } else if (e.kind === 'shot' && e.side === 'them' && e.player_id) {
      const l = get(e.player_id, e.game_id)
      if (e.result === 'saved') l.saves++
      if (e.result === 'goal') l.goalsAgainst++
    } else if (e.kind === 'ground_ball' && e.side === 'us' && e.player_id) {
      get(e.player_id, e.game_id).groundBalls++
    } else if (e.kind === 'turnover' && e.side === 'us' && e.player_id) {
      get(e.player_id, e.game_id).turnovers++
    } else if (e.kind === 'turnover' && e.side === 'them' && e.result === 'caused' && e.player_id) {
      // Their caused turnover is our defender's caused turnover. One they
      // gave away on their own isn't credited to anybody (nor a game played).
      get(e.player_id, e.game_id).causedTurnovers++
    } else if (e.kind === 'faceoff' && e.player_id) {
      const l = get(e.player_id, e.game_id)
      l._foT++
      if (e.result === 'won') l._foW++
    } else if (e.kind === 'penalty' && e.side === 'us' && e.player_id) {
      const l = get(e.player_id, e.game_id)
      l.penalties++
      l.penaltyMinutes += e.penalty_minutes ?? 0
    }
  }
  return [...by.values()].map(({ _games, _foW, _foT, ...l }) => ({
    ...l,
    games: _games.size,
    points: l.goals + l.assists,
    shooting: rate(l.goals, l.shots),
    faceoffs: rate(_foW, _foT),
    saving: rate(l.saves, l.saves + l.goalsAgainst),
  }))
}

// ── Games and seasons ───────────────────────────────────────────────────────

/** The game record the stats hang off (a row of `games`, trimmed). */
export interface StatGame {
  id: string
  game_date: string
  opponent: string
  home_away: 'home' | 'away' | 'neutral'
  level: 'varsity' | 'jv'
  is_conference: boolean
  status: string
  team_score: number | null
  opp_score: number | null
}

export type Outcome = 'W' | 'L' | 'T'

/** One game, everything about it. */
export interface GameSummary {
  game: StatGame
  /** Whether anything was tracked. Untracked games still count toward the record. */
  tracked: boolean
  eventCount: number
  /** From the tracked goals when tracked, otherwise the score typed on the schedule. */
  goalsFor: number | null
  goalsAgainst: number | null
  outcome: Outcome | null
  lines: { us: TeamLine; them: TeamLine }
  periods: PeriodLine[]
}

export function summarizeGame(game: StatGame, events: StatEvent[]): GameSummary {
  const mine = events.filter((e) => e.game_id === game.id)
  const lines = teamLines(mine)
  const tracked = mine.length > 0
  const gf = tracked ? lines.us.goals : game.team_score
  const ga = tracked ? lines.them.goals : game.opp_score
  // Only a finished game counts toward the record; one still being tracked has no result yet.
  const decided = game.status === 'final' && gf != null && ga != null
  return {
    game,
    tracked,
    eventCount: mine.length,
    goalsFor: gf,
    goalsAgainst: ga,
    outcome: decided && gf != null && ga != null ? (gf > ga ? 'W' : gf < ga ? 'L' : 'T') : null,
    lines,
    periods: periodLines(mine),
  }
}

/**
 * Which season a game belongs to: the spring year it is played in, read on
 * Eastern time (a 9pm game on Dec 31 is still that year's). The loaders hand
 * back every game ever scheduled, so a record or an analysis meant for one
 * season should keep only that season's games.
 */
export function seasonOf(game: Pick<StatGame, 'game_date'>): number | null {
  const t = Date.parse(game.game_date)
  if (!Number.isFinite(t)) return null
  const y = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric' }).format(t)
  return Number(y) || null
}

/**
 * The seasons worth offering, newest first: those with a tracked game, or,
 * before anything is tracked, those with any game at all.
 */
export function statSeasons(games: GameSummary[]): number[] {
  const years = (list: GameSummary[]) =>
    [...new Set(list.map((g) => seasonOf(g.game)).filter((y): y is number => y != null))].sort((a, b) => b - a)
  const tracked = years(games.filter((g) => g.tracked))
  return tracked.length ? tracked : years(games)
}

/** The season a page should show: the one asked for if it is on offer, else the newest. */
export function pickSeason(games: GameSummary[], asked: unknown): number | null {
  const offered = statSeasons(games)
  const want = Number(Array.isArray(asked) ? asked[0] : asked)
  return offered.includes(want) ? want : offered[0] ?? null
}

/** One season's games (tracked or not). */
export function gamesInSeason(games: GameSummary[], season: number | null): GameSummary[] {
  return season == null ? games : games.filter((g) => seasonOf(g.game) === season)
}

/** W-L(-T) over a set of games: "7-3", or "7-3-1" with a tie. */
export function recordOf(games: GameSummary[]): { w: number; l: number; t: number; label: string } {
  let w = 0
  let l = 0
  let t = 0
  for (const g of games) {
    if (g.outcome === 'W') w++
    else if (g.outcome === 'L') l++
    else if (g.outcome === 'T') t++
  }
  return { w, l, t, label: t ? `${w}-${l}-${t}` : `${w}-${l}` }
}

/** Which games an analysis looks at. */
export type GameFilter = 'all' | 'conference' | 'nonconference' | 'home' | 'away' | 'wins' | 'losses' | 'last5'

export const GAME_FILTERS: { key: GameFilter; label: string }[] = [
  { key: 'all', label: 'All games' },
  { key: 'last5', label: 'Last 5' },
  { key: 'conference', label: 'Conference' },
  { key: 'nonconference', label: 'Non-conference' },
  { key: 'home', label: 'Home' },
  { key: 'away', label: 'Away' },
  { key: 'wins', label: 'Wins' },
  { key: 'losses', label: 'Losses' },
]

export function isGameFilter(v: unknown): v is GameFilter {
  return GAME_FILTERS.some((f) => f.key === v)
}

/**
 * The tracked games a filter keeps, oldest first. Only tracked games: an
 * analysis of shooting can't include a game nobody tracked.
 */
export function filterGames(games: GameSummary[], f: GameFilter): GameSummary[] {
  const tracked = [...games].filter((g) => g.tracked).sort((a, b) => a.game.game_date.localeCompare(b.game.game_date))
  switch (f) {
    case 'conference':
      return tracked.filter((g) => g.game.is_conference)
    case 'nonconference':
      return tracked.filter((g) => !g.game.is_conference)
    case 'home':
      return tracked.filter((g) => g.game.home_away === 'home')
    case 'away':
      // Anywhere but our field: a neutral site counts as away, so Home and
      // Away between them are every game.
      return tracked.filter((g) => g.game.home_away !== 'home')
    case 'wins':
      return tracked.filter((g) => g.outcome === 'W')
    case 'losses':
      return tracked.filter((g) => g.outcome === 'L')
    case 'last5':
      return tracked.slice(-5)
    default:
      return tracked
  }
}

/** Totals over a set of games: the season line, or any slice of it. */
export interface Aggregate {
  /**
   * How many of the games were tracked: what every per-game number divides
   * by. A game nobody tracked has no ground balls to average in; counting it
   * would drag every average down. (The record still counts it.)
   */
  games: number
  record: ReturnType<typeof recordOf>
  lines: { us: TeamLine; them: TeamLine }
  periods: PeriodLine[]
  players: PlayerLine[]
  /** Per-game averages for the counting stats that read better that way. */
  perGame: {
    goalsFor: number | null
    goalsAgainst: number | null
    shots: number | null
    groundBalls: number | null
    groundBallsAgainst: number | null
    turnovers: number | null
    causedTurnovers: number | null
  }
}

export function aggregate(games: GameSummary[], events: StatEvent[]): Aggregate {
  const ids = new Set(games.map((g) => g.game.id))
  const mine = events.filter((e) => ids.has(e.game_id))
  const lines = teamLines(mine)
  const n = games.filter((g) => g.tracked).length
  const per = (v: number) => (n ? v / n : null)
  return {
    games: n,
    record: recordOf(games),
    lines,
    periods: periodLines(mine),
    players: playerLines(mine),
    perGame: {
      goalsFor: per(lines.us.goals),
      goalsAgainst: per(lines.them.goals),
      shots: per(lines.us.shots),
      groundBalls: per(lines.us.groundBalls),
      groundBallsAgainst: per(lines.them.groundBalls),
      turnovers: per(lines.us.turnovers),
      causedTurnovers: per(lines.us.causedTurnovers),
    },
  }
}

// ── The headline numbers ────────────────────────────────────────────────────

/** The numbers a coach asks about first, each defined once so every page agrees. */
export type MetricKey =
  | 'shooting'
  | 'onGoal'
  | 'saving'
  | 'faceoffs'
  | 'clears'
  | 'rides'
  | 'manUp'
  | 'manDown'
  | 'gbMargin'
  | 'toMargin'
  | 'goalDiff'

export interface MetricDef {
  key: MetricKey
  label: string
  /** What it is, in a coach's words. */
  help: string
  kind: 'rate' | 'margin'
  /** Whether bigger is better (all of these are). */
  higherIsBetter: true
}

export const METRICS: MetricDef[] = [
  { key: 'shooting', label: 'Shooting %', help: 'Goals ÷ shots.', kind: 'rate', higherIsBetter: true },
  { key: 'onGoal', label: 'Shots on goal %', help: 'Shots that forced a save or scored ÷ shots.', kind: 'rate', higherIsBetter: true },
  { key: 'saving', label: 'Save %', help: 'Saves ÷ their shots on goal.', kind: 'rate', higherIsBetter: true },
  { key: 'faceoffs', label: 'Faceoff %', help: 'Faceoffs won ÷ taken.', kind: 'rate', higherIsBetter: true },
  { key: 'clears', label: 'Clearing %', help: 'Successful clears ÷ attempts.', kind: 'rate', higherIsBetter: true },
  { key: 'rides', label: 'Riding %', help: 'Their failed clears ÷ their attempts.', kind: 'rate', higherIsBetter: true },
  { key: 'manUp', label: 'Man-up %', help: 'Man-up goals ÷ their penalties.', kind: 'rate', higherIsBetter: true },
  { key: 'manDown', label: 'Man-down %', help: 'Our penalties they didn’t score on ÷ our penalties.', kind: 'rate', higherIsBetter: true },
  { key: 'gbMargin', label: 'Ground ball margin', help: 'Our ground balls minus theirs, per game.', kind: 'margin', higherIsBetter: true },
  { key: 'toMargin', label: 'Turnover margin', help: 'Their turnovers minus ours, per game.', kind: 'margin', higherIsBetter: true },
  { key: 'goalDiff', label: 'Goal differential', help: 'Goals for minus against, per game.', kind: 'margin', higherIsBetter: true },
]

/**
 * A headline number over a set of games. Rates come back as a Rate; margins
 * as a per-game number (null with no games).
 */
export function metricValue(key: MetricKey, a: { games: number; lines: { us: TeamLine; them: TeamLine } }): Rate | number | null {
  const { us, them } = a.lines
  const per = (v: number) => (a.games ? v / a.games : null)
  switch (key) {
    case 'shooting':
      return us.shooting
    case 'onGoal':
      return us.onGoal
    case 'saving':
      return us.saving
    case 'faceoffs':
      return us.faceoffs
    case 'clears':
      return us.clears
    case 'rides':
      return us.rides
    case 'manUp':
      return us.manUp
    case 'manDown':
      return us.manDown
    case 'gbMargin':
      return per(us.groundBalls - them.groundBalls)
    case 'toMargin':
      return per(them.turnovers - us.turnovers)
    case 'goalDiff':
      return per(us.goals - them.goals)
  }
}

/** The metric as a plain number for charts and comparisons (rates as 0–1). */
export function metricNumber(key: MetricKey, a: { games: number; lines: { us: TeamLine; them: TeamLine } }): number | null {
  const v = metricValue(key, a)
  return v == null ? null : typeof v === 'number' ? v : v.pct
}

/** "62%" for a rate, "+3.5" for a margin, "0" for dead even, "—" for nothing. */
export function fmtMetric(key: MetricKey, v: Rate | number | null): string {
  if (v == null) return '—'
  if (typeof v !== 'number') return fmtPct(v)
  const def = METRICS.find((m) => m.key === key)
  if (def?.kind === 'rate') return fmtPct(v)
  if (!Number.isFinite(v)) return '—'
  // Rounded on the size, then signed, so +0.25 and -0.25 come out as +0.3 and
  // -0.3 alike, and anything that rounds to nothing is a plain "0".
  const r = Math.round(Math.abs(v) * 10) / 10
  if (r === 0) return '0'
  return `${v > 0 ? '+' : '-'}${r.toFixed(Number.isInteger(r) ? 0 : 1)}`
}

/**
 * A metric game by game, oldest first, for a trend line. A game nobody
 * tracked is a gap (null), not a 0 margin.
 */
export function metricSeries(key: MetricKey, games: GameSummary[]): { gameId: string; label: string; value: number | null }[] {
  return [...games]
    .sort((a, b) => a.game.game_date.localeCompare(b.game.game_date))
    .map((g) => ({
      gameId: g.game.id,
      label: g.game.opponent,
      value: g.tracked ? metricNumber(key, { games: 1, lines: g.lines }) : null,
    }))
}

// ── Reading the numbers ─────────────────────────────────────────────────────

/** A sentence worth saying in a team meeting, with how good or bad it is. */
export interface Insight {
  tone: 'good' | 'bad' | 'neutral'
  text: string
}

/** Benchmarks a high school varsity team can hold itself to. */
export const BENCHMARKS: Partial<Record<MetricKey, number>> = {
  shooting: 0.3,
  onGoal: 0.6,
  saving: 0.55,
  faceoffs: 0.5,
  clears: 0.8,
  rides: 0.2,
  manUp: 0.35,
  manDown: 0.65,
}

/**
 * Plain-English takeaways for a set of games: where we sit against the
 * benchmarks, the last three games against the ones before, what was
 * different in the wins, and a quarter that keeps costing us. Only says what
 * the numbers support: a rate needs at least 5 attempts (on both sides of any
 * comparison) before it is talked about, and untracked games are left out.
 */
export function insights(games: GameSummary[], events: StatEvent[]): Insight[] {
  const out: Insight[] = []
  // Only tracked games have numbers to talk about, and "over 8 games" should
  // mean eight games somebody tracked.
  const played = games.filter((g) => g.tracked).sort((a, b) => a.game.game_date.localeCompare(b.game.game_date))
  if (!played.length) return out
  const all = aggregate(played, events)
  const enough = (v: Rate | number | null): v is Rate & { pct: number } =>
    typeof v === 'object' && v !== null && v.att >= 5 && v.pct != null && Number.isFinite(v.pct)
  const label = (key: MetricKey) => METRICS.find((m) => m.key === key)?.label ?? key

  for (const m of METRICS) {
    const bench = BENCHMARKS[m.key]
    const v = metricValue(m.key, all)
    if (bench == null || !enough(v)) continue
    const gap = v.pct - bench
    if (Math.abs(gap) < 0.05) continue
    out.push({
      tone: gap > 0 ? 'good' : 'bad',
      text: `${m.label} is ${fmtPct(v)} (${fmtRate(v)}), ${gap > 0 ? 'above' : 'below'} the ${fmtPct(bench)} we aim for.`,
    })
  }

  // The last three games against the games before them. (Against the whole
  // stretch, the last three would be compared partly with themselves.)
  if (played.length >= 5) {
    const recent = aggregate(played.slice(-3), events)
    const before = aggregate(played.slice(0, -3), events)
    for (const key of ['shooting', 'clears', 'faceoffs', 'saving'] as MetricKey[]) {
      const now = metricValue(key, recent)
      const was = metricValue(key, before)
      if (!enough(now) || !enough(was)) continue
      const d = now.pct - was.pct
      if (Math.abs(d) < 0.08) continue
      out.push({
        tone: d > 0 ? 'good' : 'bad',
        text: `${label(key)} over the last 3 games is ${fmtPct(now)} (${fmtRate(now)}), ${d > 0 ? 'up' : 'down'} from ${fmtPct(was)} in the ${before.games} games before.`,
      })
    }
  }

  // What the wins had that the losses didn't. Both sides of the comparison
  // need the same 5-attempt floor as everything else.
  const wins = played.filter((g) => g.outcome === 'W')
  const losses = played.filter((g) => g.outcome === 'L')
  if (wins.length >= 2 && losses.length >= 2) {
    const w = aggregate(wins, events)
    const l = aggregate(losses, events)
    let best: { key: MetricKey; d: number; a: Rate; b: Rate } | null = null
    for (const key of ['shooting', 'clears', 'faceoffs', 'saving', 'rides'] as MetricKey[]) {
      const a = metricValue(key, w)
      const b = metricValue(key, l)
      if (!enough(a) || !enough(b)) continue
      const d = a.pct - b.pct
      if (!best || Math.abs(d) > Math.abs(best.d)) best = { key, d, a, b }
    }
    if (best && Math.abs(best.d) >= 0.08) {
      out.push({
        tone: 'neutral',
        text: `Biggest difference between wins and losses: ${label(best.key)}, ${fmtPct(best.a)} in wins vs ${fmtPct(best.b)} in losses.`,
      })
    }
    const gbW = metricNumber('gbMargin', w)
    const gbL = metricNumber('gbMargin', l)
    if (gbW != null && gbL != null && gbW - gbL >= 3) {
      out.push({
        tone: 'neutral',
        text: `Ground ball margin is ${fmtMetric('gbMargin', gbW)} a game in wins and ${fmtMetric('gbMargin', gbL)} in losses.`,
      })
    }
  }

  // Which quarter hurts: only once it is more than a goal or two of noise.
  if (played.length >= 3) {
    const worst = all.periods
      .filter((p) => p.period <= 4)
      .map((p) => ({ p: p.period, gf: p.goalsFor, ga: p.goalsAgainst, diff: p.goalsFor - p.goalsAgainst }))
      .sort((a, b) => a.diff - b.diff || a.p - b.p)[0]
    if (worst && worst.diff <= -3) {
      out.push({
        tone: 'bad',
        text: `${periodLabel(worst.p)} is our weakest quarter: outscored ${worst.ga}–${worst.gf} in it over ${played.length} games.`,
      })
    }
  }
  return out
}

// ── Players, for the tracker and the tables ─────────────────────────────────

/** A player as the stats pages show them. */
export interface StatPlayer {
  id: string
  name: string
  number: string | null
  position: string | null
  is_active: boolean
}

/** "#12 J. Smith", or just the name. */
export function playerLabel(p: StatPlayer | undefined | null, short = false): string {
  if (!p) return 'Unknown'
  const full = p.name.trim()
  const parts = full.split(/\s+/)
  const name = short && parts.length > 1 ? `${parts[0][0]}. ${parts.slice(1).join(' ')}` : full
  const number = p.number?.trim()
  if (!name) return number ? `#${number}` : 'Unknown'
  return number ? `#${number} ${name}` : name
}

/** The jersey as a number for sorting: "07" and "7" are both 7; "A1" or "" isn't one. */
function jerseyNumber(n: string | null): number | null {
  const t = n?.trim() ?? ''
  return /^\d+$/.test(t) ? Number(t) : null
}

/**
 * Jersey order: numbered players by number, then everyone else by name.
 * "00" sorts before "0", and "07" before "7", so a list never jumps about.
 */
export function byJersey(a: StatPlayer, b: StatPlayer): number {
  const na = jerseyNumber(a.number)
  const nb = jerseyNumber(b.number)
  if (na != null && nb != null && na !== nb) return na - nb
  if (na != null && nb == null) return -1
  if (na == null && nb != null) return 1
  if (na != null && nb != null) {
    const la = a.number!.trim().length
    const lb = b.number!.trim().length
    if (la !== lb) return lb - la
  }
  return a.name.localeCompare(b.name) || a.id.localeCompare(b.id)
}

/** A one-line description of an event for the tracker's log ("#12 Smith — Goal (A: #7)"). */
export function describeEvent(e: StatEvent, players: Map<string, StatPlayer>): string {
  const who = (id: string | null) => (id ? playerLabel(players.get(id), true) : null)
  const sit = e.situation !== 'even' ? ` · ${SITUATION_LABELS[e.situation]}` : ''
  switch (e.kind) {
    case 'shot': {
      const res = SHOT_LABELS[(e.result as ShotResult) ?? 'missed'] ?? 'Shot'
      if (e.side === 'us') {
        const a = e.result === 'goal' && e.assist_id ? ` (A: ${who(e.assist_id)})` : ''
        return `${who(e.player_id) ?? 'Shot'} — ${res === 'Goal' ? 'Goal' : `Shot, ${res.toLowerCase()}`}${a}${sit}`
      }
      return `Their shot — ${res.toLowerCase()}${e.player_id ? ` (${who(e.player_id)} in goal)` : ''}${sit}`
    }
    case 'ground_ball':
      return e.side === 'us' ? `${who(e.player_id) ?? 'Us'} — Ground ball` : 'Their ground ball'
    case 'faceoff': {
      const fo = `Faceoff ${e.result === 'won' ? 'won' : 'lost'}`
      return e.player_id ? `${who(e.player_id)} — ${fo}` : fo
    }
    case 'turnover':
      return e.side === 'us'
        ? `${who(e.player_id) ?? 'Us'} — Turnover${e.result === 'caused' ? ' (caused)' : ''}`
        : `Their turnover${e.player_id ? ` — caused by ${who(e.player_id)}` : ''}`
    case 'clear':
      return e.side === 'us'
        ? `Our clear — ${e.result === 'success' ? 'success' : 'failed'}`
        : `Their clear — ${e.result === 'success' ? 'success' : 'failed (good ride)'}`
    case 'penalty':
      return e.side === 'us'
        ? `${who(e.player_id) ?? 'Us'} — Penalty${e.penalty_minutes ? `, ${e.penalty_minutes} min` : ''}`
        : `Their penalty${e.penalty_minutes ? `, ${e.penalty_minutes} min` : ''}`
  }
}
