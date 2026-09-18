import { createServiceClient } from './supabase-server'
import { clampLevel, type PriorityList } from './priorityLevels'

export * from './priorityLevels'

/**
 * What the staff has noticed and not dealt with yet.
 *
 * A list per phase of the game, and on each list the things that need work,
 * ranked. The point is the round trip: something goes down in thirty seconds on
 * the sideline, and it is in front of you on Sunday when the practice plan is
 * being written.
 */

/** True once the priorities SQL has been run. */
export async function prioritiesReady(): Promise<boolean> {
  const { error } = await createServiceClient().from('priority_lists').select('id').limit(1)
  return !error
}

/**
 * Every list with its items, worst first and the done ones last — which is the
 * order a coach reads them in when the plan is being written.
 */
export async function listPriorities(): Promise<PriorityList[]> {
  const svc = createServiceClient()
  const { data: lists, error } = await svc
    .from('priority_lists')
    .select('*')
    .order('sort_order', { ascending: true })
  if (error) return []

  const { data: items } = await svc
    .from('priority_items')
    .select('*')
    .order('level', { ascending: false })
    .order('created_at', { ascending: true })

  const rows = (items ?? []) as Record<string, unknown>[]
  return ((lists ?? []) as Record<string, unknown>[]).map((l) => {
    const id = String(l.id)
    return {
      id,
      name: String(l.name ?? ''),
      sortOrder: Number(l.sort_order) || 0,
      items: rows
        .filter((r) => String(r.list_id) === id)
        .map((r) => ({
          id: String(r.id),
          listId: id,
          body: String(r.body ?? ''),
          level: clampLevel(r.level),
          done: r.done === true,
          note: (r.note as string) ?? null,
          createdBy: (r.created_by as string) ?? null,
          createdAt: String(r.created_at ?? ''),
        }))
        .sort((a, b) => Number(a.done) - Number(b.done) || b.level - a.level),
    }
  })
}

export async function addList(name: string, by: string | null): Promise<void> {
  const svc = createServiceClient()
  const { data: last } = await svc
    .from('priority_lists')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()
  await svc.from('priority_lists').insert({
    name,
    sort_order: (Number((last as { sort_order?: number })?.sort_order) || 0) + 1,
    created_by: by,
  })
}

export async function renameList(id: string, name: string): Promise<void> {
  await createServiceClient().from('priority_lists').update({ name }).eq('id', id)
}

/** The items go with it — a list nobody keeps is not a list of anything. */
export async function deleteList(id: string): Promise<void> {
  await createServiceClient().from('priority_lists').delete().eq('id', id)
}

export async function addItem(
  listId: string,
  body: string,
  level: number,
  by: string | null
): Promise<void> {
  await createServiceClient()
    .from('priority_items')
    .insert({ list_id: listId, body, level: clampLevel(level), created_by: by })
}

export async function setItem(
  id: string,
  next: { body?: string; level?: number; done?: boolean; note?: string | null }
): Promise<void> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (next.body !== undefined) patch.body = next.body
  if (next.level !== undefined) patch.level = clampLevel(next.level)
  if (next.done !== undefined) patch.done = next.done
  if (next.note !== undefined) patch.note = next.note
  await createServiceClient().from('priority_items').update(patch).eq('id', id)
}

export async function deleteItem(id: string): Promise<void> {
  await createServiceClient().from('priority_items').delete().eq('id', id)
}
