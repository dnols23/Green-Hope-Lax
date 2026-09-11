import { createServiceClient } from './supabase-server'
import { readBlocks, type Plan, type PlanKind } from './planner'

// Reading plans. Coach-only data, so the service client throughout — the table
// has RLS on with no policies for anyone else.

function shape(row: Record<string, unknown>): Plan {
  return {
    id: String(row.id),
    kind: (row.kind === 'game' || row.kind === 'note' ? row.kind : 'practice') as PlanKind,
    title: String(row.title ?? ''),
    plan_date: (row.plan_date as string) ?? null,
    season: (row.season as string) ?? null,
    summary: (row.summary as string) ?? null,
    blocks: readBlocks(row.blocks),
    roster_id: (row.roster_id as string) ?? null,
    is_template: row.is_template === true,
    publish_players: row.publish_players === true,
    // Older rows predate the column; a plan without it behaves as it always did.
    publish_coaches: row.publish_coaches !== false,
    created_by: (row.created_by as string) ?? null,
    created_at: String(row.created_at ?? ''),
    updated_at: String(row.updated_at ?? ''),
  }
}

/** True once the planner table exists — the page explains itself until then. */
export async function plannerReady(): Promise<boolean> {
  const svc = createServiceClient()
  const { error } = await svc.from('plans').select('id').limit(1)
  return !error
}

export async function listPlans(): Promise<Plan[]> {
  const svc = createServiceClient()
  const { data, error } = await svc
    .from('plans')
    .select('*')
    .order('plan_date', { ascending: false, nullsFirst: false })
    .order('updated_at', { ascending: false })
  if (error) return []
  return ((data ?? []) as Record<string, unknown>[]).map(shape)
}

export async function getPlan(id: string): Promise<Plan | null> {
  const svc = createServiceClient()
  const { data } = await svc.from('plans').select('*').eq('id', id).maybeSingle()
  return data ? shape(data as Record<string, unknown>) : null
}
