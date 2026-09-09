import { createServiceClient } from './supabase-server'
import type { Player } from './types'

export { parseRosterPaste, type ParsedPlayer } from './rosterParse'

// Named rosters coaches build for themselves — "2026 Tryouts", "Fall Ball" —
// separate from the public /roster page, which shows only players marked active.

export interface PlayerList {
  id: string
  name: string
  season: string | null
  notes: string | null
  is_archived: boolean
  is_public: boolean
  created_at: string
  updated_at: string
}

export interface PlayerListWithCount extends PlayerList {
  memberCount: number
}

export async function listRosters(includeArchived = false): Promise<PlayerListWithCount[]> {
  const svc = createServiceClient()
  let q = svc.from('player_lists').select('*').order('is_archived').order('name')
  if (!includeArchived) q = q.eq('is_archived', false)
  const { data, error } = await q
  if (error) return []
  const lists = (data as PlayerList[]) ?? []
  if (lists.length === 0) return []

  const { data: memberRows } = await svc
    .from('player_list_members')
    .select('list_id')
    .in('list_id', lists.map((l) => l.id))

  const counts = new Map<string, number>()
  for (const m of (memberRows ?? []) as { list_id: string }[]) {
    counts.set(m.list_id, (counts.get(m.list_id) ?? 0) + 1)
  }
  return lists.map((l) => ({ ...l, memberCount: counts.get(l.id) ?? 0 }))
}

export async function getRoster(id: string): Promise<PlayerList | null> {
  const svc = createServiceClient()
  const { data } = await svc.from('player_lists').select('*').eq('id', id).maybeSingle()
  return (data as PlayerList) ?? null
}

/** Players on a roster, in the order the roster puts them. */
export async function rosterMembers(listId: string): Promise<Player[]> {
  const svc = createServiceClient()
  const { data } = await svc
    .from('player_list_members')
    .select('sort_order, players(*)')
    .eq('list_id', listId)
    .order('sort_order')

  const rows = (data ?? []) as unknown as { sort_order: number; players: Player | null }[]
  return rows.map((r) => r.players).filter((p): p is Player => p !== null)
}

/** True when the rosters tables haven't been created yet. */
export async function rostersReady(): Promise<boolean> {
  const svc = createServiceClient()
  const { error } = await svc.from('player_lists').select('id').limit(1)
  return !error
}

/**
 * The roster the public /roster page is showing right now.
 *
 * Before named rosters existed, the public list was just the players marked
 * active — and that list is still there. The Rosters screen would otherwise say
 * "0 rosters" to a coach looking at a live public roster, so it reports this one
 * and offers to take it over.
 */
export async function publicPlayers(): Promise<Player[]> {
  const svc = createServiceClient()
  const { data } = await svc
    .from('players')
    .select('*')
    .eq('is_active', true)
    .order('sort_order')
    .order('name')
  return ((data as Player[]) ?? [])
}
