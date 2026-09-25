import { createServiceClient } from './supabase-server'
import { canTeam, runsATeam, type Viewer } from './sections'
import { listPracticePlansBetween } from './plans'
import { DEFAULT_START, totalMinutes } from './planner'
import { normalizeAudience as gameAudience } from './schedule'
import { withTeam } from './teams'
import { addDaysYmd, daysBetweenYmd, hmOf, ymdOf, zonedToUtc } from './zoned'
import {
  GAME_MINUTES,
  SURFACE_SEES,
  isCalAudience,
  isCalEventKind,
  isCalTeam,
  type Availability,
  type CalEvent,
  type CalItem,
  type CalSurface,
  type CalTeam,
} from './calendarModel'

/**
 * Reading the calendar, and deciding who sees what on it.
 *
 * Server-only. Every read uses the service role, because both tables are
 * coach-only at the database; the audience filter below is the only thing that
 * stands between a coaches-only meeting and a parent's phone, so every surface
 * — the coaches' calendar, the Team Hub, the Parent Hub, the public schedule —
 * goes through listCalendarItems() with its own surface name, and nothing reads
 * the tables directly.
 */

export async function calendarReady(): Promise<boolean> {
  const { error } = await createServiceClient().from('calendar_events').select('id').limit(1)
  return !error
}

export async function availabilityReady(): Promise<boolean> {
  const { error } = await createServiceClient().from('coach_availability').select('id').limit(1)
  return !error
}

// ── Rows ─────────────────────────────────────────────────────────────────────

const str = (v: unknown) => (typeof v === 'string' ? v : '')
const strOrNull = (v: unknown) => (typeof v === 'string' && v.trim() ? v : null)

export function readEvent(row: Record<string, unknown>): CalEvent {
  return {
    id: String(row.id),
    team: isCalTeam(row.team) ? row.team : 'program',
    title: str(row.title),
    kind: isCalEventKind(row.kind) ? row.kind : 'event',
    startsAt: new Date(str(row.starts_at)).toISOString(),
    endsAt: new Date(str(row.ends_at)).toISOString(),
    allDay: row.all_day === true,
    location: strOrNull(row.location),
    notes: strOrNull(row.notes),
    audience: isCalAudience(row.audience) ? row.audience : 'coaches',
    createdBy: strOrNull(row.created_by),
  }
}

export function readAvailability(row: Record<string, unknown>): Availability {
  return {
    id: String(row.id),
    coachEmail: str(row.coach_email).toLowerCase(),
    coachName: str(row.coach_name),
    status: row.status === 'available' ? 'available' : 'unavailable',
    startsAt: new Date(str(row.starts_at)).toISOString(),
    endsAt: new Date(str(row.ends_at)).toISOString(),
    allDay: row.all_day === true,
    repeatWeekly: row.repeat_weekly === true,
    repeatUntil: strOrNull(row.repeat_until),
    note: strOrNull(row.note),
  }
}

export async function getEvent(id: string): Promise<CalEvent | null> {
  const { data } = await createServiceClient().from('calendar_events').select('*').eq('id', id).maybeSingle()
  return data ? readEvent(data as Record<string, unknown>) : null
}

export async function getAvailability(id: string): Promise<Availability | null> {
  const { data } = await createServiceClient().from('coach_availability').select('*').eq('id', id).maybeSingle()
  return data ? readAvailability(data as Record<string, unknown>) : null
}

/** One coach's own availability blocks, as written (not expanded). */
export async function listMyAvailability(email: string): Promise<Availability[]> {
  const { data, error } = await createServiceClient()
    .from('coach_availability')
    .select('*')
    .eq('coach_email', email.toLowerCase())
    .order('starts_at', { ascending: true })
  if (error) return []
  return ((data ?? []) as Record<string, unknown>[]).map(readAvailability)
}

// ── Permissions ──────────────────────────────────────────────────────────────

/**
 * Who may put something on the calendar for a team.
 *
 * The head of the program, anywhere. A team's head coach — varsity or JV — on
 * a side of the program he works on. Nobody else: an assistant's contribution
 * to the calendar is their availability, which is their own business to set.
 */
