'use server'

import { getViewer } from './permissions'
import { createServiceClient } from './supabase-server'

/** Where one coach's War Room layout is kept. */
export const warRoomKey = async (email: string) => `warroom_order:${email.toLowerCase()}`

/**
 * One coach's War Room panel order, kept with his account rather than in
 * one browser — so it's the same on his phone and his laptop, and a cleared
 * cache or a private tab doesn't put it back.
 */
export async function saveWarRoomOrder(keys: string[]): Promise<{ ok: boolean }> {
  const viewer = await getViewer()
  if (!viewer?.email) return { ok: false }
  const order = [...new Set((Array.isArray(keys) ? keys : []).filter((k) => typeof k === 'string' && k.length < 40))].slice(0, 40)
  const { error } = await createServiceClient()
    .from('app_settings')
    .upsert({ key: await warRoomKey(viewer.email), value: JSON.stringify(order) }, { onConflict: 'key' })
  return { ok: !error }
}
