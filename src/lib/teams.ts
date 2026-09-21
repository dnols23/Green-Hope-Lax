/**
 * Varsity and JV.
 *
 * Two staffs planning two weeks. Which one you are working in rides in the URL
 * rather than in a setting somewhere: a JV coach can keep his War Room open in
 * one tab and the varsity one in another, a link to a plan lands on the right
 * side without anybody switching first, and nothing has to be remembered
 * between visits.
 */

export type Team = 'varsity' | 'jv'

export const TEAMS: { key: Team; label: string; short: string }[] = [
  { key: 'varsity', label: 'Varsity', short: 'Varsity' },
  { key: 'jv', label: 'JV', short: 'JV' },
]

export const DEFAULT_TEAM: Team = 'varsity'

export function isTeam(value: unknown): value is Team {
  return value === 'varsity' || value === 'jv'
}

/** Whatever came in on the query string, kept honest. */
export function readTeam(value: unknown): Team {
  const first = Array.isArray(value) ? value[0] : value
  return isTeam(first) ? first : DEFAULT_TEAM
}

export function teamLabel(team: Team): string {
  return TEAMS.find((t) => t.key === team)?.label ?? 'Varsity'
}

/**
 * The same page, on the other team. Varsity is the plain address — it is the
 * one most links in the wild already point at, and a bare link should land
 * somewhere rather than nowhere.
 */
export function withTeam(href: string, team: Team): string {
  if (team === DEFAULT_TEAM) return href
  const [path, query = ''] = href.split('?')
  const params = new URLSearchParams(query)
  params.set('team', team)
  return `${path}?${params.toString()}`
}
