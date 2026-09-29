import { createServiceClient } from './supabase-server'
import { builtIns, readQuote } from './wallData'
import { quoteIndexForDay, type WallQuote } from './wallModel'
import { PLAYER_WAR_ROOM_KEY, readPlayerWarRoom, type PlayerWarRoom } from './playerWarRoom'
import { listPriorities, type PriorityItem } from './priorities'
import { listPracticePlansBetween } from './plans'
import type { Plan } from './planner'

/**
 * The players' War Room, read from the database. Server only; everything goes
 * through the service role and only what a player may see comes back.
 */

export async function readPlayerWarRoomConfig(): Promise<PlayerWarRoom> {
  const { data } = await createServiceClient()
    .from('app_settings')
    .select('value')
    .eq('key', PLAYER_WAR_ROOM_KEY)
    .maybeSingle()
  return readPlayerWarRoom((data as { value?: unknown } | null)?.value)
}

export interface QuoteShelf {
  quotes: WallQuote[]
  /** Shared playlists only — a coach's private one is his. */
  playlists: { id: string; name: string; quoteIds: string[] }[]
}

/** Every quote on the Wall and the staff's shared playlists; the built-ins before 0040. */
export async function quoteShelf(): Promise<QuoteShelf> {
  const svc = createServiceClient()
  const [q, l, i] = await Promise.all([
    svc.from('wall_quotes').select('*').order('created_at', { ascending: true }),
    svc.from('wall_playlists').select('id, name, shared').order('created_at', { ascending: true }),
    svc.from('wall_playlist_items').select('playlist_id, quote_id, position').order('position', { ascending: true }),
  ])
  if (q.error) return { quotes: builtIns(), playlists: [] }
  const items = (i.data ?? []) as { playlist_id: string; quote_id: string }[]
  return {
    quotes: ((q.data ?? []) as Record<string, unknown>[]).map(readQuote),
    playlists: ((l.data ?? []) as Record<string, unknown>[])
      .filter((p) => p.shared !== false)
      .map((p) => ({
        id: String(p.id),
        name: String(p.name ?? 'Playlist'),
        quoteIds: items.filter((x) => String(x.playlist_id) === String(p.id)).map((x) => String(x.quote_id)),
      })),
  }
}

/** Today's quote, as the head coach chose it. */
export function pickQuote(w: PlayerWarRoom, shelf: QuoteShelf, todayYmd: string): { line: string; who: string | null } | null {
  const q = w.quote
  if (q.mode === 'custom') return q.line.trim() ? { line: q.line.trim(), who: q.who.trim() || null } : null
  if (q.mode === 'pick') {
    const found = shelf.quotes.find((x) => x.id === q.quoteId)
    return found ? { line: found.line, who: found.who } : null
  }
  const ids = q.source === 'all' ? null : shelf.playlists.find((p) => p.id === q.source)?.quoteIds
  const pool = ids ? ids.map((id) => shelf.quotes.find((x) => x.id === id)).filter((x): x is WallQuote => !!x) : shelf.quotes
  if (!pool.length) return null
  const one = pool[quoteIndexForDay(todayYmd, pool.length)]
  return { line: one.line, who: one.who }
}

/** Today's practice plans that were published to the players, from the teams he chose. */
export async function todaysPlayerPlans(w: PlayerWarRoom, todayYmd: string): Promise<Plan[]> {
  if (!w.planTeams.length) return []
  const plans = await listPracticePlansBetween(todayYmd, todayYmd)
  return plans
    .filter((p) => p.publish_players && !p.private && w.planTeams.includes(p.team))
    .sort((a, b) => (a.start_time ?? '').localeCompare(b.start_time ?? ''))
}

export interface PlayerPriorityList {
  id: string
  name: string
  team: 'varsity' | 'jv'
  /** Open items only, and only what the item says — never the staff's notes. */
  items: Pick<PriorityItem, 'id' | 'body' | 'level'>[]
}

/** Every priority list on both teams, for the builder to pick from. */
export async function allPriorityLists(): Promise<PlayerPriorityList[]> {
  const [v, j] = await Promise.all([listPriorities('varsity'), listPriorities('jv')])
  const shape = (team: 'varsity' | 'jv') => (l: Awaited<ReturnType<typeof listPriorities>>[number]) => ({
    id: l.id,
    name: l.name,
    team,
    items: l.items.filter((i) => !i.done).map((i) => ({ id: i.id, body: i.body, level: i.level })),
  })
  return [...v.map(shape('varsity')), ...j.map(shape('jv'))]
}

/** The lists he let the players see, in the order he picked them. */
export async function playerPriorities(w: PlayerWarRoom): Promise<PlayerPriorityList[]> {
  if (!w.priorityLists.length) return []
  const all = await allPriorityLists()
  return w.priorityLists.map((id) => all.find((l) => l.id === id)).filter((l): l is PlayerPriorityList => !!l)
}