export function mayPostTo(viewer: Viewer | null, team: CalTeam): boolean {
  if (!viewer) return false
  if (viewer.isOwner) return true
  if (team === 'program') return false
  return runsATeam(viewer.role) && canTeam(viewer, team)
}

/** Every team this viewer may post to — drives the editor's team picker. */
export function postableTeams(viewer: Viewer | null): CalTeam[] {
  return (['varsity', 'jv', 'program'] as CalTeam[]).filter((t) => mayPostTo(viewer, t))
}

/** A coach's own availability, or — for the head of the program — anyone's. */
export function mayEditAvailability(viewer: Viewer | null, coachEmail: string): boolean {
  if (!viewer) return false
  return viewer.isOwner || viewer.email.toLowerCase() === coachEmail.toLowerCase()
}

// ── Expanding a weekly block ─────────────────────────────────────────────────

/**
 * Every occurrence of an availability block that touches [from, to).
 *
 * A weekly block repeats on the team's wall clock, not in UTC, so "Tuesdays
 * four to six" is still four to six after the clocks change.
 */
export function expandAvailability(a: Availability, from: Date, to: Date): { startsAt: string; endsAt: string; n: number }[] {
  const start = new Date(a.startsAt)
  const end = new Date(a.endsAt)
  if (!a.repeatWeekly) {
    return start < to && end > from ? [{ startsAt: a.startsAt, endsAt: a.endsAt, n: 0 }] : []
  }

  const startYmd = ymdOf(start)
  const startHm = hmOf(start)
  const endYmd = ymdOf(end)
  const endHm = hmOf(end)
  const spanDays = daysBetweenYmd(startYmd, endYmd)

  // First week that could reach into the window.
  const fromYmd = ymdOf(from)
  const weeksToFrom = Math.max(0, Math.floor((daysBetweenYmd(startYmd, fromYmd) - spanDays) / 7) - 1)
  const out: { startsAt: string; endsAt: string; n: number }[] = []
  for (let n = weeksToFrom; n < weeksToFrom + 60; n++) {
    const dayYmd = addDaysYmd(startYmd, n * 7)
    if (a.repeatUntil && dayYmd > a.repeatUntil) break
    const s = zonedToUtc(dayYmd, startHm)
    if (s >= to) break
    const e = zonedToUtc(addDaysYmd(dayYmd, spanDays), endHm)
    if (e > from) out.push({ startsAt: s.toISOString(), endsAt: e.toISOString(), n })
  }
  return out
}

// ── The one query ────────────────────────────────────────────────────────────

export interface CalendarQuery {
  from: Date
  to: Date
  surface: CalSurface
  /** The signed-in coach, on the coach surface. Decides what is editable. */
  viewer?: Viewer | null
  /** Leave out availability (the Team Hub never has it; the War Room may not want it). */
  withAvailability?: boolean
  /**
   * Include field availability — open slots nobody has booked. They aren't
   * anything happening, so only the coaches' calendar itself asks for them.
   */
  withFieldTimes?: boolean
}

/**
 * Everything in a window, for one surface, as calendar items.
 *
 * Events, games and practice plans for every surface (each filtered to what
 * that surface may see); availability on the coach surface only. Sorted by
 * start. Missing tables — a migration not yet run — read as empty rather than
 * breaking the page.
 */
