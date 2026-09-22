import { createServiceClient } from './supabase-server'
import { DEFAULT_TEAM, type Team } from './teams'
import {
  DEFAULT_SETTINGS,
  readPage,
  readSettings,
  settingsKey,
  type PlaybookPage,
  type PlaybookSettings,
} from './playbook'

/**
 * Reading and writing the deck.
 *
 * Server-only. Every read goes through the service role, because the table is
 * coach-only at the database and what a player may see is a decision this file
 * makes rather than one the database is asked to enforce.
 */

export async function playbookReady(): Promise<boolean> {
  const { error } = await createServiceClient().from('playbook_pages').select('id').limit(1)
  return !error
}

export async function listPages(team: Team = DEFAULT_TEAM): Promise<PlaybookPage[]> {
  const { data, error } = await createServiceClient()
    .from('playbook_pages')
    .select('*')
    .eq('team', team)
    .order('sort_order', { ascending: true })
  if (error) return []
  return ((data ?? []) as Record<string, unknown>[]).map(readPage)
}

export async function getPage(id: string): Promise<PlaybookPage | null> {
  const { data } = await createServiceClient()
    .from('playbook_pages')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  return data ? readPage(data as Record<string, unknown>) : null
}

export async function getSettings(team: Team): Promise<PlaybookSettings> {
  const { data } = await createServiceClient()
    .from('app_settings')
    .select('value')
    .eq('key', settingsKey(team))
    .maybeSingle()
  return data ? readSettings((data as { value: unknown }).value) : { ...DEFAULT_SETTINGS }
}

export async function writeSettings(team: Team, next: PlaybookSettings): Promise<void> {
  await createServiceClient()
    .from('app_settings')
    .upsert({ key: settingsKey(team), value: JSON.stringify(next) }, { onConflict: 'key' })
}

/** A new page goes on the end, which is where you were looking. */
export async function addPage(
  team: Team,
  title: string,
  by: string | null,
  blocks: unknown[] = []
): Promise<string | null> {
  const svc = createServiceClient()
  const { data: last } = await svc
    .from('playbook_pages')
    .select('sort_order')
    .eq('team', team)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()
  const sort_order = (Number((last as { sort_order?: number })?.sort_order) || 0) + 1
  const { data } = await svc
    .from('playbook_pages')
    .insert({ team, title, sort_order, blocks, created_by: by })
    .select('id')
    .maybeSingle()
  return (data as { id?: string } | null)?.id ?? null
}

export async function savePage(
  id: string,
  next: { title?: string; blocks?: unknown; layout?: string; notes?: string | null }
): Promise<void> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (next.title !== undefined) patch.title = next.title
  if (next.blocks !== undefined) patch.blocks = next.blocks
  if (next.layout !== undefined) patch.layout = next.layout
  if (next.notes !== undefined) patch.notes = next.notes
  await createServiceClient().from('playbook_pages').update(patch).eq('id', id)
}

export async function deletePage(id: string): Promise<void> {
  await createServiceClient().from('playbook_pages').delete().eq('id', id)
}

/** Write a whole new order in one go, after a drag. */
export async function orderPages(ids: string[]): Promise<void> {
  const svc = createServiceClient()
  await Promise.all(
    ids.map((id, i) => svc.from('playbook_pages').update({ sort_order: i + 1 }).eq('id', id))
  )
}
