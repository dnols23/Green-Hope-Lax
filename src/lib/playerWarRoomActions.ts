'use server'

import { revalidatePath } from 'next/cache'
import { getViewer } from './permissions'
import { canSee } from './sections'
import { createServiceClient } from './supabase-server'
import { PLAYER_WAR_ROOM_KEY, readPlayerWarRoom } from './playerWarRoom'

/** Save the players' War Room. Whoever edits the Team Hub builds it. */
export async function savePlayerWarRoom(raw: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const viewer = await getViewer()
  if (!viewer || !canSee(viewer, 'team')) return { ok: false, error: 'You don’t have the Team Hub.' }
  const clean = readPlayerWarRoom(raw)
  const { error } = await createServiceClient()
    .from('app_settings')
    .upsert({ key: PLAYER_WAR_ROOM_KEY, value: JSON.stringify(clean) }, { onConflict: 'key' })
  if (error) return { ok: false, error: `Couldn’t save: ${error.message}` }
  revalidatePath('/team')
  revalidatePath('/admin/team')
  return { ok: true }
}