export async function listCalendarItems(q: CalendarQuery): Promise<CalItem[]> {
  const svc = createServiceClient()
  const fromIso = q.from.toISOString()
  const toIso = q.to.toISOString()
  const sees = SURFACE_SEES[q.surface]
  const coach = q.surface === 'coach'
  const items: CalItem[] = []

  // Events.
  {
    const { data, error } = await svc
      .from('calendar_events')
      .select('*')
      .lt('starts_at', toIso)
      .gt('ends_at', fromIso)
      .in('audience', sees)
      .order('starts_at', { ascending: true })
    if (!error) {
      for (const row of (data ?? []) as Record<string, unknown>[]) {
        const e = readEvent(row)
        if (e.kind === 'open' && !q.withFieldTimes) continue
        items.push({
          key: `event:${e.id}`,
          source: 'event',
          id: e.id,
          title: e.title,
          startsAt: e.startsAt,
          endsAt: e.endsAt,
          allDay: e.allDay,
          team: e.team,
          audience: e.audience,
          location: e.location,
          notes: e.notes,
          kind: e.kind,
          href: null,
          editable: coach && mayPostTo(q.viewer ?? null, e.team),
        })
      }
    }
  }

  // Games — they live in the schedule, and keep their own audience there.
  {
    const gamesFrom = new Date(q.from.getTime() - GAME_MINUTES * 60000).toISOString()
    const { data, error } = await svc
      .from('games')
      .select('*')
      .gte('game_date', gamesFrom)
      .lt('game_date', toIso)
      .order('game_date', { ascending: true })
    if (!error) {
      for (const g of (data ?? []) as Record<string, unknown>[]) {
        const aud = gameAudience(g.audience)
        // A game's "team" audience has always meant players *and* parents.
        const visible =
          coach ||
          aud === 'public' ||
          (aud === 'team' && (q.surface === 'team' || q.surface === 'parents'))
        if (!visible) continue
        const start = new Date(String(g.game_date))
        const end = new Date(start.getTime() + GAME_MINUTES * 60000)
        const level = g.level === 'jv' ? 'jv' : 'varsity'
        const ha = String(g.home_away ?? 'home')
        const final = g.status === 'final' && g.team_score != null && g.opp_score != null
        items.push({
          key: `game:${g.id}`,
          source: 'game',
          id: String(g.id),
          title: `${ha === 'away' ? '@' : 'vs'} ${String(g.opponent ?? '')}`.trim(),
          startsAt: start.toISOString(),
          endsAt: end.toISOString(),
          allDay: false,
          team: level,
          audience: aud === 'coaches' ? 'coaches' : aud === 'team' ? 'team' : 'public',
          location: strOrNull(g.location),
          notes: strOrNull(g.notes),
          kind: 'game',
          href: coach ? withTeam('/admin/schedule', level) : null,
          editable: false,
          homeAway: ha,
          result: final ? `${g.team_score}–${g.opp_score}` : null,
        })
      }
    }
  }

  // Practice plans — coaches see every one; players see the ones published to them.
  if (q.surface === 'coach' || q.surface === 'team') {
    // Only the window's practices — game plans are already on the calendar as the game.
    const plans = await listPracticePlansBetween(addDaysYmd(ymdOf(q.from), -1), ymdOf(q.to))
    for (const p of plans) {
      // A private draft is nobody's schedule.
      if (!p.plan_date || p.private) continue
      if (q.surface === 'team' && !p.publish_players) continue
      const start = zonedToUtc(p.plan_date, p.start_time ?? DEFAULT_START)
      const minutes = totalMinutes(p.blocks) || 120
      const end = new Date(start.getTime() + minutes * 60000)
      if (start >= q.to || end <= q.from) continue
      items.push({
        key: `practice:${p.id}`,
        source: 'practice',
        id: p.id,
        title: p.title || 'Practice',
        startsAt: start.toISOString(),
        endsAt: end.toISOString(),
        allDay: false,
        team: p.team,
        audience: p.publish_players ? 'team' : 'coaches',
        location: null,
        notes: p.summary,
        kind: 'practice',
        href: coach ? withTeam(`/admin/planner/${p.id}`, p.team) : null,
        editable: false,
      })
    }
  }

  // Availability — the staff's own business, so the coach surface only.
  if (coach && q.withAvailability !== false) {
    const read = () => svc.from('coach_availability').select('*').lt('starts_at', toIso)
    // Only rows that can reach the window: a one-off still running after it
    // starts, or a weekly block that hasn't run out before it. Should that
    // filter ever be refused, read the lot rather than show nobody out.
    let { data, error } = await read()
      .or(`ends_at.gt.${fromIso},and(repeat_weekly.eq.true,or(repeat_until.is.null,repeat_until.gte.${ymdOf(q.from)}))`)
      .order('starts_at', { ascending: true })
    if (error) ({ data, error } = await read().order('starts_at', { ascending: true }))
    if (!error) {
      for (const row of (data ?? []) as Record<string, unknown>[]) {
        const a = readAvailability(row)
        // Available is the default; only the times a coach is out are drawn.
        if (a.status === 'available') continue
        for (const occ of expandAvailability(a, q.from, q.to)) {
          items.push({
            key: `avail:${a.id}:${occ.n}`,
            source: 'availability',
            id: a.id,
            title: `${a.coachName || a.coachEmail.split('@')[0]} — out`,
            startsAt: occ.startsAt,
            endsAt: occ.endsAt,
            allDay: a.allDay,
            team: 'program',
            audience: 'coaches',
            location: null,
            notes: a.note,
            kind: a.status,
            href: null,
            editable: mayEditAvailability(q.viewer ?? null, a.coachEmail),
            coachEmail: a.coachEmail,
            coachName: a.coachName,
          })
        }
      }
    }
  }

  items.sort((a, b) => a.startsAt.localeCompare(b.startsAt) || Number(b.allDay) - Number(a.allDay))
  return items
}

