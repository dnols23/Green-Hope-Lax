// Words for games and stretches of games, as the report screen and the sheet
// both say them. Server only (dates are put in Cary time here, never in the
// browser), and no stat math: every number comes from lib/stats.

import { GAME_FILTERS, recordOf, seasonOf, type GameFilter, type GameSummary } from '@/lib/stats'
import { TEAM_TIME_ZONE, formatDate, formatDateTime } from '@/lib/format'

/** "Mar 13". */
export function gameDate(g: GameSummary): string {
  return formatDate(g.game.game_date, { weekday: undefined })
}

/** "vs Panther Creek", "@ Apex". */
export function opponentLabel(g: GameSummary): string {
  return `${g.game.home_away === 'away' ? '@' : 'vs'} ${g.game.opponent || 'TBD'}`
}

/** "12–8", or null without a score. */
export function scoreLabel(g: GameSummary): string | null {
  return g.goalsFor != null && g.goalsAgainst != null ? `${g.goalsFor}–${g.goalsAgainst}` : null
}

/** "W 12–8"; a game still going says so rather than claiming a result. */
export function resultLabel(g: GameSummary): string {
  const score = scoreLabel(g)
  if (g.outcome && score) return `${g.outcome} ${score}`
  return score ? `${score}, not final` : 'No score'
}

/** "9–3" (or "9–3–1"), with the dash a printed page wants. */
export function recordLabel(games: GameSummary[]): string {
  return recordOf(games).label.replace(/-/g, '–')
}

export function filterLabel(f: GameFilter): string {
  return GAME_FILTERS.find((x) => x.key === f)?.label ?? 'All games'
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`
}

/** "Mar 3 – Apr 28, 2026" for a stretch of games (already oldest first). */
export function dateSpan(games: GameSummary[]): string | null {
  if (!games.length) return null
  const first = games[0].game.game_date
  const last = games[games.length - 1].game.game_date
  const year = (iso: string) => new Intl.DateTimeFormat('en-US', { timeZone: TEAM_TIME_ZONE, year: 'numeric' }).format(new Date(iso))
  const end = formatDate(last, { weekday: undefined, year: 'numeric' })
  if (games.length === 1) return end
  const start = formatDate(first, { weekday: undefined, year: year(first) === year(last) ? undefined : 'numeric' })
  return `${start} – ${end}`
}

/** "12 games · 9–3", plus how many have no result yet when some are still going. */
export function stretchLine(games: GameSummary[]): string {
  const open = games.filter((g) => !g.outcome).length
  return [plural(games.length, 'game'), recordLabel(games), open ? `${open} not final` : null].filter(Boolean).join(' · ')
}

/** "vs Panther Creek · Mar 13 · W 12–8". */
export function gameLine(g: GameSummary): string {
  return [opponentLabel(g), gameDate(g), resultLabel(g)].join(' · ')
}

/** When the sheet was made, in Cary time: "Oct 7, 2026, 3:12 PM ET". */
export function generatedNow(): string {
  return `${formatDateTime(new Date().toISOString())} ET`
}

/** The seasons with at least one tracked game, newest first. */
export function trackedSeasons(games: GameSummary[]): number[] {
  const years = new Set(games.filter((g) => g.tracked).map((g) => seasonOf(g.game)).filter((y): y is number => y != null))
  return [...years].sort((a, b) => b - a)
}

/** One season's games (all of them, tracked or not: filterGames picks the tracked ones). */
export function gamesIn(games: GameSummary[], season: number): GameSummary[] {
  return games.filter((g) => seasonOf(g.game) === season)
}

/** Finished games nobody tracked: they have a score on the schedule but no stats to count. */
export function untrackedFinals(games: GameSummary[]): number {
  return games.filter((g) => !g.tracked && g.game.status === 'final').length
}
