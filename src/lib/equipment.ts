import { createServiceClient } from './supabase-server'

/**
 * Who has what.
 *
 * Signing a helmet out doesn't change how many helmets the program owns, so
 * nothing here edits the inventory count — an item is simply "3 of 12 out"
 * while three rows point at it and nobody has brought them back.
 */

export interface EquipmentAssignment {
  id: string
  item_id: string | null
  item_name: string
  size: string | null
  player_id: string | null
  player_name: string
  quantity: number
  out_at: string
  due_at: string | null
  returned_at: string | null
  condition_out: string | null
  notes: string | null
  signed_by: string | null
  created_at: string
}

/** True once the sign-out table exists. */
export async function equipmentReady(): Promise<boolean> {
  const { error } = await createServiceClient().from('equipment_assignments').select('id').limit(1)
  return !error
}

export async function listAssignments(opts: { playerId?: string; itemId?: string; includeReturned?: boolean } = {}) {
  let q = createServiceClient()
    .from('equipment_assignments')
    .select('*')
    .order('out_at', { ascending: false })
  if (opts.playerId) q = q.eq('player_id', opts.playerId)
  if (opts.itemId) q = q.eq('item_id', opts.itemId)
  if (!opts.includeReturned) q = q.is('returned_at', null)
  const { data } = await q
  return (data as EquipmentAssignment[]) ?? []
}

/** How many of each item are out right now, by item id. */
export function outByItem(rows: EquipmentAssignment[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const r of rows) {
    if (r.returned_at || !r.item_id) continue
    out[r.item_id] = (out[r.item_id] ?? 0) + r.quantity
  }
  return out
}

export async function signOut(input: {
  itemId: string
  itemName: string
  size: string | null
  playerId: string
  playerName: string
  quantity: number
  dueAt: string | null
  condition: string | null
  notes: string | null
  signedBy: string | null
}): Promise<{ ok: boolean; error?: string }> {
  const { error } = await createServiceClient().from('equipment_assignments').insert({
    item_id: input.itemId,
    item_name: input.itemName,
    size: input.size,
    player_id: input.playerId,
    player_name: input.playerName,
    quantity: input.quantity,
    due_at: input.dueAt,
    condition_out: input.condition,
    notes: input.notes,
    signed_by: input.signedBy,
  })
  return error ? { ok: false, error: error.message } : { ok: true }
}

export async function markReturned(id: string): Promise<void> {
  await createServiceClient()
    .from('equipment_assignments')
    .update({ returned_at: new Date().toISOString() })
    .eq('id', id)
}

/** Undo a return — the wrong row gets ticked often enough to matter. */
export async function markOutAgain(id: string): Promise<void> {
  await createServiceClient().from('equipment_assignments').update({ returned_at: null }).eq('id', id)
}

export async function deleteAssignment(id: string): Promise<void> {
  await createServiceClient().from('equipment_assignments').delete().eq('id', id)
}
