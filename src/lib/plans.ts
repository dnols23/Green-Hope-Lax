import { createServiceClient } from './supabase-server'
import { readBlocks, type Plan, type PlanKind } from './planner'
import { isTeam, type Team } from './teams'

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
    // Left raw here: only the note editor knows how to read it, and the
    // column is missing entirely until 0026 has been run.
    content: Array.isArray(row.content) ? (row.content as unknown[]) : [],
    roster_id: (row.roster_id as string) ?? null,
    // Rows written before the two staffs were split are varsity, which is what
    // they were.
    team: (isTeam(row.team) ? row.team : 'varsity') as Team,
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

/**
 * One team's plans, or every plan when no team is named.
 *
 * Asking the database to filter would fail outright on a site whose owner has
 * not run the team SQL yet, taking the whole planner with it — so the column is
 * read back and filtered here, where a missing one simply reads as varsity.
 */
export async function listPlans(team?: Team): Promise<Plan[]> {
  const svc = createServiceClient()
  const { data, error } = await svc
    .from('plans')
    .select('*')
    .order('plan_date', { ascending: false, nullsFirst: false })
    .order('updated_at', { ascending: false })
  if (error) return []
  const all = ((data ?? []) as Record<string, unknown>[]).map(shape)
  return team ? all.filter((p) => p.team === team) : all
}

export async function getPlan(id: string): Promise<Plan | null> {
  const svc = createServiceClient()
  const { data } = await svc.from('plans').select('*').eq('id', id).maybeSingle()
  return data ? shape(data as Record<string, unknown>) : null
}
