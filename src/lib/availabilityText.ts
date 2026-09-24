// Availability, said the way a coach would say it.
//
// "Out Thu, Sep 24 – Sun, Sep 27" reads in one glance; a start and an end
// timestamp does not. The availability panel lists a coach's own blocks in
// these words, and the calendar's "who's out" strip groups the staff with
// whoIsOut().
//
// Pure — no server imports — and written in the browser's own clock, the same
// clock the coach typed the block in. The staff all live around Cary, so that
// is the team's time zone in practice.

import type { Availability } from './calendarModel'

const DAY_MS = 24 * 60 * 60 * 1000

const pad = (n: number) => String(n).padStart(2, '0')

/** YYYY-MM-DD of an instant on the browser's clock. */
export function localYmd(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Midnight at the start of a YYYY-MM-DD, on the browser's clock. */
export function localMidnight(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

function sameDay(a: Date, b: Date): boolean {
  return localYmd(a) === localYmd(b)
}

/**
 * The last day an all-day block covers.
 *
 * All-day ends are exclusive — midnight after the last day — so the last day
 * is the day before the end. A zero-length block still counts its own day.
 */
export function lastDayOf(startsAt: string, endsAt: string): Date {
  const start = new Date(startsAt)
  const end = new Date(endsAt)
  const last = new Date(end.getFullYear(), end.getMonth(), end.getDate() - 1)
  // An end that isn't exactly midnight (edited by hand, or across a clock
  // change) still covers the day it lands on.
  const exact = end.getHours() === 0 && end.getMinutes() === 0
  const day = exact ? last : new Date(end.getFullYear(), end.getMonth(), end.getDate())
  return day < start ? new Date(start.getFullYear(), start.getMonth(), start.getDate()) : day
}

/** "Tue, Sep 22" — with the year only when it isn't this year. */
function dateLabel(d: Date, now: Date): string {
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...(d.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
  })
}

/** "Dec 1" — with the year only when it isn't this year. */
function shortDate(d: Date, now: Date): string {
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(d.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
  })
}

function weekdayName(d: Date): string {
  return d.toLocaleDateString('en-US', { weekday: 'long' })
}

function clock(d: Date): { hm: string; ampm: 'AM' | 'PM' } {
  const h = d.getHours()
  return { hm: `${h % 12 || 12}:${pad(d.getMinutes())}`, ampm: h < 12 ? 'AM' : 'PM' }
}

/** "4:00 PM" */
export function timeLabel(d: Date): string {
  const c = clock(d)
  return `${c.hm} ${c.ampm}`
}

/** "4:00 – 6:00 PM", or "10:00 AM – 2:00 PM" when it crosses noon. */
export function timeRange(start: Date, end: Date): string {
  const s = clock(start)
  const e = clock(end)
  return s.ampm === e.ampm ? `${s.hm} – ${e.hm} ${e.ampm}` : `${s.hm} ${s.ampm} – ${e.hm} ${e.ampm}`
}

/**
 * One block in plain words.
 *
 *   Out all day Tue, Sep 22
 *   Out Thu, Sep 24 – Sun, Sep 27
 *   Out 4:00 – 6:00 PM Tue, Sep 22
 *   Out every Tuesday, 4:00 – 6:00 PM, until Dec 1
 *   Available every Saturday, all day — Offering a scrimmage day
 *
 * `now` only decides whether a year is worth writing and whether a weekly
 * block has started yet; leave it out.
 */
export function describeAvailability(a: Availability, now: Date = new Date()): string {
  const lead = a.status === 'available' ? 'Available' : 'Out'
  const start = new Date(a.startsAt)
  const end = new Date(a.endsAt)
  let text: string

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    text = lead
  } else if (a.repeatWeekly) {
    const parts: string[] = []
    if (a.allDay) {
      const last = lastDayOf(a.startsAt, a.endsAt)
      parts.push(
        sameDay(start, last)
          ? `${lead} every ${weekdayName(start)}, all day`
          : `${lead} every ${weekdayName(start)} – ${weekdayName(last)}`,
      )
    } else if (sameDay(start, end)) {
      parts.push(`${lead} every ${weekdayName(start)}, ${timeRange(start, end)}`)
    } else {
      parts.push(`${lead} every ${weekdayName(start)} ${timeLabel(start)} – ${weekdayName(end)} ${timeLabel(end)}`)
    }
    // A weekly block that hasn't begun yet says when it does, so "every
    // Tuesday" isn't read as starting this Tuesday.
    if (localYmd(start) > localYmd(now)) parts.push(`from ${shortDate(start, now)}`)
    if (a.repeatUntil) parts.push(`until ${shortDate(localMidnight(a.repeatUntil), now)}`)
    text = parts.join(', ')
  } else if (a.allDay) {
    const last = lastDayOf(a.startsAt, a.endsAt)
    text = sameDay(start, last)
      ? `${lead} all day ${dateLabel(start, now)}`
      : `${lead} ${dateLabel(start, now)} – ${dateLabel(last, now)}`
  } else if (sameDay(start, end)) {
    text = `${lead} ${timeRange(start, end)} ${dateLabel(start, now)}`
  } else {
    text = `${lead} ${dateLabel(start, now)}, ${timeLabel(start)} – ${dateLabel(end, now)}, ${timeLabel(end)}`
  }

  const note = a.note?.trim()
  return note ? `${text} — ${note}` : text
}

