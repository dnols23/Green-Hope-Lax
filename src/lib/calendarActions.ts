'use server'

import { getViewer } from './permissions'
import { availabilityOverlaps, describeAvailability, findAvailabilityClash } from './availabilityText'
import {
  expandAvailability,
  getAvailability,
  getEvent,
  insertAvailability,
  insertEvent,
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
import { zoneParts } from './zoned'
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
    const ok = await updateEvent(existing.id, write)
    if (!ok) return { ok: false, error: 'Couldn’t save — has the calendar SQL been run?' }
    return { ok: true, id: existing.id }
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
  return { ok: true, id }
}

export async function deleteCalEvent(id: string): Promise<CalResult> {
  const viewer = await getViewer()
  const existing = await getEvent(id)
  if (!viewer || !existing) return { ok: false, error: 'That event is gone.' }
  if (!mayPostTo(viewer, existing.team)) return { ok: false, error: 'That event isn’t yours to delete.' }
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
