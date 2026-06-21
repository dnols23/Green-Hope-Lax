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
