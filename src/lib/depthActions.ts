'use server'

import { revalidatePath } from 'next/cache'
import { requireSection } from './permissions'
import { canSee, canTeam, isSandboxed, type Viewer } from './sections'
import { createServiceClient } from './supabase-server'
import { ROSTER_TEAMS_KEY, depthKey, readDepthChart, readRosterTeams, type DepthChart } from './depthChart'
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
  const map = await rosterTeams()
  map[id] = w.team
  await svc.from('app_settings').upsert({ key: ROSTER_TEAMS_KEY, value: JSON.stringify(map) }, { onConflict: 'key' })
  await svc
    .from('app_settings')
    .upsert({ key: depthKey(w.team), value: JSON.stringify(readDepthChart({ ...chart, rosterId: id })) }, { onConflict: 'key' })
  refresh()
  revalidatePath('/admin/rosters')
  return { ok: true, id }
}

/**
 * A player moved up to varsity or down to JV: off the one team's roster and
 * chart, onto the other's, and his team changed to match.
 */
export async function depthMoveTeam(input: {
  playerId: string
  from: Team
  to: Team
  fromChart: DepthChart
  toChart: DepthChart
}): Promise<Result> {
  const a = await rosterWriter(input.from)
  const b = await rosterWriter(input.to)
  if (!a || !b || a.team === b.team) return { ok: false, error: 'You can’t move players between these teams.' }
  const fromChart = readDepthChart(input.fromChart)
  const toChart = readDepthChart(input.toChart)
  if (!fromChart.rosterId || !toChart.rosterId) return { ok: false, error: 'Pick a roster for both teams first.' }
  const svc = createServiceClient()
  // Two rosters: off one, onto the other. One roster shared by both teams: he
  // stays on it, and his team decides which side he shows on.
  if (fromChart.rosterId !== toChart.rosterId) {
    const { count } = await svc.from('player_list_members').select('id', { count: 'exact', head: true }).eq('list_id', toChart.rosterId)
    const { error } = await svc
      .from('player_list_members')
      .upsert({ list_id: toChart.rosterId, player_id: input.playerId, sort_order: count ?? 0 }, { onConflict: 'list_id,player_id' })
    if (error) return { ok: false, error: `Couldn’t move him: ${error.message}` }
    await svc.from('player_list_members').delete().eq('list_id', fromChart.rosterId).eq('player_id', input.playerId)
  }
  await svc.from('players').update({ team: b.team === 'jv' ? 'boys_jv' : 'boys_varsity' }).eq('id', input.playerId)
  await svc.from('app_settings').upsert(
    [
      { key: depthKey(a.team), value: JSON.stringify(fromChart) },
      { key: depthKey(b.team), value: JSON.stringify(toChart) },
    ],
    { onConflict: 'key' },
  )
  refresh()
  revalidatePath('/admin/rosters', 'layout')
  revalidatePath('/roster')
  return { ok: true }
}

/**
 * A player already in the program, put on this team: onto its roster if he
 * isn't there, and his team set to match — which, on a roster both teams
 * share, is what puts him on this side.
 */
export async function depthAddToTeam(team: Team, rosterId: string, playerId: string): Promise<Result> {
  const w = await rosterWriter(team)
  if (!w) return { ok: false, error: 'You can’t change rosters.' }
  if (!rosterId || !playerId) return { ok: false, error: 'Pick a roster first.' }
  const svc = createServiceClient()
  const { data: on } = await svc.from('player_list_members').select('id').eq('list_id', rosterId).eq('player_id', playerId).maybeSingle()
  if (!on) {
    const { count } = await svc.from('player_list_members').select('id', { count: 'exact', head: true }).eq('list_id', rosterId)
    const { error } = await svc.from('player_list_members').insert({ list_id: rosterId, player_id: playerId, sort_order: count ?? 0 })
    if (error) return { ok: false, error: `Couldn’t add him: ${error.message}` }
  }
  await svc.from('players').update({ team: w.team === 'jv' ? 'boys_jv' : 'boys_varsity' }).eq('id', playerId)
  refresh()
  revalidatePath(`/admin/rosters/${rosterId}`)
  return { ok: true }
}

async function rosterTeams(): Promise<Record<string, Team>> {
  const { data } = await createServiceClient().from('app_settings').select('value').eq('key', ROSTER_TEAMS_KEY).maybeSingle()
  return readRosterTeams((data as { value?: unknown } | null)?.value)
}

/**
 * Mark a roster as one team's — varsity's or JV's, never both — and tag its
 * players to match, so their profiles and the roster page say the same thing.
 * A chart on the other side still pointing at it is let go.
 */
export async function assignRosterTeam(rosterId: string, team: Team | null): Promise<Result> {
  const viewer = await requireSection('rosters')
  if (!rosterId) return { ok: false, error: 'No roster.' }
  if (team && (!canTeam(viewer, team) || isSandboxed(viewer))) return { ok: false, error: 'That team isn’t yours to change.' }
  const svc = createServiceClient()
  const map = await rosterTeams()
  if (team) map[rosterId] = team
  else delete map[rosterId]
  const { error } = await svc.from('app_settings').upsert({ key: ROSTER_TEAMS_KEY, value: JSON.stringify(map) }, { onConflict: 'key' })
  if (error) return { ok: false, error: `Couldn’t save: ${error.message}` }
  if (team) {
    const { data: members } = await svc.from('player_list_members').select('player_id').eq('list_id', rosterId)
    const ids = ((members ?? []) as { player_id: string }[]).map((m) => m.player_id)
    if (ids.length) await svc.from('players').update({ team: team === 'jv' ? 'boys_jv' : 'boys_varsity' }).in('id', ids)
    // The other side can't keep a roster that is now this side's.
    const otherTeam: Team = team === 'jv' ? 'varsity' : 'jv'
    const { data: o } = await svc.from('app_settings').select('value').eq('key', depthKey(otherTeam)).maybeSingle()
    const oc = readDepthChart((o as { value?: unknown } | null)?.value)
    if (oc.rosterId === rosterId) {
      await svc.from('app_settings').upsert({ key: depthKey(otherTeam), value: JSON.stringify({ ...oc, rosterId: null }) }, { onConflict: 'key' })
    }
  }
  refresh()
  revalidatePath('/admin/rosters', 'layout')
  return { ok: true }
}

/** This chart now runs off this roster, which becomes this team's. */
export async function depthUseRoster(team: Team, rosterId: string | null, chart: DepthChart): Promise<Result> {
  const w = await writer(team)
  if (!w) return { ok: false, error: 'This depth chart isn’t yours to change.' }
  if (rosterId) {
    const map = await rosterTeams()
    if (map[rosterId] && map[rosterId] !== team) return { ok: false, error: 'That roster belongs to the other team.' }
    if (!map[rosterId]) {
      const r = await assignRosterTeam(rosterId, team)
      if (!r.ok) return r
    }
  }
  return saveDepthChart(team, { ...chart, rosterId })
}
