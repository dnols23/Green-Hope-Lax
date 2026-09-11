import { createServiceClient } from './supabase-server'
import type { DrillSetItem, FocusArea } from './prescribe'

// Stored drill sets: what was actually prescribed, kept so a player's page
// doesn't change under them between evaluations.

export interface StoredDrillSet {
  id: string
  playerId: string
  items: DrillSetItem[]
  focus: FocusArea[]
  note: string | null
  season: string | null
  createdBy: string | null
  createdAt: string
}

export async function drillSetsReady(): Promise<boolean> {
  const svc = createServiceClient()
  const { error } = await svc.from('player_drill_sets').select('id').limit(1)
  return !error
}

function shape(row: Record<string, unknown>): StoredDrillSet {
  return {
    id: String(row.id),
    playerId: String(row.player_id),
    items: Array.isArray(row.items) ? (row.items as DrillSetItem[]) : [],
    focus: Array.isArray(row.focus) ? (row.focus as FocusArea[]) : [],
    note: (row.note as string) ?? null,
    season: (row.season as string) ?? null,
    createdBy: (row.created_by as string) ?? null,
    createdAt: String(row.created_at ?? ''),
  }
}

/** The current set for one player — the most recent one prescribed. */
export async function latestDrillSet(playerId: string): Promise<StoredDrillSet | null> {
  const svc = createServiceClient()
  const { data } = await svc
    .from('player_drill_sets')
    .select('*')
    .eq('player_id', playerId)
    .order('created_at', { ascending: false })
    .limit(1)
  const row = (data ?? [])[0]
  return row ? shape(row as Record<string, unknown>) : null
}

/** The current set for every player who has one, keyed by player. */
export async function latestDrillSets(): Promise<Record<string, StoredDrillSet>> {
  const svc = createServiceClient()
  const { data, error } = await svc
    .from('player_drill_sets')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) return {}
  const out: Record<string, StoredDrillSet> = {}
  for (const row of (data ?? []) as Record<string, unknown>[]) {
    const set = shape(row)
    // Ordered newest first, so the first one seen per player is the current one.
    if (!out[set.playerId]) out[set.playerId] = set
  }
  return out
}
