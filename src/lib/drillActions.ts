'use server'

import { revalidatePath } from 'next/cache'
import { getViewer, requireSection } from './permissions'
import { canSee, isSandboxed } from './sections'
import { createServiceClient } from './supabase-server'
import { DRILL_CATEGORIES, DRILL_ORDER_KEY, orderGroups, type Drill } from './drills'
import { readDrill } from './drillsData'

function refresh() {
  revalidatePath('/admin/drills')
  revalidatePath('/admin/planner', 'layout')
}

/** The bank's groups, slid into a new order. The staff's order, so not a sandboxed coach's to set. */
export async function saveDrillOrder(keys: string[]): Promise<{ ok: boolean }> {
  const viewer = await requireSection('drills')
  if (isSandboxed(viewer)) return { ok: false }
  const order = orderGroups(keys).map((c) => c.key)
  const { error } = await createServiceClient()
    .from('app_settings')
    .upsert({ key: DRILL_ORDER_KEY, value: JSON.stringify(order) }, { onConflict: 'key' })
  if (error) return { ok: false }
  refresh()
  return { ok: true }
}

/** A drill made from the planner mid-plan: into the bank, and handed back to use at once. */
export async function quickAddDrill(input: {
  name: string
  category: string
  link: string
}): Promise<{ ok: true; drill: Drill } | { ok: false; error: string }> {
  const viewer = await getViewer()
  if (!viewer || !(canSee(viewer, 'drills') || canSee(viewer, 'planner'))) return { ok: false, error: 'You can’t add drills.' }
  const name = String(input.name ?? '').trim().slice(0, 200)
  if (!name) return { ok: false, error: 'Give it a name.' }
  const category = DRILL_CATEGORIES.some((c) => c.key === input.category) ? input.category : 'stickwork'
  const link = String(input.link ?? '').trim().slice(0, 500) || null
  if (link && !/^https?:\/\//i.test(link)) return { ok: false, error: 'The video link has to start with http:// or https://' }
  const { data, error } = await createServiceClient()
    .from('drills')
    .insert({ name, category, link, settings: [], created_by: viewer.email })
    .select('*')
    .single()
  if (error || !data) return { ok: false, error: `Couldn’t add it: ${error?.message ?? 'unknown error'}` }
  refresh()
  return { ok: true, drill: readDrill(data as Record<string, unknown>) }
}
