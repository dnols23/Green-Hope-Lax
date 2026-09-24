import { createServiceClient } from './supabase-server'
import { byPlace, clampLevel, type PriorityList } from './priorityLevels'
import { DEFAULT_TEAM, isTeam, type Team } from './teams'

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
 * One team's lists with their items, worst first and the done ones last — which
 * is the order a coach reads them in when the plan is being written.
 *
 * The team is filtered here rather than in the query, so a site whose owner has
 * not run 0034 yet still shows its lists instead of failing on a column that
 * isn't there. A row with no team reads as varsity, which is where it was
 * written.
 */
export async function listPriorities(team: Team = DEFAULT_TEAM): Promise<PriorityList[]> {
  const svc = createServiceClient()
  const { data: all, error } = await svc
    .from('priority_lists')
    .select('*')
    .order('sort_order', { ascending: true })
  if (error) return []

  const lists = ((all ?? []) as Record<string, unknown>[]).filter((l) => teamOf(l.team) === team)

  const { data: items } = await svc
    .from('priority_items')
    .select('*')
    .order('level', { ascending: false })
    .order('created_at', { ascending: true })

  const rows = (items ?? []) as Record<string, unknown>[]
  return lists.map((l) => {
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
          sortOrder: typeof r.sort_order === 'number' ? r.sort_order : null,
        }))
        .sort(byPlace),
    }
  })
}

/** A row's team, with anything unrecognised reading as varsity. */
function teamOf(value: unknown): Team {
  return isTeam(value) ? value : DEFAULT_TEAM
}

export async function addList(name: string, by: string | null, team: Team = DEFAULT_TEAM): Promise<void> {
  const svc = createServiceClient()
  const { data: last } = await svc
    .from('priority_lists')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()
  const row = {
    name,
    sort_order: (Number((last as { sort_order?: number })?.sort_order) || 0) + 1,
    created_by: by,
  }
  const { error } = await svc.from('priority_lists').insert({ ...row, team })
  // A site that hasn't run 0034 has no team column; the list still gets made,
  // it just lands on the varsity side where everything already is.
  if (error) await svc.from('priority_lists').insert(row)
}

/**
 * Whose list this is — asked of the database, not of the form.
 *
 * Every write goes through here first, because a hidden button is not a lock:
 * a JV coach posting a varsity list's id has to be turned away by the server.
 */
export async function listTeamOf(listId: string): Promise<Team | null> {
  const { data } = await createServiceClient()
    .from('priority_lists')
    .select('team')
    .eq('id', listId)
    .maybeSingle()
  if (!data) return null
  return teamOf((data as { team?: unknown }).team)
}

/** The team behind one item, through the list it sits on. */
export async function itemTeamOf(itemId: string): Promise<Team | null> {
  const { data } = await createServiceClient()
    .from('priority_items')
    .select('list_id')
    .eq('id', itemId)
    .maybeSingle()
  const listId = (data as { list_id?: string } | null)?.list_id
  return listId ? listTeamOf(listId) : null
}

export async function renameList(id: string, name: string): Promise<void> {
  await createServiceClient().from('priority_lists').update({ name }).eq('id', id)
}

/** The items go with it — a list nobody keeps is not a list of anything. */
export async function deleteList(id: string): Promise<void> {
  await createServiceClient().from('priority_lists').delete().eq('id', id)
}

/**
 * Where a new (or newly moved) item goes on a list the staff has ordered: above
 * the first item that matters less than it — so a "Now" still lands near the
 * top, and the order the coach set for everything else is left exactly as it
 * was. Null when the list has no places yet (0041 not run).
 */
async function placeFor(listId: string, level: number, except?: string): Promise<number | null> {
  const { data, error } = await createServiceClient()
    .from('priority_items')
    .select('id, level, sort_order, done')
    .eq('list_id', listId)
    .order('sort_order', { ascending: true, nullsFirst: false })
  if (error) return null
  const open = ((data ?? []) as { id: string; level: number; sort_order: number | null; done: boolean }[])
    .filter((r) => !r.done && r.id !== except && typeof r.sort_order === 'number')
  if (open.length === 0) return 1
  const at = open.findIndex((r) => r.level < level)
  if (at === -1) return (open[open.length - 1].sort_order as number) + 1
  const after = open[at].sort_order as number
  const before = at > 0 ? (open[at - 1].sort_order as number) : after - 1
  return (before + after) / 2
}

export async function addItem(
  listId: string,
  body: string,
  level: number,
  by: string | null
): Promise<void> {
  const svc = createServiceClient()
  const row: Record<string, unknown> = { list_id: listId, body, level: clampLevel(level), created_by: by }
  const place = await placeFor(listId, clampLevel(level))
  const { error } = await svc.from('priority_items').insert(place === null ? row : { ...row, sort_order: place })
  // Before 0041 there is no place to give it; the item still goes on the list.
  if (error && place !== null) await svc.from('priority_items').insert(row)
}

/**
 * The staff's order for one list: the ids, top to bottom. Only items that are
 * on that list are touched, whatever else is sent.
 */
export async function reorderItems(listId: string, ids: string[]): Promise<boolean> {
  const svc = createServiceClient()
  const results = await Promise.all(
    ids.map((id, i) => svc.from('priority_items').update({ sort_order: i + 1 }).eq('id', id).eq('list_id', listId)),
  )
  return results.every((r) => !r.error)
}

export async function setItem(
  id: string,
  next: { body?: string; level?: number; done?: boolean; note?: string | null; listId?: string }
): Promise<void> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (next.body !== undefined) patch.body = next.body
  if (next.listId !== undefined) {
    patch.list_id = next.listId
    // On its new list it takes a place by how much it matters.
    const { data } = await createServiceClient().from('priority_items').select('level').eq('id', id).maybeSingle()
    const level = next.level ?? Number((data as { level?: number } | null)?.level ?? 2)
    const place = await placeFor(next.listId, clampLevel(level), id)
    if (place !== null) patch.sort_order = place
  }
  if (next.level !== undefined) patch.level = clampLevel(next.level)
  if (next.done !== undefined) patch.done = next.done
  if (next.note !== undefined) patch.note = next.note
  await createServiceClient().from('priority_items').update(patch).eq('id', id)
}

export async function deleteItem(id: string): Promise<void> {
  await createServiceClient().from('priority_items').delete().eq('id', id)
}
