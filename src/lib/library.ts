import { createServiceClient } from './supabase-server'

/**
 * The Library: everything the staff has kept off the board.
 *
 * Two kinds of thing end up here. Recorded plays live in the plays table,
 * because a play is a play whether or not anyone filmed themselves drawing it.
 * Screenshots — a still of the board, taken mid-installation — live here, in
 * the media bucket with a row pointing at them.
 *
 * Anything in the Library can be dropped into a practice plan, a note or a game
 * plan, which is the whole point of keeping it: a play installed in September
 * is on the sideline in March without being redrawn.
 */

export interface LibraryShot {
  id: string
  title: string
  url: string
  note: string | null
  /** Whose shelf it is on. Null means the shelf everybody shares. */
  ownerEmail: string | null
  createdBy: string | null
  createdAt: string
}

/** True once the library SQL has been run. */
export async function libraryReady(): Promise<boolean> {
  const { error } = await createServiceClient().from('library_items').select('id').limit(1)
  return !error
}

/** One coach's shelf, or every shelf when nobody is named. See listPlays. */
export async function listShots(owner?: string | null): Promise<LibraryShot[]> {
  const { data, error } = await createServiceClient()
    .from('library_items')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) return []
  return ((data ?? []) as Record<string, unknown>[])
    .map((row) => ({
      id: String(row.id),
      title: String(row.title ?? ''),
      url: String(row.url ?? ''),
      note: (row.note as string) ?? null,
      ownerEmail: (row.owner_email as string) ?? null,
      createdBy: (row.created_by as string) ?? null,
      createdAt: String(row.created_at ?? ''),
    }))
    .filter((s) => !owner || !s.ownerEmail || s.ownerEmail === owner)
}

export async function saveShot(
  title: string,
  url: string,
  by: string | null,
  owner?: string | null
): Promise<void> {
  const svc = createServiceClient()
  const row = { kind: 'shot', title, url, created_by: by }
  const { error } = await svc.from('library_items').insert({ ...row, owner_email: owner ?? null })
  // No owner column yet: it lands on the shelf everybody shares, as before.
  if (error) await svc.from('library_items').insert(row)
}

export async function renameShot(id: string, title: string): Promise<void> {
  await createServiceClient().from('library_items').update({ title }).eq('id', id)
}

/**
 * Drop the row. The image stays in the bucket: a screenshot already pasted into
 * a note would otherwise turn into a broken picture the day someone tidied the
 * Library up.
 */
export async function deleteShot(id: string): Promise<void> {
  await createServiceClient().from('library_items').delete().eq('id', id)
}
