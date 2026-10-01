'use server'

import { revalidatePath } from 'next/cache'
import { requireSection } from './permissions'
import { canSee, canTeam, isSandboxed, type Viewer } from './sections'
import { createServiceClient } from './supabase-server'
import { depthKey, readDepthChart, type DepthChart } from './depthChart'
import { isTeam, type Team } from './teams'

/**
 * Writing the depth chart, and the roster behind it, from the depth chart page.
 * A coach changes his own team's chart; the roster needs the roster grant too.
 */

export interface DepthPlayer {
  id: string
  name: string
  number: string | null
  position: string | null
  class_year: string | null
}

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string }

const clip = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max)

async function writer(team: unknown): Promise<{ viewer: Viewer; team: Team } | null> {
  const viewer = await requireSection('depth')
  if (!isTeam(team) || !canTeam(viewer, team) || isSandboxed(viewer)) return null
  return { viewer, team }
}

async function rosterWriter(team: unknown) {
  const w = await writer(team)
  return w && canSee(w.viewer, 'rosters') ? w : null
}

function refresh() {
  revalidatePath('/admin/depth')
}

export async function saveDepthChart(team: Team, chart: DepthChart): Promise<Result> {
  const w = await writer(team)
  if (!w) return { ok: false, error: 'This depth chart isn’t yours to change.' }
  const { error } = await createServiceClient()
    .from('app_settings')
    .upsert({ key: depthKey(w.team), value: JSON.stringify(readDepthChart(chart)) }, { onConflict: 'key' })
  if (error) return { ok: false, error: `Couldn’t save: ${error.message}` }
  refresh()
  return { ok: true }
}

/** A new player, straight onto the roster the chart is using. */
export async function depthAddPlayer(
  team: Team,
  rosterId: string,
  input: Omit<DepthPlayer, 'id'>,
): Promise<Result<{ player: DepthPlayer }>> {
  const w = await rosterWriter(team)
  if (!w) return { ok: false, error: 'You can’t change rosters.' }
  const name = clip(input.name, 120)
  if (!name) return { ok: false, error: 'Give the player a name.' }
  if (!rosterId) return { ok: false, error: 'Pick a roster first.' }
  const svc = createServiceClient()
  const row = {
    name,
    number: clip(input.number, 4) || null,
    position: clip(input.position, 40) || null,
    class_year: clip(input.class_year, 10) || null,
  }
  const { data, error } = await svc
    .from('players')
    .insert({ ...row, team: w.team === 'jv' ? 'boys_jv' : 'boys_varsity', is_active: false, sort_order: 0 })
    .select('id')
    .single()
  if (error || !data) return { ok: false, error: `Couldn’t add: ${error?.message ?? 'unknown error'}` }
  const id = String((data as { id: string }).id)
  const { count } = await svc.from('player_list_members').select('id', { count: 'exact', head: true }).eq('list_id', rosterId)
  await svc.from('player_list_members').insert({ list_id: rosterId, player_id: id, sort_order: count ?? 0 })
  refresh()
  revalidatePath(`/admin/rosters/${rosterId}`)
  return { ok: true, player: { id, ...row } }
}

export async function depthSavePlayer(team: Team, input: DepthPlayer): Promise<Result> {
  const w = await rosterWriter(team)
  if (!w) return { ok: false, error: 'You can’t change rosters.' }
  const name = clip(input.name, 120)
  if (!input.id || !name) return { ok: false, error: 'A player needs a name.' }
  const { error } = await createServiceClient()
    .from('players')
    .update({
      name,
      number: clip(input.number, 4) || null,
      position: clip(input.position, 40) || null,
      class_year: clip(input.class_year, 10) || null,
    })
    .eq('id', input.id)
  if (error) return { ok: false, error: `Couldn’t save: ${error.message}` }
  refresh()
  revalidatePath('/admin/rosters', 'layout')
  revalidatePath('/roster')
  return { ok: true }
}

/** Only off this roster — the player and his evaluations stay. */
export async function depthRemoveFromRoster(team: Team, rosterId: string, playerId: string): Promise<Result> {
  const w = await rosterWriter(team)
  if (!w) return { ok: false, error: 'You can’t change rosters.' }
  await createServiceClient().from('player_list_members').delete().eq('list_id', rosterId).eq('player_id', playerId)
  refresh()
  revalidatePath(`/admin/rosters/${rosterId}`)
  return { ok: true }
}

/** A new, empty roster, made from here and used by this team's chart. */
export async function depthCreateRoster(team: Team, name: string, chart: DepthChart): Promise<Result<{ id: string }>> {
  const w = await rosterWriter(team)
  if (!w) return { ok: false, error: 'You can’t make rosters.' }
  const clean = clip(name, 120)
  if (!clean) return { ok: false, error: 'Name the roster.' }
  const svc = createServiceClient()
  const { data, error } = await svc.from('player_lists').insert({ name: clean }).select('id').single()
  if (error || !data) return { ok: false, error: `Couldn’t make it: ${error?.message ?? 'unknown error'}` }
  const id = String((data as { id: string }).id)
  await svc
    .from('app_settings')
    .upsert({ key: depthKey(w.team), value: JSON.stringify(readDepthChart({ ...chart, rosterId: id })) }, { onConflict: 'key' })
  refresh()
  revalidatePath('/admin/rosters')
  return { ok: true, id }
}
