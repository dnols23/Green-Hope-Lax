import { createServiceClient } from './supabase-server'
import { EMPTY_BOARD, readBoard, readClip, type Board, type BoardClip } from './planner'

/**
 * Plays the staff have drawn and kept.
 *
 * In the database rather than the browser: a play drawn on the laptop on Sunday
 * has to be on the phone at practice on Monday, and every coach has to be able
 * to open the one the head coach drew.
 */

export interface Play {
  id: string
  name: string
  board: Board
  /** The take, if the coach recorded himself drawing it. */
  clip: BoardClip | null
  createdBy: string | null
  updatedAt: string
}

/** True once the plays table exists. */
export async function playsReady(): Promise<boolean> {
  const { error } = await createServiceClient().from('plays').select('id').limit(1)
  return !error
}

export async function listPlays(): Promise<Play[]> {
  const { data, error } = await createServiceClient()
    .from('plays')
    .select('*')
    .order('updated_at', { ascending: false })
  if (error) return []
  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    id: String(row.id),
    name: String(row.name ?? ''),
    board: readBoard(row.board) ?? EMPTY_BOARD,
    clip: readClip(row.clip),
    createdBy: (row.created_by as string) ?? null,
    updatedAt: String(row.updated_at ?? ''),
  }))
}

/**
 * Save under a name. The same name twice is the same play brought up to date,
 * not a second copy — a coach fixing the spacing on "1-4-1 pop" means that one.
 */
export async function savePlay(
  name: string,
  board: unknown,
  by: string | null,
  clip?: unknown
): Promise<void> {
  const svc = createServiceClient()
  const clean = readBoard(board) ?? EMPTY_BOARD
  const take = readClip(clip)
  const { data: existing } = await svc.from('plays').select('id').eq('name', name).maybeSingle()

  // The recording column arrives with its own SQL, so a site whose owner has
  // not run it yet must still be able to save a play — just without the take.
  const withoutClip = (e: { message?: string } | null) => e && /clip/i.test(e.message ?? '')

  if (existing) {
    // Saving a still over a recorded play keeps the recording: a coach nudging
    // one disc and hitting Update did not mean to throw the take away.
    const id = (existing as { id: string }).id
    const stamped: Record<string, unknown> = { board: clean, updated_at: new Date().toISOString() }
    const { error } = await svc
      .from('plays')
      .update(take ? { ...stamped, clip: take } : stamped)
      .eq('id', id)
    if (withoutClip(error)) await svc.from('plays').update(stamped).eq('id', id)
    return
  }
  const row: Record<string, unknown> = { name, board: clean, created_by: by }
  const { error } = await svc.from('plays').insert(take ? { ...row, clip: take } : row)
  if (withoutClip(error)) await svc.from('plays').insert(row)
}

/** Throw away the recording but keep the play as it ended up. */
export async function clearPlayClip(id: string): Promise<void> {
  await createServiceClient().from('plays').update({ clip: null }).eq('id', id)
}

export async function deletePlay(id: string): Promise<void> {
  await createServiceClient().from('plays').delete().eq('id', id)
}
