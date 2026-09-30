import { createServiceClient } from './supabase-server'
import { DRILL_ORDER_KEY, isDrillSetting, orderGroups, sortDrills, type Drill, type DrillCategory, type DrillSetting } from './drills'
import { readBoard } from './planner'
import { readSavedComps } from './compete'

/** True once the drill bank table exists. */
export async function drillsReady(): Promise<boolean> {
  const svc = createServiceClient()
  const { error } = await svc.from('drills').select('id').limit(1)
  return !error
}

export async function listDrills(): Promise<Drill[]> {
  const svc = createServiceClient()
  const { data, error } = await svc
    .from('drills')
    .select('*')
    .order('is_favorite', { ascending: false })
    .order('name')
  if (error) return []
  return sortDrills(((data ?? []) as Record<string, unknown>[]).map(readDrill))
}

/** One drills row as the app sees it. */
export function readDrill(row: Record<string, unknown>): Drill {
  return {
    id: String(row.id),
    name: String(row.name ?? ''),
    category: String(row.category ?? 'stickwork'),
    // Missing column (before 0021) reads as 'team', which keeps it out of
    // anyone's homework until a coach has said otherwise.
    setting: (['wall', 'solo', 'partner', 'team', 'film'].includes(String(row.setting))
      ? String(row.setting)
      : 'team') as DrillSetting,
    // Only the places a coach has ticked; none until he does.
    settings: Array.isArray(row.settings) ? [...new Set(row.settings.filter(isDrillSetting))] : [],
    minutes: Number(row.minutes) || 10,
    description: (row.description as string) ?? null,
    // Both arrive with 0037; a drill written before it simply has neither.
    setup: (row.setup as string) ?? null,
    context: (row.context as string) ?? null,
    link: (row.link as string) ?? null,
    link_label: (row.link_label as string) ?? null,
    equipment: (row.equipment as string) ?? null,
    board: readBoard(row.board),
    competitions: readSavedComps(row.competitions),
    is_favorite: row.is_favorite === true,
    created_by: (row.created_by as string) ?? null,
    created_at: String(row.created_at ?? ''),
    updated_at: String(row.updated_at ?? ''),
  }
}

/** The bank's groups in the staff's order. */
export async function listDrillGroups(): Promise<DrillCategory[]> {
  const { data } = await createServiceClient().from('app_settings').select('value').eq('key', DRILL_ORDER_KEY).maybeSingle()
  let saved: unknown = null
  try {
    saved = data?.value ? JSON.parse(String(data.value)) : null
  } catch {
    saved = null
  }
  return orderGroups(saved)
}

/** The drills the most recently worked-on plans used, newest first. */
export async function recentDrillIds(limit = 12): Promise<string[]> {
  const { data, error } = await createServiceClient()
    .from('plans')
    .select('blocks, updated_at')
    .eq('kind', 'practice')
    .order('updated_at', { ascending: false })
    .limit(40)
  if (error) return []
  const out: string[] = []
  for (const plan of (data ?? []) as { blocks: unknown }[]) {
    for (const b of Array.isArray(plan.blocks) ? plan.blocks : []) {
      const block = (b ?? {}) as { drillId?: unknown; extraDrills?: unknown }
      const ids = [block.drillId, ...(Array.isArray(block.extraDrills) ? block.extraDrills : [])]
      for (const id of ids) if (typeof id === 'string' && id && !out.includes(id)) out.push(id)
      if (out.length >= limit) return out
    }
  }
  return out
}
