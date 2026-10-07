// What a printed stats report can hold, and how a report is asked for in the
// address. Shared by the "make a report" screen and the sheet itself, so the
// two can never disagree about what a tick in a box means.
//
// A report is one of two things: a stretch of games (a filter: all of them,
// the last 5, the conference games …) or one game, which prints as a box score.
// Some parts only make sense for one of them — a game-by-game table of one
// game, or "leaders" in a single game, which is just its box score.

import { isGameFilter, type GameFilter } from '@/lib/stats'
import { withTeam, type Team } from '@/lib/teams'

export type ReportMode = 'season' | 'game'

export type SectionKey = 'headline' | 'takeaways' | 'compare' | 'quarters' | 'leaders' | 'games' | 'players' | 'notes'

export interface SectionDef {
  key: SectionKey
  label: string
  hint: string
}

/** The parts of each kind of report, in the order they print. */
export const REPORT_SECTIONS: Record<ReportMode, SectionDef[]> = {
  season: [
    { key: 'headline', label: 'Headline numbers', hint: 'Shooting, saves, faceoffs, clears and more, each against our target' },
    { key: 'takeaways', label: 'Takeaways', hint: 'What the numbers are saying, in plain English' },
    { key: 'compare', label: 'Team vs opponents', hint: 'Our totals beside theirs, and per game' },
    { key: 'quarters', label: 'By quarter', hint: 'Goals and shots for and against, quarter by quarter' },
    { key: 'leaders', label: 'Leaders', hint: 'Top 5 in points, goals, assists, GBs, caused TOs, faceoffs, saves' },
    { key: 'games', label: 'Game by game', hint: 'One line per game: score, shooting, clears, faceoffs, GBs, TOs' },
    { key: 'notes', label: 'Coach’s notes', hint: 'Your notes, or blank lines to write on' },
  ],
  game: [
    { key: 'quarters', label: 'Score by quarter', hint: 'Goals and shots, quarter by quarter' },
    { key: 'takeaways', label: 'Takeaways', hint: 'Where we sat against our targets' },
    { key: 'compare', label: 'Team vs opponent', hint: 'Our totals beside theirs' },
    { key: 'players', label: 'Player lines', hint: 'Every player’s line, and the goalie’s' },
    { key: 'notes', label: 'Coach’s notes', hint: 'Your notes, or blank lines to write on' },
  ],
}

export const ALL_SECTION_KEYS: SectionKey[] = [
  ...new Set([...REPORT_SECTIONS.season, ...REPORT_SECTIONS.game].map((s) => s.key)),
]

/** Long enough for a few points to make in the meeting; short enough to keep the address sane. */
export const NOTES_MAX = 600

/** The first value of a query parameter. */
export function firstParam(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v
}

/**
 * The parts asked for, in print order. Nothing asked for (or nothing that
 * makes sense for this kind of report) means everything: a report with no
 * parts is never what anyone wanted.
 */
export function readSections(raw: string | undefined, mode: ReportMode): SectionKey[] {
  const asked = new Set((raw ?? '').split(',').map((s) => s.trim()))
  const keys = REPORT_SECTIONS[mode].map((s) => s.key)
  const picked = keys.filter((k) => asked.has(k))
  return picked.length ? picked : keys
}

export function readNotes(raw: string | undefined): string {
  return (raw ?? '').trim().slice(0, NOTES_MAX)
}

/**
 * Which games a report covers: a filter within one season (the games list
 * holds every season ever scheduled, and "all games" means this spring's, not
 * every spring's), or one game.
 */
export type ReportScope = { mode: 'season'; season: number | null; filter: GameFilter } | { mode: 'game'; gameId: string }

export function readFilter(raw: string | undefined): GameFilter {
  return isGameFilter(raw) ? raw : 'all'
}

/** A season year from the address, or null to mean the latest one. */
export function readSeasonYear(raw: string | undefined): number | null {
  return raw && /^\d{4}$/.test(raw) ? Number(raw) : null
}

/**
 * The query for a report: the games, the parts (left off when it is all of
 * them) and the notes. The same query opens the sheet and, on the way back,
 * puts the "make a report" screen exactly as it was left.
 */
export function reportQuery(scope: ReportScope, sections: SectionKey[], notes: string): string {
  const keys = REPORT_SECTIONS[scope.mode].map((s) => s.key)
  const picked = keys.filter((k) => sections.includes(k))
  const parts: string[] = []
  if (scope.mode === 'game') parts.push(`game=${encodeURIComponent(scope.gameId)}`)
  else {
    if (scope.season != null) parts.push(`season=${scope.season}`)
    if (scope.filter !== 'all') parts.push(`filter=${scope.filter}`)
  }
  if (picked.length && picked.length < keys.length) parts.push(`sections=${picked.join(',')}`)
  const n = readNotes(notes)
  if (n) parts.push(`notes=${encodeURIComponent(n)}`)
  return parts.join('&')
}

/** The printable sheet. A single game carries its own team, so only a stretch of games names one. */
export function reportSheetHref(team: Team, scope: ReportScope, sections: SectionKey[], notes: string): string {
  const q = reportQuery(scope, sections, notes)
  const href = q ? `/admin/stats-report?${q}` : '/admin/stats-report'
  return scope.mode === 'game' ? href : withTeam(href, team)
}

/** The "make a report" screen, set up as given. */
export function reportBuilderHref(team: Team, scope: ReportScope, sections: SectionKey[], notes: string): string {
  const q = reportQuery(scope, sections, notes)
  return withTeam(q ? `/admin/stats/report?${q}` : '/admin/stats/report', team)
}
