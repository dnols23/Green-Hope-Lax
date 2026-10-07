'use server'

// Writing game stats. Every action checks the Stats section and that the coach
// works on the game's team. Logging a stat returns the saved event so the
// tracker can show it straight away without reloading the page.

import { revalidatePath } from 'next/cache'
import { requireSection } from './permissions'
import { canTeam } from './sections'
import { createServiceClient } from './supabase-server'
import { zonedToUtc } from './zoned'
import {
  MAX_PERIOD,
  isSituation,
  readStatEvent,
  statProblem,
  teamLines,
  type Situation,
  type StatEvent,
  type StatKind,
  type StatGame,
  type StatSide,
} from './stats'
import { getStatGame, listStatEvents } from './statsData'
import { isTeam, type Team } from './teams'

type Fail = { ok: false; error: string }

const uuid = (v: unknown) => (typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v) ? v : null)

const OFFLINE = 'Couldn’t reach the database. Check the signal and try again.'

/** The game, if this coach may write its stats. */
async function writableGame(
  gameId: unknown,
): Promise<{ error: string } | { viewer: Awaited<ReturnType<typeof requireSection>>; game: StatGame }> {
  const viewer = await requireSection('stats')
  const id = uuid(gameId)
  let game: StatGame | null = null
  try {
    game = id ? await getStatGame(id) : null
  } catch (e) {
    console.error('stats: reading the game', e)
    return { error: OFFLINE }
  }
  if (!game) return { error: 'That game is gone.' }
  if (!canTeam(viewer, game.level)) return { error: `You don’t work on the ${game.level === 'jv' ? 'JV' : 'varsity'} team.` }
  return { viewer, game }
}

function refresh() {
  revalidatePath('/admin/stats', 'layout')
}

/** The pages that show a game's score or status. */
function refreshSchedule() {
  revalidatePath('/admin/schedule')
  revalidatePath('/schedule')
  revalidatePath('/team')
}

/** A database refusal, in words a coach can act on. The details go to the server log. */
function saveError(error: { code?: string; message?: string } | null, fallback = 'That didn’t save. Try again.'): string {
  if (error) console.error('stats: save failed', error)
  switch (error?.code) {
    case '23503':
      return 'That player or game isn’t on file any more. Reload the page.'
    case '23514':
    case '22P02':
      return 'That stat doesn’t fit. Reload the page and try again.'
    case 'PGRST116':
      return 'That stat is gone. Reload the page.'
    default:
      return fallback
  }
}

export interface StatInput {
  gameId: string
  period: number
  side: StatSide
  kind: StatKind
  result: string | null
  playerId: string | null
  assistId: string | null
  situation: Situation
  penaltyMinutes: number | null
  /**
   * The tracker's own name for a stat, made before it is sent. Sending the
   * same stat twice (a reply lost to bad signal, then a retry) finds the one
   * already saved instead of logging it again. Only addStatEvent reads it.
   */
  clientKey?: string | null
}

/** Check one event's shape against the table in stats.ts. Null when it's fine. */
function problem(i: StatInput): string | null {
  return statProblem(i)
}

/**
 * The columns a stat writes, cleaned. A player is kept only where the table in
 * stats.ts has a player: their ground ball, a clear, their penalty and a
 * turnover they gave away on their own have nobody of ours to credit, so a
 * stray pick from the tracker isn't stored (and can't add a game played).
 */
function columns(input: StatInput) {
  const hasPlayer = !(
    (input.kind === 'ground_ball' && input.side === 'them') ||
    input.kind === 'clear' ||
    (input.kind === 'penalty' && input.side === 'them') ||
    (input.kind === 'turnover' && input.side === 'them' && input.result !== 'caused')
  )
  const minutes = input.kind === 'penalty' && input.penaltyMinutes != null ? Number(input.penaltyMinutes) : null
  return {
    period: Math.min(MAX_PERIOD, Math.max(1, Math.round(Number(input.period) || 1))),
    side: input.side,
    kind: input.kind,
    result: input.result || null,
    player_id: hasPlayer ? uuid(input.playerId) : null,
    assist_id: uuid(input.assistId),
    situation: isSituation(input.situation) ? input.situation : 'even',
    penalty_minutes: minutes != null && Number.isFinite(minutes) && minutes >= 0 && minutes <= 10 ? minutes : null,
  }
}

type Scoring = Pick<StatEvent, 'kind' | 'side' | 'result'>
const goalFor = (e: Scoring | null, side: StatSide) => (e && e.kind === 'shot' && e.side === side && e.result === 'goal' ? 1 : 0)

/**
 * A goal added, taken back or changed on a game already marked final moves the
 * score on the schedule with it — but only when that score came from the
 * tracking in the first place (it matched the tracked goals before this
 * change). A score typed on the schedule for a game that was only partly
 * tracked is left alone.
 */
