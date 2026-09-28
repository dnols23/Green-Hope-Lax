'use server'

import { getViewer } from './permissions'
import { availabilityOverlaps, describeAvailability, findAvailabilityClash } from './availabilityText'
import {
  expandAvailability,
  getAvailability,
  getEvent,
  insertAvailability,
  insertEvent,
  insertSeries,
  listSeriesFrom,
  removeEvents,
  setSeries,
  listMyAvailability,
  mayEditAvailability,
  mayPostTo,
  removeAvailability,
  removeEvent,
  updateAvailability,
  updateEvent,
  writeCalendarShare,
  type AvailabilityWrite,
  type EventWrite,
} from './calendarData'
import { isCalAudience, isCalEventKind, isCalTeam, type Availability } from './calendarModel'
import { addDaysYmd, daysBetweenYmd, hmOf, ymdOf, zonedToUtc, zoneParts } from './zoned'
import { randomUUID } from 'node:crypto'
import { readRepeat, repeatDates } from './eventRepeat'
import { revalidatePath } from 'next/cache'
import { createServiceClient } from './supabase-server'
import { canSee, canTeam, isSandboxed } from './sections'
import { withTeam } from './teams'
import { parseCalendarShare } from './calendarShare'

/**
 * Writing the calendar.
 *
 * Called straight from the calendar screen with plain objects — a drag, a
 * resize and a form all end up here. Every one re-reads who is asking and what
 * they are touching from the server's side, never from what the browser says.
 */

export type CalResult =
  | { ok: true; id?: string }
  /** clashId: the block this one would have overlapped, so the screen can open it. */
  | { ok: false; error: string; clashId?: string }

const MAX_SPAN_MS = 1000 * 60 * 60 * 24 * 60 // sixty days
const MAX_BLOCKS = 300 // availability rows per coach

function cleanTimes(startsAt: unknown, endsAt: unknown): { s: string; e: string } | string {
  const s = new Date(String(startsAt))
  const e = new Date(String(endsAt))
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return 'That time could not be read.'
  if (e < s) return 'It has to finish after it starts.'
  if (e.getTime() - s.getTime() > MAX_SPAN_MS) return 'That runs for more than sixty days.'
  return { s: s.toISOString(), e: e.toISOString() }
}

// No revalidatePath here, on purpose. Every page that shows the calendar — the
// coaches' calendar, the War Room, the Team Hub, the Parent Hub, the public
// schedule — is drawn fresh on every visit, so there is no cached copy to throw
// away, and the calendar screen fetches its own window again after each change.
// Calling it anyway made Next redraw the page the coach was on after every drag
// and save, and because the calendar keeps its week in the address bar that
// redraw jumped the page back to the top.

// ── Events ───────────────────────────────────────────────────────────────────

export interface EventInput {
  id?: string | null
  team: string
  title: string
  kind: string
  startsAt: string
  endsAt: string
  allDay: boolean
  location?: string | null
  notes?: string | null
  audience: string
  /** New, or a one-off being made to repeat: weekdays and a last day. */
  repeat?: { days: number[]; until: string } | null
  /** Editing one of a series: just this one, or this and every later one. */
  scope?: 'one' | 'later'
}

const NEEDS_0047 = 'Repeating events need supabase/migrations/0047_event_repeats.sql run in the Supabase SQL editor.'

/** When the event lands on another day: same clock time, same length, in Cary. */
function onDay(ymd: string, w: { startsAt: string; endsAt: string; allDay: boolean }) {
  if (w.allDay) {
    const span = Math.max(1, daysBetweenYmd(ymdOf(w.startsAt), ymdOf(w.endsAt)))
    return { startsAt: zonedToUtc(ymd, '00:00').toISOString(), endsAt: zonedToUtc(addDaysYmd(ymd, span), '00:00').toISOString() }
  }
  const s = zonedToUtc(ymd, hmOf(w.startsAt))
  const length = Date.parse(w.endsAt) - Date.parse(w.startsAt)
  return { startsAt: s.toISOString(), endsAt: new Date(s.getTime() + length).toISOString() }
}

