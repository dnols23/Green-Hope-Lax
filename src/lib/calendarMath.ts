import type { CalView } from './calendarModel'

/**
 * The calendar's date arithmetic.
 *
 * Pure — no server imports, no React — so the calendar screen can do all of its
 * paging, grid building and block placement in the browser without a round
 * trip.
 *
 * Everything here works in the BROWSER'S LOCAL TIME, on purpose. The screen is a
 * client component, the hour labels down the side of the week view are the
 * phone's own clock, and "today" has to be the coach's today. The team-time-zone
 * helpers for the server live in zoned.ts; this file never names a zone.
 *
 * Two habits run through the whole file and both are about daylight saving:
 *
 *  - Days are stepped with the Date's own local fields (new Date(y, m, d + n)),
 *    never by adding 86,400,000 ms. The Sunday the clocks change is 23 or 25
 *    hours long, and adding a fixed day of milliseconds across it lands at 11 PM
 *    or 1 AM instead of midnight — every block after it would sit an hour off.
 *  - Positions on the time grid are wall-clock minutes (4:00 PM is 960 whatever
 *    the date), because the grid is labelled by the clock, not by elapsed time.
 *    Whether two things overlap is still decided on the real instants.
 */

// ── Names ───────────────────────────────────────────────────────────────────

// Spelled out rather than asked of Intl so a title reads the same on every
// phone, whatever language or ICU build the browser has.
export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]
export const MONTH_SHORT = MONTH_NAMES.map((m) => m.slice(0, 3))
export const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
export const WEEKDAY_SHORT = WEEKDAY_NAMES.map((d) => d.slice(0, 3))

const MINUTE_MS = 60_000
const DAY_MINUTES = 1440

// ── Days ────────────────────────────────────────────────────────────────────

/** Local midnight at the start of that date. */
export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

/**
 * The same clock time n calendar days later (or earlier).
 *
 * Built from the local fields so it survives the clock change: midnight the
 * night before the clocks fall back, plus one day, is still midnight.
 */
export function addDays(d: Date, n: number): Date {
  return new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate() + n,
    d.getHours(),
    d.getMinutes(),
    d.getSeconds(),
    d.getMilliseconds(),
  )
}

/** How many days that month has (month is 0-based, like Date's). */
export function daysInMonth(year: number, month: number): number {
  // Day 0 of the next month is the last day of this one.
  return new Date(year, month + 1, 0).getDate()
}

/**
 * The same day n months later, clamped to the end of a shorter month.
 *
 * Plain setMonth() rolls Jan 31 + 1 month over into March 3rd, which would make
 * the month view's "next" arrow skip February entirely.
 */
export function addMonths(d: Date, n: number): Date {
  const first = new Date(d.getFullYear(), d.getMonth() + n, 1)
  const day = Math.min(d.getDate(), daysInMonth(first.getFullYear(), first.getMonth()))
  return new Date(
    first.getFullYear(),
    first.getMonth(),
    day,
    d.getHours(),
    d.getMinutes(),
    d.getSeconds(),
    d.getMilliseconds(),
  )
}

/** Local midnight on the first day of that date's week. 0 = weeks start Sunday, 1 = Monday. */
export function startOfWeek(d: Date, weekStartsOn: 0 | 1 = 0): Date {
  const back = (d.getDay() - weekStartsOn + 7) % 7
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - back)
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

export function startOfYear(d: Date): Date {
  return new Date(d.getFullYear(), 0, 1)
}

export function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

