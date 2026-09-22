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
  /** Whose shelf it is on. Null means the shelf everybody shares. */
  ownerEmail: string | null
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

/**
 * The plays on one coach's shelf, or every play when nobody is named.
 *
 * Filtered here rather than in the query, so a site whose owner has not run
 * 0038 yet still shows its plays instead of failing on a column that isn't
 * there. A play with no owner is on the shelf everybody shares — which is
 * where every play was before there were shelves.
 */
export async function listPlays(owner?: string | null): Promise<Play[]> {
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
    ownerEmail: (row.owner_email as string) ?? null,
    createdBy: (row.created_by as string) ?? null,
    updatedAt: String(row.updated_at ?? ''),
  })).filter((p) => !owner || !p.ownerEmail || p.ownerEmail === owner)
}

/**
 * Save under a name. The same name twice is the same play brought up to date,
 * not a second copy — a coach fixing the spacing on "1-4-1 pop" means that one.
 */
export async function savePlay(
  name: string,
  board: unknown,
  by: string | null,
  clip?: unknown,
  /** Whose shelf it goes on. Their login, so a rename doesn't orphan it. */
  owner?: string | null
): Promise<void> {
  const svc = createServiceClient()
  const clean = readBoard(board) ?? EMPTY_BOARD
  const take = readClip(clip)
  /* The same name twice on the same shelf is that play brought up to date.
     The same name on somebody else's shelf is somebody else's play. */
  let found = owner
    ? await svc.from('plays').select('id').eq('name', name).eq('owner_email', owner).maybeSingle()
    : { data: null, error: null }
  if (owner && found.error) {
    // No owner column yet: fall back to the one shelf everybody shared.
    found = await svc.from('plays').select('id').eq('name', name).maybeSingle()
  }
  if (!owner) found = await svc.from('plays').select('id').eq('name', name).maybeSingle()
  const existing = found.data

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
  const row: Record<string, unknown> = { name, board: clean, created_by: by, owner_email: owner ?? null }
  const { error } = await svc.from('plays').insert(take ? { ...row, clip: take } : row)
  if (error) {
    // Shed the newer columns one at a time rather than lose the play.
    const { owner_email: _o, ...noOwner } = row
    const second = await svc.from('plays').insert(take ? { ...noOwner, clip: take } : noOwner)
    if (second.error) await svc.from('plays').insert(noOwner)
  }
}

/** The play saved under this name, if there is one. */
export async function findPlayByName(name: string): Promise<string | null> {
  const { data } = await createServiceClient()
    .from('plays')
    .select('id')
    .eq('name', name)
    .maybeSingle()
  return (data as { id?: string } | null)?.id ?? null
}

/** Throw away the recording but keep the play as it ended up. */
export async function clearPlayClip(id: string): Promise<void> {
  await createServiceClient().from('plays').update({ clip: null }).eq('id', id)
}

export async function deletePlay(id: string): Promise<void> {
  await createServiceClient().from('plays').delete().eq('id', id)
}