/**
 * When a block next matters, for putting a coach's list in order.
 *
 * A one-off is its start. A weekly block is its next time round that hasn't
 * finished yet, so "every Tuesday since August" sorts beside next Tuesday
 * rather than at the top. Null when it is over for good.
 */
export function nextOccurrence(a: Availability, now: Date = new Date()): { startsAt: Date; endsAt: Date } | null {
  const start = new Date(a.startsAt)
  const end = new Date(a.endsAt)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null
  if (!a.repeatWeekly) return end > now ? { startsAt: start, endsAt: end } : null

  // Step whole calendar weeks on the local clock, so a Tuesday four o'clock
  // stays four o'clock across the clock change.
  const span = end.getTime() - start.getTime()
  const weeksBehind = Math.max(0, Math.floor((now.getTime() - end.getTime()) / (7 * DAY_MS)))
  for (let n = weeksBehind; n < weeksBehind + 3; n++) {
    const s = new Date(
      start.getFullYear(),
      start.getMonth(),
      start.getDate() + n * 7,
      start.getHours(),
      start.getMinutes(),
    )
    if (a.repeatUntil && localYmd(s) > a.repeatUntil) return null
    const e = new Date(s.getTime() + span)
    if (e > now) return { startsAt: s, endsAt: e }
  }
  return null
}

/** Over and done with: a one-off that has ended, or a weekly block past its last week. */
export function isPastAvailability(a: Availability, now: Date = new Date()): boolean {
  return nextOccurrence(a, now) === null
}

/**
 * Who's out, from a set of calendar items.
 *
 * Only the "can't make it" blocks count — a coach offering a Saturday isn't
 * news for this. One group per coach, that coach's blocks in time order, the
 * coaches in name order so the list reads the same every time it is opened.
 */
export function whoIsOut<
  T extends {
    source: string
    kind: string
    coachName?: string
    coachEmail?: string
    startsAt: string
    endsAt: string
    allDay: boolean
  },
>(items: T[]): { coachEmail: string; coachName: string; items: T[] }[] {
  const groups = new Map<string, { coachEmail: string; coachName: string; items: T[] }>()
  for (const item of items) {
    if (item.source !== 'availability' || item.kind !== 'unavailable') continue
    const email = (item.coachEmail ?? '').trim()
    const name = (item.coachName ?? '').trim()
    const key = (email || name).toLowerCase()
    if (!key) continue
    let group = groups.get(key)
    if (!group) {
      group = { coachEmail: email, coachName: name || email.split('@')[0], items: [] }
      groups.set(key, group)
    }
    // The first row may have come without a name; take one when it turns up.
    if (name && email && group.coachName === email.split('@')[0]) group.coachName = name
    group.items.push(item)
  }
  const out = [...groups.values()]
  for (const g of out) {
    g.items.sort((a, b) => a.startsAt.localeCompare(b.startsAt) || Number(b.allDay) - Number(a.allDay))
  }
  out.sort((a, b) => a.coachName.localeCompare(b.coachName, 'en', { sensitivity: 'base' }))
  return out
}

// ── Overlaps ─────────────────────────────────────────────────────────────────
//
// A coach can't be two things at once, so no two of their blocks may cover the
// same stretch of time — two "Available all day Thursday"s, or "Out Tuesday
// evenings" on top of "Available Tuesday 5–7". Status doesn't matter; any
// overlap is a mistake. Finishing at six and starting at six is fine.

/** One time round of a block, as instants. */
export interface AvailabilityOccurrence {
  startsAt: string
  endsAt: string
}

/**
 * Every time round of a block that touches [from, to). The browser uses
 * expandLocalAvailability below; the server hands in calendarData's
 * expandAvailability, which reads the team's clock rather than its own UTC.
 */
export type ExpandAvailability = (a: Availability, from: Date, to: Date) => AvailabilityOccurrence[]