export async function saveCalEvent(input: EventInput): Promise<CalResult> {
  const viewer = await getViewer()
  if (!viewer) return { ok: false, error: 'Sign in again.' }

  const team = isCalTeam(input.team) ? input.team : 'program'
  const title = String(input.title ?? '').trim().slice(0, 200)
  if (!title) return { ok: false, error: 'Give it a name.' }
  if (!mayPostTo(viewer, team)) return { ok: false, error: 'You can’t add to that team’s calendar.' }

  const times = cleanTimes(input.startsAt, input.endsAt)
  if (typeof times === 'string') return { ok: false, error: times }

  const write: EventWrite = {
    team,
    title,
    kind: isCalEventKind(input.kind) ? input.kind : 'event',
    startsAt: times.s,
    endsAt: times.e,
    allDay: input.allDay === true,
    location: String(input.location ?? '').trim().slice(0, 200) || null,
    notes: String(input.notes ?? '').trim().slice(0, 4000) || null,
    audience: isCalAudience(input.audience) ? input.audience : 'coaches',
  }

  if (input.id) {
    const existing = await getEvent(String(input.id))
    if (!existing) return { ok: false, error: 'That event is gone.' }
    // Moving an event to another team needs the right to both.
    if (!mayPostTo(viewer, existing.team)) return { ok: false, error: 'That event isn’t yours to change.' }

    /* This one and every later one: each keeps its own day, moved by as many
       days as this one moved, at this one's new time and length. */
    if (existing.seriesId && input.scope === 'later') {
      const later = await listSeriesFrom(existing.seriesId, existing.startsAt)
      const shift = daysBetweenYmd(ymdOf(existing.startsAt), ymdOf(write.startsAt))
      const done = await Promise.all(
        later.map(async (ev) => {
          const times = onDay(addDaysYmd(ymdOf(ev.startsAt), shift), write)
          const ok = await updateEvent(ev.id, { ...write, ...times })
          if (ok) await followPractice(ev.id, times.startsAt, write.allDay)
          return ok
        }),
      )
      if (done.some((ok) => !ok)) return { ok: false, error: 'Some of them didn’t save. Try again.' }
      return { ok: true, id: existing.id }
    }

    const ok = await updateEvent(existing.id, write)
    if (!ok) return { ok: false, error: 'Couldn’t save — has the calendar SQL been run?' }
    await followPractice(existing.id, write.startsAt, write.allDay)

    // A one-off made to repeat: it becomes the first of a series.
    const repeat = readRepeat(input.repeat)
    if (repeat && !existing.seriesId) {
      const days = repeatDates(ymdOf(write.startsAt), repeat).slice(1)
      if (days.length) {
        const seriesId = randomUUID()
        if (!(await setSeries([existing.id], seriesId))) return { ok: false, error: NEEDS_0047 }
        const made = await insertSeries(days.map((d) => onDay(d, write)), write, viewer.name || viewer.email, seriesId)
        if ('error' in made) return { ok: false, error: /series_id/i.test(made.error) ? NEEDS_0047 : 'Saved this one, but not the repeats.' }
      }
    }
    return { ok: true, id: existing.id }
  }

  const repeat = readRepeat(input.repeat)
  if (repeat) {
    const days = repeatDates(ymdOf(write.startsAt), repeat)
    const made = await insertSeries(days.map((d) => onDay(d, write)), write, viewer.name || viewer.email, randomUUID())
    if ('error' in made) return { ok: false, error: /series_id/i.test(made.error) ? NEEDS_0047 : 'Couldn’t save them.' }
    return { ok: true, id: made.id }
  }

  const id = await insertEvent(write, viewer.name || viewer.email)
  if (!id) return { ok: false, error: 'Couldn’t save — has supabase/migrations/0039_calendar.sql been run?' }
  return { ok: true, id }
}

/** A drag or a resize: the same event, new times. */
export async function moveCalEvent(id: string, startsAt: string, endsAt: string): Promise<CalResult> {
  const viewer = await getViewer()
  const existing = await getEvent(id)
  if (!viewer || !existing) return { ok: false, error: 'That event is gone.' }
  if (!mayPostTo(viewer, existing.team)) return { ok: false, error: 'That event isn’t yours to move.' }
  const times = cleanTimes(startsAt, endsAt)
  if (typeof times === 'string') return { ok: false, error: times }
  const ok = await updateEvent(id, { ...existing, startsAt: times.s, endsAt: times.e })
  if (!ok) return { ok: false, error: 'Couldn’t move it.' }
  await followPractice(id, times.s, existing.allDay)
  return { ok: true, id }
}

/** A plan made from a practice moves with it. Nothing to do before 0046. */
async function followPractice(eventId: string, startsAt: string, allDay: boolean) {
  const at = new Date(startsAt)
  const patch: Record<string, unknown> = { plan_date: ymdOf(at) }
  if (!allDay) patch.start_time = hmOf(at)
  await createServiceClient().from('plans').update(patch).eq('calendar_event_id', eventId)
}