async function keepScoreInStep(game: StatGame, was: Scoring | null, now: Scoring | null) {
  if (game.status !== 'final') return
  const dUs = goalFor(now, 'us') - goalFor(was, 'us')
  const dThem = goalFor(now, 'them') - goalFor(was, 'them')
  if (!dUs && !dThem) return
  try {
    const { us, them } = teamLines(await listStatEvents([game.id]))
    if (game.team_score !== us.goals - dUs || game.opp_score !== them.goals - dThem) return
    const { error } = await createServiceClient()
      .from('games')
      .update({ team_score: us.goals, opp_score: them.goals })
      .eq('id', game.id)
    if (error) throw error
    refreshSchedule()
  } catch (e) {
    // The stat itself saved; the score catches up the next time the game is finished.
    console.error('stats: keeping the final score in step', e)
  }
}

/** Log one stat. */
export async function addStatEvent(input: StatInput): Promise<{ ok: true; event: StatEvent } | Fail> {
  const w = await writableGame(input.gameId)
  if ('error' in w) return { ok: false, error: w.error }
  const bad = problem(input)
  if (bad) return { ok: false, error: bad }
  const clientKey = typeof input.clientKey === 'string' && /^[\w-]{6,80}$/.test(input.clientKey) ? input.clientKey : null
  const row = { game_id: w.game.id, ...columns(input), created_by: w.viewer.email, client_key: clientKey }
  const svc = createServiceClient()
  const { data, error } = await svc.from('stat_events').insert(row).select('*').single()
  if (error?.code === '23505' && clientKey) {
    // Already saved on an earlier try whose reply never arrived: that one is the answer.
    const { data: first } = await svc.from('stat_events').select('*').eq('game_id', w.game.id).eq('client_key', clientKey).maybeSingle()
    const event = first ? readStatEvent(first as Record<string, unknown>) : null
    if (event) return { ok: true, event }
  }
  if (error || !data) return { ok: false, error: saveError(error) }
  const event = readStatEvent(data as Record<string, unknown>)
  if (!event) return { ok: false, error: 'Saved, but couldn’t read it back. Reload the page.' }
  await keepScoreInStep(w.game, null, event)
  return { ok: true, event }
}

/** Change a logged stat (a wrong player, a wrong result, the wrong quarter). */
export async function updateStatEvent(
  id: string,
  input: StatInput,
): Promise<{ ok: true; event: StatEvent } | Fail> {
  const eventId = uuid(id)
  if (!eventId) return { ok: false, error: 'That stat is gone.' }
  const svc = createServiceClient()
  const { data: was, error: readError } = await svc.from('stat_events').select('*').eq('id', eventId).maybeSingle()
  if (readError) return { ok: false, error: saveError(readError, OFFLINE) }
  if (!was) return { ok: false, error: 'That stat is gone.' }
  // The event stays in the game it was logged in, whatever gameId came along.
  const gameId = (was as { game_id: string }).game_id
  const w = await writableGame(gameId)
  if ('error' in w) return { ok: false, error: w.error }
  const bad = problem({ ...input, gameId })
  if (bad) return { ok: false, error: bad }
  const { data, error } = await svc.from('stat_events').update(columns(input)).eq('id', eventId).select('*').single()
  if (error || !data) return { ok: false, error: saveError(error) }
  const event = readStatEvent(data as Record<string, unknown>)
  if (!event) return { ok: false, error: 'Saved, but couldn’t read it back. Reload the page.' }
  await keepScoreInStep(w.game, readStatEvent(was as Record<string, unknown>), event)
  return { ok: true, event }
}

/**
 * Take back a stat the tracker never heard back about, by the tracker's own
 * key: it may have landed even though the reply was lost. Nothing there is fine.
 */
export async function deleteStatEventByKey(gameId: string, clientKey: string): Promise<{ ok: true } | Fail> {
  if (typeof clientKey !== 'string' || !/^[\w-]{6,80}$/.test(clientKey)) return { ok: true }
  const w = await writableGame(gameId)
  if ('error' in w) return { ok: false, error: w.error }
  const svc = createServiceClient()
  const { data: was } = await svc.from('stat_events').select('*').eq('game_id', w.game.id).eq('client_key', clientKey).maybeSingle()
  if (!was) return { ok: true }
  const { error } = await svc.from('stat_events').delete().eq('id', (was as { id: string }).id)
  if (error) return { ok: false, error: saveError(error) }
  await keepScoreInStep(w.game, readStatEvent(was as Record<string, unknown>), null)
  return { ok: true }
}

/** Take a logged stat back out (the tracker's Undo, or × on a line of the log). */
export async function deleteStatEvent(id: string): Promise<{ ok: true } | Fail> {
  const eventId = uuid(id)
  if (!eventId) return { ok: false, error: 'That stat is gone.' }
  const svc = createServiceClient()
  const { data: was, error: readError } = await svc.from('stat_events').select('*').eq('id', eventId).maybeSingle()
  if (readError) return { ok: false, error: saveError(readError, OFFLINE) }
  if (!was) return { ok: true } // already gone: nothing to undo
  const w = await writableGame((was as { game_id: string }).game_id)
  if ('error' in w) return { ok: false, error: w.error }
  const { error } = await svc.from('stat_events').delete().eq('id', eventId)
  if (error) return { ok: false, error: saveError(error, 'That didn’t delete. Try again.') }
  await keepScoreInStep(w.game, readStatEvent(was as Record<string, unknown>), null)
  return { ok: true }
}

