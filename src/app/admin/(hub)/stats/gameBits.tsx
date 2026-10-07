// Small pieces the Games list and the box score both show, so a game reads the
// same way on each: "vs Cary" / "at Apex", "12–7", the W/L/T chip, the date.
// Formatting only — every number comes from src/lib/stats.ts.

import { TEAM_TIME_ZONE } from '@/lib/format'
import { daysBetweenYmd } from '@/lib/zoned'
import type { Outcome, StatGame } from '@/lib/stats'

export const US = 'Green Hope'

/** "vs" at home or on a neutral field, "at" on the road. */
export function vsAt(g: StatGame): string {
  return g.home_away === 'away' ? 'at' : 'vs'
}

export function siteLabel(g: StatGame): string {
  return g.home_away === 'away' ? 'Away' : g.home_away === 'neutral' ? 'Neutral site' : 'Home'
}

/** "12–7", or null when there is no score to show. */
export function scoreText(gf: number | null, ga: number | null): string | null {
  return gf == null || ga == null ? null : `${gf}–${ga}`
}

const fmt = (iso: string, opts: Intl.DateTimeFormatOptions) =>
  new Date(iso).toLocaleString('en-US', { timeZone: TEAM_TIME_ZONE, ...opts })

/** "Oct" and "7", for the little calendar block on a row. */
export function monthDay(iso: string): { month: string; day: string } {
  return { month: fmt(iso, { month: 'short' }), day: fmt(iso, { day: 'numeric' }) }
}

/** "Sat, Mar 14, 2027". */
export function longDate(iso: string): string {
  return fmt(iso, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}

/** "7:00 PM". */
export function clock(iso: string): string {
  return fmt(iso, { hour: 'numeric', minute: '2-digit' })
}

/** "Today", "Tomorrow", "Sat, Mar 14" — the way you'd say when the next game is. */
export function whenLabel(ymd: string, iso: string, today: string): string {
  const d = daysBetweenYmd(today, ymd)
  if (d === 0) return 'Today'
  if (d === 1) return 'Tomorrow'
  if (d === -1) return 'Yesterday'
  return fmt(iso, { weekday: 'short', month: 'short', day: 'numeric' })
}

/** The W / L / T chip, in the site's result colours. */
export function OutcomeChip({ outcome, className = '' }: { outcome: Outcome | null; className?: string }) {
  if (!outcome) return null
  const cls = outcome === 'W' ? 'badge-win' : outcome === 'L' ? 'badge-loss' : 'badge-tie'
  const word = outcome === 'W' ? 'Win' : outcome === 'L' ? 'Loss' : 'Tie'
  return (
    <span className={`badge ${cls} ${className}`} title={word}>
      <span aria-hidden>{outcome}</span>
      <span className="sr-only">{word}</span>
    </span>
  )
}