/**
 * A practice plan for a practice on the calendar: named, dated and timed from
 * it, and tied to it, so the practice opens the plan and the plan moves when
 * the practice does. One plan per practice — asking again opens it.
 */
export async function planFromEvent(eventId: string): Promise<{ ok: true; href: string } | { ok: false; error: string }> {
  const viewer = await getViewer()
  if (!viewer || !canSee(viewer, 'planner')) return { ok: false, error: 'You don’t have the planner.' }
  const e = await getEvent(String(eventId))
  if (!e) return { ok: false, error: 'That practice is gone.' }
  const team = e.team === 'program' ? (canTeam(viewer, 'varsity') ? 'varsity' : 'jv') : e.team
  if (!canTeam(viewer, team)) return { ok: false, error: 'That’s the other staff’s practice.' }
  const sandboxed = isSandboxed(viewer)
  const svc = createServiceClient()

  const { data: had, error: lookError } = await svc
    .from('plans')
    .select('id, team, private, created_by')
    .eq('calendar_event_id', e.id)
  if (lookError) {
    return /calendar_event_id/i.test(lookError.message)
      ? { ok: false, error: 'Run supabase/migrations/0046_plan_calendar.sql in the Supabase SQL editor first.' }
      : { ok: false, error: `Couldn’t check for a plan: ${lookError.message}` }
  }
  const mine = (p: Record<string, unknown>) => String(p.created_by ?? '').toLowerCase() === viewer.email.toLowerCase()
  const found = ((had ?? []) as Record<string, unknown>[]).find((p) => (sandboxed ? p.private === true && mine(p) : p.private !== true))
  if (found) return { ok: true, href: withTeam(`/admin/planner/${found.id}`, found.team === 'jv' ? 'jv' : 'varsity') }

  const at = new Date(e.startsAt)
  const row: Record<string, unknown> = {
    kind: 'practice',
    title: e.title || 'Practice',
    plan_date: ymdOf(at),
    start_time: e.allDay ? null : hmOf(at),
    team,
    created_by: viewer.email,
    blocks: [],
    calendar_event_id: e.id,
    // The practice is what is on the calendar; the plan rides on it.
    on_calendar: false,
  }
  if (sandboxed) {
    row.private = true
    row.publish_coaches = false
    row.publish_players = false
  }
  const { data, error } = await svc.from('plans').insert(row).select('id').single()
  if (error || !data) return { ok: false, error: `Couldn’t make the plan: ${error?.message ?? 'no reply'}` }
  revalidatePath('/admin/planner')
  return { ok: true, href: withTeam(`/admin/planner/${(data as { id: string }).id}`, team) }
}

export async function deleteCalEvent(id: string, scope: 'one' | 'later' = 'one'): Promise<CalResult> {
  const viewer = await getViewer()
  const existing = await getEvent(id)
  if (!viewer || !existing) return { ok: false, error: 'That event is gone.' }
  if (!mayPostTo(viewer, existing.team)) return { ok: false, error: 'That event isn’t yours to delete.' }
  if (scope === 'later' && existing.seriesId) {
    const later = await listSeriesFrom(existing.seriesId, existing.startsAt)
    await removeEvents(later.map((e) => e.id))
    return { ok: true }
  }
  await removeEvent(id)
  return { ok: true }
}

// ── Availability ─────────────────────────────────────────────────────────────

export interface AvailabilityInput {
  id?: string | null
  status: 'available' | 'unavailable'
  startsAt: string
  endsAt: string
  allDay: boolean
  repeatWeekly: boolean
  /** YYYY-MM-DD, inclusive. */
  repeatUntil?: string | null
  note?: string | null
}

function cleanAvailability(input: AvailabilityInput): AvailabilityWrite | string {
  const times = cleanTimes(input.startsAt, input.endsAt)
  if (typeof times === 'string') return times
  const until = String(input.repeatUntil ?? '').trim()
  return {
    // Available is the default; a coach only ever says when they're out.
    status: 'unavailable',
    startsAt: times.s,
    endsAt: times.e,
    allDay: input.allDay === true,
    repeatWeekly: input.repeatWeekly === true,
    repeatUntil: /^\d{4}-\d{2}-\d{2}$/.test(until) ? until : null,
    note: String(input.note ?? '').trim().slice(0, 500) || null,
  }
}