// ── Writing ──────────────────────────────────────────────────────────────────

export interface EventWrite {
  team: CalTeam
  title: string
  kind: string
  startsAt: string
  endsAt: string
  allDay: boolean
  location: string | null
  notes: string | null
  audience: string
}

function eventRow(e: EventWrite) {
  return {
    team: e.team,
    title: e.title,
    kind: isCalEventKind(e.kind) ? e.kind : 'event',
    starts_at: e.startsAt,
    ends_at: e.endsAt,
    all_day: e.allDay,
    location: e.location,
    notes: e.notes,
    audience: isCalAudience(e.audience) ? e.audience : 'coaches',
  }
}

export async function insertEvent(e: EventWrite, by: string | null): Promise<string | null> {
  const { data, error } = await createServiceClient()
    .from('calendar_events')
    .insert({ ...eventRow(e), created_by: by })
    .select('id')
    .maybeSingle()
  if (error) console.error('[insertEvent]', error)
  return (data as { id?: string } | null)?.id ?? null
}

export async function updateEvent(id: string, e: EventWrite): Promise<boolean> {
  const { error } = await createServiceClient()
    .from('calendar_events')
    .update({ ...eventRow(e), updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) console.error('[updateEvent]', error)
  return !error
}

export async function removeEvent(id: string): Promise<void> {
  await createServiceClient().from('calendar_events').delete().eq('id', id)
}

export interface AvailabilityWrite {
  status: 'available' | 'unavailable'
  startsAt: string
  endsAt: string
  allDay: boolean
  repeatWeekly: boolean
  repeatUntil: string | null
  note: string | null
}

function availabilityRow(a: AvailabilityWrite) {
  return {
    status: a.status === 'available' ? 'available' : 'unavailable',
    starts_at: a.startsAt,
    ends_at: a.endsAt,
    all_day: a.allDay,
    repeat_weekly: a.repeatWeekly,
    repeat_until: a.repeatWeekly ? a.repeatUntil : null,
    note: a.note,
  }
}

export async function insertAvailability(
  a: AvailabilityWrite,
  coach: { email: string; name: string }
): Promise<string | null> {
  const { data, error } = await createServiceClient()
    .from('coach_availability')
    .insert({ ...availabilityRow(a), coach_email: coach.email.toLowerCase(), coach_name: coach.name })
    .select('id')
    .maybeSingle()
  if (error) console.error('[insertAvailability]', error)
  return (data as { id?: string } | null)?.id ?? null
}

export async function updateAvailability(id: string, a: AvailabilityWrite): Promise<boolean> {
  const { error } = await createServiceClient()
    .from('coach_availability')
    .update({ ...availabilityRow(a), updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) console.error('[updateAvailability]', error)
  return !error
}

export async function removeAvailability(id: string): Promise<void> {
  await createServiceClient().from('coach_availability').delete().eq('id', id)
}
