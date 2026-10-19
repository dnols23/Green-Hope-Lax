import { createServiceClient } from './supabase-server'

// The bag & glove head count. Six of an item have to be ordered for the
// order to go through, so families say they want one ahead of time.

import { isGearItem, type GearItem } from './gearItems'
export * from './gearItems'

export interface GearRow {
  id: string
  item: GearItem
  playerName: string
  contactName: string | null
  email: string
  size: string | null
  qty: number
  createdAt: string
}

/** How many of each item families have said they want — or null before the table exists. */
export async function gearCounts(): Promise<Record<GearItem, number> | null> {
  const { data, error } = await createServiceClient().from('gear_interest').select('item, qty')
  if (error) return null
  const out: Record<GearItem, number> = { gloves: 0, bag: 0 }
  for (const r of (data ?? []) as { item: string; qty: number }[]) {
    if (isGearItem(r.item)) out[r.item] += Number(r.qty) || 0
  }
  return out
}

/** Everyone who said they want one, newest first. For the coaches only. */
export async function listGearInterest(): Promise<GearRow[]> {
  const { data } = await createServiceClient().from('gear_interest').select('*').order('created_at', { ascending: false })
  return ((data ?? []) as Record<string, unknown>[])
    .filter((r) => isGearItem(r.item))
    .map((r) => ({
      id: String(r.id),
      item: r.item as GearItem,
      playerName: String(r.player_name ?? ''),
      contactName: (r.contact_name as string) || null,
      email: String(r.email ?? ''),
      size: (r.size as string) || null,
      qty: Number(r.qty) || 1,
      createdAt: String(r.created_at ?? ''),
    }))
}