/**
 * An instant moved so that this server's own clock reads the team's wall
 * clock. describeAvailability() speaks in the local clock — right in a coach's
 * browser, but UTC here — so without this "all day Thursday" would come out
 * as "Thursday – Friday", four hours late.
 */
function onTeamClock(iso: string): string {
  const p = zoneParts(iso)
  return new Date(p.y, p.m - 1, p.d, p.h, p.mi).toISOString()
}

/** "You already have “Available all day Thu, Sep 24” then — …", on the team's clock. */
function clashMessage(clash: Availability, own: boolean): string {
  const words = describeAvailability(
    { ...clash, startsAt: onTeamClock(clash.startsAt), endsAt: onTeamClock(clash.endsAt) },
    new Date(onTeamClock(new Date().toISOString())),
  )
  const who = own ? 'You already have' : `${clash.coachName || clash.coachEmail.split('@')[0]} already has`
  return `${who} “${words}” then — edit or delete that one instead.`
}

/**
 * Every coach sets their own; the head of the program can correct anyone's.
 *
 * No two of a coach's blocks may cover the same time — two "available all day
 * Thursday"s, or "out" on top of "available", only leave the head coach
 * guessing which one is true. The panel checks first; this is the check that
 * counts.
 */
export async function saveAvailability(input: AvailabilityInput): Promise<CalResult> {
  const viewer = await getViewer()
  if (!viewer) return { ok: false, error: 'Sign in again.' }
  const write = cleanAvailability(input)
  if (typeof write === 'string') return { ok: false, error: write }

  let existing: Availability | null = null
  if (input.id) {
    existing = await getAvailability(String(input.id))
    if (!existing) return { ok: false, error: 'That block is gone.' }
    if (!mayEditAvailability(viewer, existing.coachEmail)) {
      return { ok: false, error: 'That isn’t your availability.' }
    }
  }

  // Whose calendar this lands on: the viewer's own, or — when the head of the
  // program is fixing someone else's block — that coach's.
  const coachEmail = existing ? existing.coachEmail : viewer.email.toLowerCase()
  const theirs = await listMyAvailability(coachEmail)
  /* Only "out" blocks can clash (an old "available" one means nothing now).
     And an edit is only held to clashes it would make — a block that already
     overlapped another before this rule can still have its note fixed. */
  const against = theirs.filter(
    (a) => a.status === 'unavailable' && !(existing && availabilityOverlaps(existing, a, expandAvailability)),
  )
  const clash = findAvailabilityClash(
    { ...write, id: existing?.id ?? '', coachEmail, coachName: existing?.coachName ?? viewer.name },
    against,
    // The team's clock, so "Tuesdays four to six" lines up across the clock change.
    expandAvailability,
  )
  if (clash) {
    const own = coachEmail === viewer.email.toLowerCase()
    return { ok: false, error: clashMessage(clash, own), clashId: clash.id }
  }

  if (existing) {
    const ok = await updateAvailability(existing.id, write)
    if (!ok) return { ok: false, error: 'Couldn’t save it.' }
    return { ok: true, id: existing.id }
  }

  if (theirs.length >= MAX_BLOCKS) {
    return { ok: false, error: 'That’s a lot of blocks — delete some old ones first.' }
  }
  const id = await insertAvailability(write, { email: viewer.email, name: viewer.name })
  if (!id) return { ok: false, error: 'Couldn’t save — has supabase/migrations/0039_calendar.sql been run?' }
  return { ok: true, id }
}

export async function deleteAvailability(id: string): Promise<CalResult> {
  const viewer = await getViewer()
  const existing = await getAvailability(id)
  if (!viewer || !existing) return { ok: false, error: 'That block is gone.' }
  if (!mayEditAvailability(viewer, existing.coachEmail)) {
    return { ok: false, error: 'That isn’t your availability.' }
  }
  await removeAvailability(id)
  return { ok: true }
}

// ── Sharing ──────────────────────────────────────────────────────────────────

/** The owner's choice of what each calendar shares with each hub. */
export async function saveCalendarShare(input: unknown): Promise<CalResult> {
  const viewer = await getViewer()
  if (!viewer?.isOwner) return { ok: false, error: 'Only the head of the program sets this.' }
  const ok = await writeCalendarShare(parseCalendarShare(input))
  return ok ? { ok: true } : { ok: false, error: 'Couldn’t save it.' }
}
