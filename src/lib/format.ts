import type { Game } from './types'

export function formatDate(iso: string, opts?: Intl.DateTimeFormatOptions): string {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...opts,
  })
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })
}

// Returns the W/L/T result for a finished game from Green Hope's perspective.
export function gameResult(g: Game): { kind: 'W' | 'L' | 'T'; label: string; cls: string } | null {
  if (g.status !== 'final' || g.team_score == null || g.opp_score == null) return null
  if (g.team_score > g.opp_score)
    return { kind: 'W', label: `W ${g.team_score}–${g.opp_score}`, cls: 'badge-win' }
  if (g.team_score < g.opp_score)
    return { kind: 'L', label: `L ${g.team_score}–${g.opp_score}`, cls: 'badge-loss' }
  return { kind: 'T', label: `T ${g.team_score}–${g.opp_score}`, cls: 'badge-tie' }
}

export function homeAwayLabel(g: Game): string {
  if (g.home_away === 'home') return 'vs'
  if (g.home_away === 'away') return '@'
  return 'vs'
}

// The lacrosse season is named for the spring year it ends in (e.g. games played
// in spring 2026 are the "2026 season"). Group finished/scheduled games by year.
export function seasonYear(iso: string): number {
  return new Date(iso).getFullYear()
}

export interface SeasonSummary {
  year: number
  wins: number
  losses: number
  ties: number
  confWins: number
  confLosses: number
  goalsFor: number
  goalsAgainst: number
  played: number
  scheduled: number
}

// Compute a won/loss summary for one season's games, from Green Hope's
// perspective. Only 'final' games with both scores count toward the record.
export function summarizeSeason(games: Game[], year: number): SeasonSummary {
  const s: SeasonSummary = {
    year, wins: 0, losses: 0, ties: 0, confWins: 0, confLosses: 0,
    goalsFor: 0, goalsAgainst: 0, played: 0, scheduled: 0,
  }
  for (const g of games) {
    if (seasonYear(g.game_date) !== year) continue
    if (g.status === 'scheduled') s.scheduled++
    const res = gameResult(g)
    if (!res || g.team_score == null || g.opp_score == null) continue
    s.played++
    s.goalsFor += g.team_score
    s.goalsAgainst += g.opp_score
    if (res.kind === 'W') { s.wins++; if (g.is_conference) s.confWins++ }
    else if (res.kind === 'L') { s.losses++; if (g.is_conference) s.confLosses++ }
    else s.ties++
  }
  return s
}

export function recordLabel(s: SeasonSummary): string {
  return s.ties > 0 ? `${s.wins}–${s.losses}–${s.ties}` : `${s.wins}–${s.losses}`
}
