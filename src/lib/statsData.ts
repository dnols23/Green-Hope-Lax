// Reading game stats. Server only; every page calls requireTeam('stats', …)
// before any of these. stat_events has no policy for signed-in reads, so this
// goes through the server's own key.
//
// A failed read throws rather than coming back empty: a box score missing
// half its events would look like a real one, and finishStatGame would write
// the short count onto the schedule as the final score.

import { createServiceClient } from './supabase-server'
import {
  byJersey,
  readStatEvent,
  summarizeGame,
  type GameSummary,
  type StatEvent,
  type StatGame,
  type StatPlayer,
} from './stats'
import type { Team } from './teams'

type Row = Record<string, unknown>

/**
 * Supabase hands back at most a fixed number of rows per request (1000 unless
 * the project says otherwise), whatever .limit() asks for. A season is several
 * thousand events, so read page after page until one comes back empty.
 */
const PAGE = 1000
async function everyRow(
  what: string,
  page: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>,
): Promise<Row[]> {
  const rows: Row[] = []
  for (let from = 0; ; ) {
    const { data, error } = await page(from, from + PAGE - 1)
    if (error) throw new Error(`Couldn’t load ${what}: ${error.message}`)
    const got = (data ?? []) as Row[]
    if (!got.length) return rows
    rows.push(...got)
    from += got.length
  }
}

function readPlayer(p: Row, active: boolean): StatPlayer {
  return {
    id: String(p.id),
    name: String(p.name ?? ''),
    number: p.number == null || String(p.number).trim() === '' ? null : String(p.number).trim(),
    position: typeof p.position === 'string' && p.position ? p.position : null,
    is_active: active,
  }
}

function readGame(row: Record<string, unknown>): StatGame {
  const num = (v: unknown) => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v))
  return {
    id: String(row.id),
    game_date: String(row.game_date ?? ''),
    opponent: String(row.opponent ?? ''),
    home_away: row.home_away === 'away' || row.home_away === 'neutral' ? row.home_away : 'home',
    level: row.level === 'jv' ? 'jv' : 'varsity',
    is_conference: row.is_conference === true,
    status: String(row.status ?? 'scheduled'),
    team_score: num(row.team_score),
    opp_score: num(row.opp_score),
  }
}

/** The boys' games for one team, oldest first. A game with no level is varsity's. */
export async function listStatGames(team: Team): Promise<StatGame[]> {
  const svc = createServiceClient()
  const rows = await everyRow('the games', (from, to) =>
    svc.from('games').select('*').eq('gender', 'boys').order('game_date', { ascending: true }).order('id').range(from, to),
  )
  return rows.map(readGame).filter((g) => g.level === team)
}

/** One boys' game. A girls' game isn't one the stats pages track. */
export async function getStatGame(id: string): Promise<StatGame | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null
  const { data, error } = await createServiceClient().from('games').select('*').eq('id', id).eq('gender', 'boys').maybeSingle()
  if (error) throw new Error(`Couldn’t load the game: ${error.message}`)
  return data ? readGame(data as Record<string, unknown>) : null
}

/** Every event in these games, in the order they were logged. */
export async function listStatEvents(gameIds: string[]): Promise<StatEvent[]> {
  const ids = [...new Set(gameIds)]
  if (!ids.length) return []
  const svc = createServiceClient()
  const out: StatEvent[] = []
  // In chunks, so a long season never makes one enormous URL; each chunk a
  // page at a time (seq is unique, so the pages never overlap or skip).
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100)
    const rows = await everyRow('the stats', (from, to) =>
      svc.from('stat_events').select('*').in('game_id', chunk).order('seq', { ascending: true }).range(from, to),
    )
    for (const row of rows) {
      const e = readStatEvent(row)
      if (e) out.push(e)
    }
  }
  return out.sort((a, b) => a.seq - b.seq)
}

/**
 * One team's players, in jersey order. Inactive players are included (flagged)
 * because last season's stats still need their names.
 */
export async function listStatPlayers(team: Team): Promise<StatPlayer[]> {
  const svc = createServiceClient()
  const rows = await everyRow('the roster', (from, to) =>
    svc
      .from('players')
      .select('id, name, number, position, is_active, team')
      .eq('team', team === 'jv' ? 'boys_jv' : 'boys_varsity')
      .order('id')
      .range(from, to),
  )
  return rows.map((p) => readPlayer(p, p.is_active !== false)).sort(byJersey)
}

/** Players by id, for labelling events and lines. */
export function playerMap(players: StatPlayer[]): Map<string, StatPlayer> {
  return new Map(players.map((p) => [p.id, p]))
}

export interface Season {
  team: Team
  games: GameSummary[]
  events: StatEvent[]
  players: StatPlayer[]
}

/** Everything the stats pages need for one team: games (summarised), every event, the players. */
export async function loadSeason(team: Team): Promise<Season> {
  const [games, roster] = await Promise.all([listStatGames(team), listStatPlayers(team)])
  const events = await listStatEvents(games.map((g) => g.id))
  return {
    team,
    games: games.map((g) => summarizeGame(g, events)),
    events,
    players: await withFormerPlayers(roster, events),
  }
}

/**
 * The roster plus anyone else these events name. Players who left the team
 * (or moved to the other roster) still show by name on old stats; they come
 * back flagged inactive: not on this roster now.
 */
export async function withFormerPlayers(roster: StatPlayer[], events: StatEvent[]): Promise<StatPlayer[]> {
  const players = [...roster]
  const known = new Set(players.map((p) => p.id))
  const missing = [...new Set(events.flatMap((e) => [e.player_id, e.assist_id]).filter((id): id is string => !!id && !known.has(id)))]
  if (!missing.length) return players
  const svc = createServiceClient()
  for (let i = 0; i < missing.length; i += 100) {
    const { data, error } = await svc.from('players').select('id, name, number, position').in('id', missing.slice(i, i + 100))
    if (error) throw new Error(`Couldn’t load the roster: ${error.message}`)
    for (const p of (data ?? []) as Row[]) players.push(readPlayer(p, false))
  }
  return players.sort(byJersey)
}

/** The tracker's own names for the stats already saved in a game (see StatInput.clientKey). */
export async function savedClientKeys(gameId: string): Promise<string[]> {
  const { data } = await createServiceClient().from('stat_events').select('client_key').eq('game_id', gameId).not('client_key', 'is', null)
  return ((data ?? []) as { client_key: string | null }[]).map((r) => r.client_key).filter((k): k is string => !!k)
}
