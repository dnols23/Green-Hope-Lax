import { createServiceClient } from './supabase-server'
import { LOOKS_KEY, parseLooks, type SavedLook } from './formations'

/**
 * Looks the staff boxed up and kept.
 *
 * In app_settings rather than a table of their own: a look is a handful of
 * discs, there will never be many, and a coach who wants one at practice should
 * not be waiting on somebody to run a migration first.
 *
 * Never throws — a board that cannot read the shelf is a board with the preset
 * formations on it, which is still a board.
 */

export async function listLooks(): Promise<SavedLook[]> {
  try {
    const { data } = await createServiceClient()
      .from('app_settings')
      .select('value')
      .eq('key', LOOKS_KEY)
      .maybeSingle()
    return parseLooks(data?.value)
  } catch {
    return []
  }
}

async function writeLooks(looks: SavedLook[]): Promise<void> {
  await createServiceClient()
    .from('app_settings')
    .upsert({ key: LOOKS_KEY, value: JSON.stringify(looks) }, { onConflict: 'key' })
}

/** Same name twice is the same look brought up to date, not a second copy. */
export async function saveLook(look: SavedLook): Promise<void> {
  const looks = await listLooks()
  const without = looks.filter((l) => l.name.toLowerCase() !== look.name.toLowerCase())
  await writeLooks([look, ...without].slice(0, 40))
}

export async function deleteLook(id: string): Promise<void> {
  await writeLooks((await listLooks()).filter((l) => l.id !== id))
}
