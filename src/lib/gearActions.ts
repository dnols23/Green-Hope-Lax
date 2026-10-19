'use server'

import { revalidatePath } from 'next/cache'
import { createServiceClient } from './supabase-server'
import { requireSection } from './permissions'
import { GEAR, isGearItem } from './gearInterest'

export type GearResult = { ok: true; items: string[] } | { ok: false; error: string }

const str = (v: FormDataEntryValue | null, max = 120) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max)

/**
 * A family says they want gloves, a bag, or both. Saying it again for the
 * same player and email updates the size and quantity rather than counting
 * twice.
 */
export async function addGearInterest(_prev: GearResult | null, fd: FormData): Promise<GearResult> {
  // A field people can't see: anything filled in here came from a bot.
  if (str(fd.get('website'))) return { ok: true, items: [] }
  const playerName = str(fd.get('player_name'))
  const contactName = str(fd.get('contact_name')) || null
  const email = str(fd.get('email'), 200).toLowerCase()
  if (!playerName) return { ok: false, error: 'Add the player’s name.' }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: 'Add an email we can reach you at.' }

  const rows = GEAR.filter((g) => fd.get(`want_${g.key}`) === 'on').map((g) => {
    const qty = Math.min(10, Math.max(1, Math.round(Number(fd.get(`qty_${g.key}`)) || 1)))
    const size = g.sizes ? str(fd.get(`size_${g.key}`), 30) : ''
    return {
      item: g.key,
      player_name: playerName,
      contact_name: contactName,
      email,
      size: g.sizes && g.sizes.includes(size) ? size : null,
      qty,
      updated_at: new Date().toISOString(),
    }
  })
  if (!rows.length) return { ok: false, error: 'Tick the gloves, the bag, or both.' }
  if (rows.some((r) => !isGearItem(r.item))) return { ok: false, error: 'Something went wrong. Try again.' }

  const { error } = await createServiceClient().from('gear_interest').upsert(rows, { onConflict: 'item,email,player_name' })
  if (error) return { ok: false, error: 'Couldn’t save that. Try again in a minute.' }
  revalidatePath('/shop')
  revalidatePath('/shop/headcount')
  revalidatePath('/admin/shop')
  return { ok: true, items: rows.map((r) => GEAR.find((g) => g.key === r.item)!.name) }
}

/** A coach takes someone off the count. */
export async function deleteGearInterest(id: string): Promise<void> {
  await requireSection('shop')
  await createServiceClient().from('gear_interest').delete().eq('id', id)
  revalidatePath('/shop')
  revalidatePath('/shop/headcount')
  revalidatePath('/admin/shop')
}
