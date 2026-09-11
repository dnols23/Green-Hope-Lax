import { createServiceClient } from './supabase-server'
import type { Drill, DrillSetting } from './drills'

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
  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    id: String(row.id),
    name: String(row.name ?? ''),
    category: String(row.category ?? 'stickwork'),
    // Missing column (before 0021) reads as 'team', which keeps it out of
    // anyone's homework until a coach has said otherwise.
    setting: (['wall', 'solo', 'partner', 'team', 'film'].includes(String(row.setting))
      ? String(row.setting)
      : 'team') as DrillSetting,
    minutes: Number(row.minutes) || 10,
    description: (row.description as string) ?? null,
    link: (row.link as string) ?? null,
    link_label: (row.link_label as string) ?? null,
    equipment: (row.equipment as string) ?? null,
    is_favorite: row.is_favorite === true,
    created_by: (row.created_by as string) ?? null,
    created_at: String(row.created_at ?? ''),
    updated_at: String(row.updated_at ?? ''),
  }))
}