export function isToday(d: Date, now: Date = new Date()): boolean {
  return sameDay(d, now)
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** Local YYYY-MM-DD — what goes in the URL so a shared link opens on the same day. */
export function toYmd(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

/**
 * Local midnight on a YYYY-MM-DD date.
 *
 * This reads the ?date= in the address bar, which anyone can type into, so
 * anything that isn't a real date (2026-02-30, "tomorrow", nothing at all)
 * quietly opens on today rather than on an Invalid Date that breaks every view.
 * new Date('2026-09-22') is deliberately avoided: it parses as UTC midnight,
 * which is the evening before anywhere in the Americas.
 */
export function fromYmd(s: string | null | undefined): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((s ?? '').trim())
  if (m) {
    const y = Number(m[1])
    const mo = Number(m[2]) - 1
    const day = Number(m[3])
    const d = new Date(y, mo, day)
    // Round-trip check: new Date() rolls Feb 30 into March rather than refusing it.
    if (d.getFullYear() === y && d.getMonth() === mo && d.getDate() === day) return d
  }
  return startOfDay(new Date())
}

// ── Grids ───────────────────────────────────────────────────────────────────

/** The seven local midnights of the week holding anchor. */
export function weekDays(anchor: Date, weekStartsOn: 0 | 1 = 0): Date[] {
  const s = startOfWeek(anchor, weekStartsOn)
  return Array.from({ length: 7 }, (_, i) => new Date(s.getFullYear(), s.getMonth(), s.getDate() + i))
}

/**
 * The month view: always 6 rows of 7 days.
 *
 * Most months fit in five rows, but a 31-day month that starts on a Saturday
 * needs six, and a grid that changes height as you page through the season
 * makes the whole screen jump under the coach's thumb. Six every time, with the
 * spill-over days from either side filled in, the way Google does it.
 */
export function monthGrid(anchor: Date, weekStartsOn: 0 | 1 = 0): Date[][] {
  const s = startOfWeek(startOfMonth(anchor), weekStartsOn)
  return Array.from({ length: 6 }, (_, row) =>
    Array.from({ length: 7 }, (_, col) => new Date(s.getFullYear(), s.getMonth(), s.getDate() + row * 7 + col)),
  )
}

/** The first of each month in anchor's year — the year view's twelve little calendars. */
export function yearMonths(anchor: Date): Date[] {
  const y = anchor.getFullYear()
  return Array.from({ length: 12 }, (_, i) => new Date(y, i, 1))
}

// ── Paging ──────────────────────────────────────────────────────────────────

/** How far the agenda looks ahead, and how far its arrows move. */
export const AGENDA_DAYS = 60
export const AGENDA_STEP = 30

/**
 * The window to fetch for a view; `to` is exclusive.
 *
 * The month view asks for its whole six-week grid, not just the month, so the
 * greyed-out days at either end show their games too instead of looking empty.
 */
export function rangeFor(view: CalView, anchor: Date, weekStartsOn: 0 | 1 = 0): { from: Date; to: Date } {
  switch (view) {
    case 'day': {
      const from = startOfDay(anchor)
      return { from, to: addDays(from, 1) }
    }
    case 'week': {
      const from = startOfWeek(anchor, weekStartsOn)
      return { from, to: addDays(from, 7) }
    }
    case 'month': {
      const from = startOfWeek(startOfMonth(anchor), weekStartsOn)
      return { from, to: addDays(from, 42) }
    }
    case 'year': {
      const from = startOfYear(anchor)
      return { from, to: new Date(from.getFullYear() + 1, 0, 1) }
    }
    case 'agenda':
    default: {
      const from = startOfDay(anchor)
      return { from, to: addDays(from, AGENDA_DAYS) }
    }
  }
}

/** Where the ‹ and › arrows take you from anchor. */
export function stepAnchor(view: CalView, anchor: Date, dir: -1 | 1): Date {
  switch (view) {
    case 'day':
      return addDays(anchor, dir)
    case 'week':
      return addDays(anchor, 7 * dir)
    case 'month':
      return addMonths(anchor, dir)
    case 'year':
      // Through addMonths so Feb 29 steps to Feb 28 instead of Mar 1.
      return addMonths(anchor, 12 * dir)
    case 'agenda':
    default:
      return addDays(anchor, AGENDA_STEP * dir)
  }
}

function shortDate(d: Date, withYear: boolean): string {
  const base = `${MONTH_SHORT[d.getMonth()]} ${d.getDate()}`
  return withYear ? `${base}, ${d.getFullYear()}` : base
}

/**
 * The heading above the grid.
 *
 * The week title says as little as it can: "Sep 20 – 26, 2026" inside one
 * month, both months when it straddles two, and both years only for the week
 * of New Year's — it has to fit beside the arrows on a phone.
 */
export function titleFor(view: CalView, anchor: Date, weekStartsOn: 0 | 1 = 0): string {
  switch (view) {
    case 'day':
      return `${WEEKDAY_NAMES[anchor.getDay()]}, ${MONTH_NAMES[anchor.getMonth()]} ${anchor.getDate()}, ${anchor.getFullYear()}`
    case 'week': {
      const days = weekDays(anchor, weekStartsOn)
      const a = days[0]
      const b = days[6]
      if (a.getFullYear() !== b.getFullYear()) return `${shortDate(a, true)} – ${shortDate(b, true)}`
      if (a.getMonth() !== b.getMonth()) return `${shortDate(a, false)} – ${shortDate(b, false)}, ${b.getFullYear()}`
      return `${shortDate(a, false)} – ${b.getDate()}, ${b.getFullYear()}`
    }
    case 'month':
      return `${MONTH_NAMES[anchor.getMonth()]} ${anchor.getFullYear()}`
    case 'year':
      return String(anchor.getFullYear())
    case 'agenda':
    default:
      return `From ${shortDate(anchor, true)}`
  }
}

// ── Items on days ───────────────────────────────────────────────────────────

/** Anything with a start and an (exclusive) end — events, games, availability. */
export type Timed = { startsAt: string; endsAt: string; allDay: boolean }

/**
 * An item's real start and end in ms, or null if either can't be read.
 *
 * A zero-length item (a deadline "at 5 PM") is given one millisecond so it
 * still counts as happening on its day and still claims a lane of its own.
 */
function span(item: Timed): { s: number; e: number } | null {
  const s = Date.parse(item.startsAt)
  const e = Date.parse(item.endsAt)
  if (Number.isNaN(s) || Number.isNaN(e)) return null
  return { s, e: Math.max(e, s + 1) }
}

/**
 * Everything that touches that local day. Ends are exclusive, so a practice
 * that finishes at midnight is not on the next day's grid, and an all-day event
 * ending at midnight after the 22nd shows on the 22nd only.
 */
export function itemsOnDay<T extends Timed>(items: T[], day: Date): T[] {
  const from = startOfDay(day).getTime()
  const to = addDays(startOfDay(day), 1).getTime()
  return items.filter((it) => {
    const sp = span(it)
    return sp !== null && sp.s < to && sp.e > from
  })
}

/** Whether an item belongs in the all-day strip rather than on the time grid. */
export function isAllDayish(item: Timed): boolean {
  if (item.allDay) return true
  const s = Date.parse(item.startsAt)
  const e = Date.parse(item.endsAt)
  // A timed thing lasting a whole day or more — a weekend tournament trip —
  // would be a solid bar down the entire column, so it goes up top instead.
  return !Number.isNaN(s) && !Number.isNaN(e) && e - s >= 24 * 60 * MINUTE_MS
}

/** Split items into the all-day strip and the time grid. */
export function splitAllDay<T extends Timed>(items: T[]): { allDay: T[]; timed: T[] } {
  const allDay: T[] = []
  const timed: T[] = []
  for (const it of items) (isAllDayish(it) ? allDay : timed).push(it)
  return { allDay, timed }
}

// ── The time grid ───────────────────────────────────────────────────────────

/** A block placed on one day's column. top/height are minutes from local midnight. */
export interface Positioned<T> {
  item: T
  top: number
  height: number
  /** Which side-by-side column the block sits in, from 0. */
  lane: number
  /** How many columns its cluster was split into. */
  lanes: number
}

/** Short enough to still show a title; the real length decides overlap. */
export const MIN_BLOCK_MINUTES = 20

/**
 * Where a day's timed blocks go, the way Google Calendar lays them out.
 *
 * Items are sorted by start, longer first on a tie so the long block takes the
 * left-hand lane. They are then grouped into clusters: runs of items that
 * overlap each other, directly or through a chain (A overlaps B, B overlaps C).
 * Each item takes the first lane in its cluster that is free by the time it
 * starts, and every item in the cluster is drawn at the cluster's full lane
 * count so their widths line up. A 4–6 practice alone gets the whole column;
 * a coach's 5–7 "unavailable" beside it makes both half-width.
 *
 * Anything that belongs in the all-day strip is left out. Blocks that start
 * the night before or run past midnight are clipped to this day.
 */
export function layoutDay<T extends Timed>(items: T[], day: Date): Positioned<T>[] {
  const dayStart = startOfDay(day)
  const dayFrom = dayStart.getTime()
  const dayTo = addDays(dayStart, 1).getTime()

  const rows: { item: T; s: number; e: number }[] = []
  for (const item of items) {
    if (isAllDayish(item)) continue
    const sp = span(item)
    if (!sp || sp.s >= dayTo || sp.e <= dayFrom) continue
    rows.push({ item, s: sp.s, e: sp.e })
  }
  rows.sort((a, b) => a.s - b.s || b.e - a.e)

  const out: Positioned<T>[] = []
  let cluster: Positioned<T>[] = []
  let laneEnds: number[] = []
  let clusterEnd = -Infinity

  const closeCluster = () => {
    for (const p of cluster) p.lanes = laneEnds.length
    cluster = []
    laneEnds = []
  }

  for (const r of rows) {
    // Nothing still running when this starts: the previous cluster is done.
    if (r.s >= clusterEnd) closeCluster()

    let lane = laneEnds.findIndex((end) => end <= r.s)
    if (lane === -1) {
      lane = laneEnds.length
      laneEnds.push(r.e)
    } else {
      laneEnds[lane] = r.e
    }
    clusterEnd = cluster.length === 0 ? r.e : Math.max(clusterEnd, r.e)

    const top = r.s <= dayFrom ? 0 : minutesInto(new Date(r.s))
    const bottom = r.e >= dayTo ? DAY_MINUTES : minutesInto(new Date(r.e))
    // On the night the clocks fall back, 1:30 comes round twice, so a short
    // block can end at a smaller clock time than it started; the floor keeps it
    // visible. It is also kept from hanging off the bottom of the grid.
    const clippedTop = Math.min(top, DAY_MINUTES - MIN_BLOCK_MINUTES)
    const height = Math.min(Math.max(bottom - top, MIN_BLOCK_MINUTES), DAY_MINUTES - clippedTop)

    const p: Positioned<T> = { item: r.item, top: clippedTop, height, lane, lanes: 1 }
    cluster.push(p)
    out.push(p)
  }
  closeCluster()
  return out
}

/** The label for a clock time on the grid: 0 → "12 AM", 810 → "1:30 PM". */
export function minutesToLabel(min: number): string {
  const m = ((Math.round(min) % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES
  const h = Math.floor(m / 60)
  const mm = m % 60
  const h12 = h % 12 === 0 ? 12 : h % 12
  const ap = h < 12 ? 'AM' : 'PM'
  return mm === 0 ? `${h12} ${ap}` : `${h12}:${pad2(mm)} ${ap}`
}

/** Round a tap or drag to the nearest step (15 minutes by default), kept on the day. */
export function snapMinutes(min: number, step = 15): number {
  const st = step > 0 ? step : 1
  const snapped = Math.round(min / st) * st
  return Math.min(DAY_MINUTES, Math.max(0, snapped))
}

/**
 * That day at a clock time, e.g. atMinutes(day, 960) is 4:00 PM.
 *
 * Built from local fields so 4:00 PM is 4:00 PM on the day the clocks change.
 * A time the clocks skip (2:30 AM in spring) comes out as 3:30 AM, and 1440 is
 * midnight at the end of the day.
 */
export function atMinutes(day: Date, minutes: number): Date {
  const m = Math.round(minutes)
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), Math.floor(m / 60), m - Math.floor(m / 60) * 60)
}

/** The clock time of a date, in minutes after midnight (4:30 PM → 990). */
export function minutesInto(d: Date): number {
  return d.getHours() * 60 + d.getMinutes()
}

// ── Words ───────────────────────────────────────────────────────────────────

function clock(d: Date): { hm: string; ap: string } {
  const h = d.getHours()
  return { hm: `${h % 12 === 0 ? 12 : h % 12}:${pad2(d.getMinutes())}`, ap: h < 12 ? 'AM' : 'PM' }
}

/**
 * When something happens, as a coach would say it.
 *
 *   "4:00 – 6:00 PM"        same day, same half of the day
 *   "11:30 AM – 1:00 PM"    across noon
 *   "All day"               a one-day all-day event
 *   "Sep 22 – 24"           an all-day event over several days
 *   "Sep 22, 4:00 PM – Sep 23, 9:00 AM"   an overnight trip
 *
 * An all-day event's end is exclusive (midnight after its last day), and a
 * timed block ending exactly at midnight still reads as one evening
 * ("10:00 PM – 12:00 AM"), not as two dates.
 */
export function formatRange(startsAt: string, endsAt: string, allDay: boolean): string {
  const s = new Date(startsAt)
  const rawEnd = new Date(endsAt)
  if (Number.isNaN(s.getTime())) return ''
  const e = Number.isNaN(rawEnd.getTime()) || rawEnd.getTime() < s.getTime() ? s : rawEnd

  if (allDay) {
    const last = e.getTime() > s.getTime() ? new Date(e.getTime() - 1) : s
    if (sameDay(s, last)) return 'All day'
    if (s.getFullYear() !== last.getFullYear()) return `${shortDate(s, true)} – ${shortDate(last, true)}`
    if (s.getMonth() !== last.getMonth()) return `${shortDate(s, false)} – ${shortDate(last, false)}`
    return `${shortDate(s, false)} – ${last.getDate()}`
  }

  const a = clock(s)
  const b = clock(e)
  const endsAtMidnightAfter = e.getTime() === addDays(startOfDay(s), 1).getTime()
  if (sameDay(s, e) || endsAtMidnightAfter) {
    if (e.getTime() === s.getTime()) return `${a.hm} ${a.ap}`
    if (a.ap === b.ap && !endsAtMidnightAfter) return `${a.hm} – ${b.hm} ${b.ap}`
    return `${a.hm} ${a.ap} – ${b.hm} ${b.ap}`
  }
  const withYear = s.getFullYear() !== e.getFullYear()
  return `${shortDate(s, withYear)}, ${a.hm} ${a.ap} – ${shortDate(e, withYear)}, ${b.hm} ${b.ap}`
}

// ── Agenda ──────────────────────────────────────────────────────────────────

/**
 * The agenda's day headings: only days with something on them, in order, each
 * with its items (all-day first, then by start). A three-day tournament shows
 * under each of its three days, the way a coach scrolling to Saturday expects.
 * `to` is exclusive.
 */
export function groupByDay<T extends Timed>(items: T[], from: Date, to: Date): { day: Date; items: T[] }[] {
  const out: { day: Date; items: T[] }[] = []
  const end = to.getTime()
  const valid = items.filter((it) => span(it) !== null)
  if (valid.length === 0) return out
  const first = startOfDay(from)
  for (let i = 0; ; i++) {
    const day = new Date(first.getFullYear(), first.getMonth(), first.getDate() + i)
    if (!(day.getTime() < end)) break
    const on = itemsOnDay(valid, day)
    if (on.length === 0) continue
    on.sort(
      (a, b) =>
        Number(isAllDayish(b)) - Number(isAllDayish(a)) || Date.parse(a.startsAt) - Date.parse(b.startsAt),
    )
    out.push({ day, items: on })
  }
  return out
}