export interface NewGameInput {
  team: Team
  opponent: string
  /** YYYY-MM-DD, Eastern. */
  date: string
  /** HH:MM, Eastern; blank for no time. */
  time: string
  homeAway: 'home' | 'away' | 'neutral'
  isConference: boolean
}

/**
 * A game to track that isn't on the schedule yet: a scrimmage, or a game typed
 * in on the sideline. It goes on the schedule as coaches-only, so nothing new
 * appears on the public site.
 */
export async function createStatGame(input: NewGameInput): Promise<{ ok: true; id: string } | Fail> {
  const viewer = await requireSection('stats')
  const team: Team = isTeam(input.team) ? input.team : 'varsity'
  if (!canTeam(viewer, team)) return { ok: false, error: `You don’t work on the ${team === 'jv' ? 'JV' : 'varsity'} team.` }
  const opponent = String(input.opponent ?? '').trim().slice(0, 80)
  if (!opponent) return { ok: false, error: 'Who are you playing?' }
  const date = String(input.date ?? '').trim()
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  // A real calendar day: "2027-02-30" would otherwise roll into March.
  const real = dm && new Date(Date.UTC(+dm[1], +dm[2] - 1, +dm[3])).toISOString().slice(0, 10) === date
  if (!real) return { ok: false, error: 'Pick the date.' }
  // Eastern wall-clock time. No time given: noon, which is the same calendar
  // day in Cary and in UTC, so the date never slips a day either way.
  const clock = String(input.time ?? '').trim()
  const tm = /^(\d{1,2}):(\d{2})$/.exec(clock)
  if (clock && !(tm && +tm[1] < 24 && +tm[2] < 60)) return { ok: false, error: 'That time doesn’t look right.' }
  const time = tm ? `${tm[1].padStart(2, '0')}:${tm[2]}` : '12:00'
  const row = {
    gender: 'boys',
    level: team,
    game_date: zonedToUtc(date, time).toISOString(),
    opponent,
    home_away: input.homeAway === 'away' || input.homeAway === 'neutral' ? input.homeAway : 'home',
    is_conference: input.isConference === true,
    status: 'scheduled',
    audience: 'coaches',
  }
  const svc = createServiceClient()
  let { data, error } = await svc.from('games').insert(row).select('id').single()
  // A database without the audience column (0016) still takes the game.
  if (error && /audience/i.test(error.message)) {
    const { audience: _a, ...rest } = row
    ;({ data, error } = await svc.from('games').insert(rest).select('id').single())
  }
  if (error || !data) return { ok: false, error: saveError(error, 'That game didn’t save. Try again.') }
  refresh()
  revalidatePath('/admin/schedule')
  return { ok: true, id: String((data as { id: string }).id) }
}

/**
 * Done tracking: the score on the schedule becomes the tracked score and the
 * game is marked final, so it counts in the record everywhere.
 *
 * Refused when nothing was tracked: finishing would overwrite a typed score
 * with 0–0.
 */
export async function finishStatGame(gameId: string): Promise<{ ok: true; goalsFor: number; goalsAgainst: number } | Fail> {
  const w = await writableGame(gameId)
  if ('error' in w) return { ok: false, error: w.error }
  let events: StatEvent[]
  try {
    events = await listStatEvents([w.game.id])
  } catch (e) {
    // Never write a score from a log that didn't load in full.
    console.error('stats: finishing a game', e)
    return { ok: false, error: OFFLINE }
  }
  if (!events.length) return { ok: false, error: 'Nothing has been tracked in this game yet.' }
  const { us, them } = teamLines(events)
  const { error } = await createServiceClient()
    .from('games')
    .update({ team_score: us.goals, opp_score: them.goals, status: 'final' })
    .eq('id', w.game.id)
  if (error) return { ok: false, error: saveError(error) }
  refresh()
  refreshSchedule()
  return { ok: true, goalsFor: us.goals, goalsAgainst: them.goals }
}

/** Back to tracking a game marked final (to add what was missed). */
export async function reopenStatGame(gameId: string): Promise<{ ok: true } | Fail> {
  const w = await writableGame(gameId)
  if ('error' in w) return { ok: false, error: w.error }
  const { error } = await createServiceClient().from('games').update({ status: 'scheduled' }).eq('id', w.game.id)
  if (error) return { ok: false, error: saveError(error) }
  refresh()
  // The result comes off the schedule and the record until it is finished again.
  refreshSchedule()
  return { ok: true }
}
