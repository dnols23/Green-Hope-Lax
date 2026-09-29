import { createServiceClient } from './supabase-server'

/**
 * What each coach is in the middle of: the plans he has worked on and not
 * called done. Kept per coach in app_settings, so no SQL — newest first, and a
 * plan drops off when he says it's done or it goes untouched for a month.
 */

export interface Building {
  id: string
  /** When he last worked on it. */
  at: string
}

const MAX = 12
const STALE_DAYS = 30
const key = (email: string) => `building:${email.toLowerCase()}`

export async function readBuilding(email: string): Promise<Building[]> {
  const { data } = await createServiceClient().from('app_settings').select('value').eq('key', key(email)).maybeSingle()
  let raw: unknown = (data as { value?: unknown } | null)?.value
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw)
    } catch {
      raw = []
    }
  }
  const cutoff = Date.now() - STALE_DAYS * 86_400_000
  return (Array.isArray(raw) ? raw : [])
    .filter((b): b is Building => !!b && typeof b.id === 'string' && typeof b.at === 'string')
    .filter((b) => Date.parse(b.at) > cutoff)
    .slice(0, MAX)
}

async function write(email: string, list: Building[]) {
  await createServiceClient()
    .from('app_settings')
    .upsert({ key: key(email), value: JSON.stringify(list.slice(0, MAX)) }, { onConflict: 'key' })
}

/** He just worked on this one: to the top of his list. */
export async function noteBuilding(email: string, id: string) {
  const list = await readBuilding(email)
  await write(email, [{ id, at: new Date().toISOString() }, ...list.filter((b) => b.id !== id)])
}

export async function dropBuilding(email: string, id: string) {
  const list = await readBuilding(email)
  if (list.some((b) => b.id === id)) await write(email, list.filter((b) => b.id !== id))
}
