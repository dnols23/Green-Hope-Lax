// What a team film is and where it's kept. Pure, so the upload popup, the
// Library and the API agree.

import { TEAM_TIME_ZONE } from '@/lib/format'

export type FilmType = 'game' | 'practice' | 'scout' | 'highlights' | 'teaching' | 'other'

export const FILM_TYPES: { key: FilmType; label: string; plural: string }[] = [
  { key: 'game', label: 'Game', plural: 'Games' },
  { key: 'practice', label: 'Practice', plural: 'Practice' },
  { key: 'scout', label: 'Scouting', plural: 'Scouting' },
  { key: 'highlights', label: 'Highlights', plural: 'Highlights' },
  { key: 'teaching', label: 'Teaching', plural: 'Teaching' },
  { key: 'other', label: 'Other', plural: 'Other' },
]

export const isFilmType = (v: unknown): v is FilmType => FILM_TYPES.some((t) => t.key === v)
export const filmTypeLabel = (v: FilmType | undefined) => FILM_TYPES.find((t) => t.key === v)?.label ?? 'Film'

/** A game on the schedule, as the film pages need it. */
export interface FilmGame {
  id: string
  date: string
  opponent: string
  homeAway: 'home' | 'away' | 'neutral'
  level: 'varsity' | 'jv'
}

/** "vs Panther Creek · Mar 4" — JV games say so. */
export function gameLabel(g: FilmGame, withYear = false): string {
  const d = new Date(g.date)
  const day = isNaN(+d)
    ? ''
    : d.toLocaleDateString('en-US', {
        timeZone: TEAM_TIME_ZONE,
        month: 'short',
        day: 'numeric',
        ...(withYear ? { year: 'numeric' } : {}),
      })
  const at = g.homeAway === 'away' ? '@' : 'vs'
  return `${g.level === 'jv' ? 'JV ' : ''}${at} ${g.opponent}${day ? ` · ${day}` : ''}`
}

export interface FilmDetails {
  name: string
  category: FilmType
  gameId: string | null
  folder: string | null
  notes: string | null
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Whatever came in, as columns — only the fields that were sent. */
export function detailColumns(body: Record<string, unknown>): Record<string, string | null> {
  const out: Record<string, string | null> = {}
  if (typeof body.name === 'string' && body.name.trim()) out.name = body.name.trim().slice(0, 120)
  if (isFilmType(body.category)) out.category = body.category
  if (body.gameId === null || (typeof body.gameId === 'string' && UUID.test(body.gameId))) out.game_id = body.gameId
  if (body.folder === null || typeof body.folder === 'string')
    out.folder = typeof body.folder === 'string' ? body.folder.replace(/\s+/g, ' ').trim().slice(0, 60) || null : null
  if (body.notes === null || typeof body.notes === 'string')
    out.notes = typeof body.notes === 'string' ? body.notes.trim().slice(0, 2000) || null : null
  return out
}
