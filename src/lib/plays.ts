import { createServiceClient } from './supabase-server'
import { EMPTY_BOARD, readBoard, type Board } from './planner'

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
    createdBy: (row.created_by as string) ?? null,
    updatedAt: String(row.updated_at ?? ''),
  }))
}

/**
 * Save under a name. The same name twice is the same play brought up to date,
 * not a second copy — a coach fixing the spacing on "1-4-1 pop" means that one.
 */
export async function savePlay(name: string, board: unknown, by: string | null): Promise<void> {
  const svc = createServiceClient()
  const clean = readBoard(board) ?? EMPTY_BOARD
  const { data: existing } = await svc.from('plays').select('id').eq('name', name).maybeSingle()

  if (existing) {
    await svc
      .from('plays')
      .update({ board: clean, updated_at: new Date().toISOString() })
      .eq('id', (existing as { id: string }).id)
    return
  }
  await svc.from('plays').insert({ name, board: clean, created_by: by })
}

export async function deletePlay(id: string): Promise<void> {
  await createServiceClient().from('plays').delete().eq('id', id)
}
