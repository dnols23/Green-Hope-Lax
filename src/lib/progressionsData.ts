import { createServiceClient } from './supabase-server'
import { readProgression, type Progression } from './progressions'

/** True once 0055 has made the table. */
export async function progressionsReady(): Promise<boolean> {
  const { error } = await createServiceClient().from('drill_progressions').select('id').limit(1)
  return !error
}

export async function listProgressions(): Promise<Progression[]> {
  const { data, error } = await createServiceClient()
    .from('drill_progressions')
    .select('*')
    .order('sort_order')
    .order('created_at')
  if (error) return []
  return ((data ?? []) as Record<string, unknown>[]).map(readProgression)
}
