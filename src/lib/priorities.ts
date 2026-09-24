import { createServiceClient } from './supabase-server'
import { clampLevel, type PriorityList } from './priorityLevels'
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
        }))
        .sort((a, b) => Number(a.done) - Number(b.done) || b.level - a.level),
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
  next: { body?: string; level?: number; done?: boolean; note?: string | null; listId?: string }
): Promise<void> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (next.body !== undefined) patch.body = next.body
  if (next.listId !== undefined) patch.list_id = next.listId
  if (next.level !== undefined) patch.level = clampLevel(next.level)
  if (next.done !== undefined) patch.done = next.done
  if (next.note !== undefined) patch.note = next.note
  await createServiceClient().from('priority_items').update(patch).eq('id', id)
}

export async function deleteItem(id: string): Promise<void> {
  await createServiceClient().from('priority_items').delete().eq('id', id)
}