/** How far ahead two open-ended weekly blocks are checked — a season and then some. */
export const OVERLAP_HORIZON_DAYS = 400

// Weekly blocks are walked in slices this long, so no one call has to hand
// back more than a few dozen weeks.
const SLICE_MS = 180 * DAY_MS

/**
 * expandAvailability on the browser's clock: whole calendar weeks, so a
 * Tuesday four to six is still four to six after the clocks change.
 */
export function expandLocalAvailability(a: Availability, from: Date, to: Date): AvailabilityOccurrence[] {
  const start = new Date(a.startsAt)
  const end = new Date(a.endsAt)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return []
  if (!a.repeatWeekly) {
    return start < to && end > from ? [{ startsAt: a.startsAt, endsAt: a.endsAt }] : []
  }
  const out: AvailabilityOccurrence[] = []
  const first = Math.max(0, Math.floor((from.getTime() - end.getTime()) / (7 * DAY_MS)) - 1)
  for (let n = first; n < first + 60; n++) {
    const s = new Date(start.getFullYear(), start.getMonth(), start.getDate() + n * 7, start.getHours(), start.getMinutes())
    if (a.repeatUntil && localYmd(s) > a.repeatUntil) break
    if (s >= to) break
    const e = new Date(end.getFullYear(), end.getMonth(), end.getDate() + n * 7, end.getHours(), end.getMinutes())
    if (e > from) out.push({ startsAt: s.toISOString(), endsAt: e.toISOString() })
  }
  return out
}

/** First start to last finish, in milliseconds. A weekly block with no end runs for ever. */
function reachOf(a: Availability): { from: number; to: number } | null {
  const start = new Date(a.startsAt).getTime()
  const end = new Date(a.endsAt).getTime()
  if (Number.isNaN(start) || Number.isNaN(end)) return null
  if (!a.repeatWeekly) return { from: start, to: end }
  if (!a.repeatUntil) return { from: start, to: Infinity }
  // A couple of days' slack past the last week, so a clock change or a
  // different time zone on the server never cuts the last one off. The
  // expander itself decides exactly which weeks count.
  return { from: start, to: localMidnight(a.repeatUntil).getTime() + 2 * DAY_MS + (end - start) }
}

/** Do any two times round of these blocks cover the same moment? */
export function availabilityOverlaps(
  a: Availability,
  b: Availability,
  expand: ExpandAvailability = expandLocalAvailability,
): boolean {
  const ra = reachOf(a)
  const rb = reachOf(b)
  if (!ra || !rb) return false
  // Only the stretch both could reach is worth walking.
  const from = Math.max(ra.from, rb.from)
  let to = Math.min(ra.to, rb.to, from + OVERLAP_HORIZON_DAYS * DAY_MS)
  // Two weekly blocks line up the same way every week, so once both are
  // running a few weeks shows everything a whole season would.
  if (a.repeatWeekly && b.repeatWeekly) to = Math.min(to, from + 21 * DAY_MS)
  if (!(from < to)) return false

  for (let sliceFrom = from; sliceFrom < to; sliceFrom += SLICE_MS) {
    const window: [Date, Date] = [new Date(sliceFrom), new Date(Math.min(sliceFrom + SLICE_MS, to))]
    const as = expand(a, ...window)
    if (as.length === 0) continue
    const bs = expand(b, ...window)
    for (const x of as) {
      const xs = new Date(x.startsAt).getTime()
      const xe = new Date(x.endsAt).getTime()
      for (const y of bs) {
        // Strictly inside each other: 4–6 then 6–8 only touch.
        if (xs < new Date(y.endsAt).getTime() && new Date(y.startsAt).getTime() < xe) return true
      }
    }
  }
  return false
}

/**
 * The first of `others` a block would overlap, or null when it fits. A block
 * never clashes with itself, so an edit can be checked against the whole list.
 */
export function findAvailabilityClash<T extends Availability>(
  block: Availability,
  others: T[],
  expand: ExpandAvailability = expandLocalAvailability,
): T | null {
  for (const o of others) {
    if (block.id && o.id === block.id) continue
    if (availabilityOverlaps(block, o, expand)) return o
  }
  return null
}

/** Every block in a list that overlaps another in the same list. */
export function overlappingAvailabilityIds(
  list: Availability[],
  expand: ExpandAvailability = expandLocalAvailability,
): Set<string> {
  const ids = new Set<string>()
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      if (ids.has(list[i].id) && ids.has(list[j].id)) continue
      if (availabilityOverlaps(list[i], list[j], expand)) {
        ids.add(list[i].id)
        ids.add(list[j].id)
      }
    }
  }
  return ids
}
