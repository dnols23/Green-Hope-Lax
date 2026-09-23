// Wall-clock time in the team's own time zone.
//
// The server runs in UTC and the program runs in Cary. A practice "at four" is
// four o'clock in North Carolina whatever the server thinks, and a weekly
// availability block "Tuesdays four to six" stays four to six across the
// daylight-saving change rather than sliding an hour. Everything that turns a
// date and a clock time into an instant, or back, goes through here.
//
// Pure: Intl only, no server imports.

import { TEAM_TIME_ZONE } from './format'

export interface ZoneParts {
  y: number
  m: number
  d: number
  h: number
  mi: number
  /** 0 = Sunday … 6 = Saturday */
  weekday: number
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** The wall-clock parts of an instant, as seen in a zone. */
export function zoneParts(instant: Date | string | number, zone = TEAM_TIME_ZONE): ZoneParts {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
  })
  const p = Object.fromEntries(dtf.formatToParts(new Date(instant)).map((x) => [x.type, x.value]))
  return {
    y: Number(p.year),
    m: Number(p.month),
    d: Number(p.day),
    h: Number(p.hour) % 24,
    mi: Number(p.minute),
    weekday: WEEKDAYS.indexOf(String(p.weekday)),
  }
}

function offsetMs(instant: number, zone: string): number {
  const z = zoneParts(instant, zone)
  const asUtc = Date.UTC(z.y, z.m - 1, z.d, z.h, z.mi)
  // Seconds are dropped on both sides, so compare at minute precision.
  return asUtc - Math.floor(instant / 60000) * 60000
}

/**
 * The instant a wall-clock time happens in a zone.
 *
 * `zonedToUtc('2027-03-16', '16:00')` is four in the afternoon in Cary on that
 * date, whichever side of the clock change it falls.
 */
export function zonedToUtc(ymd: string, hm = '00:00', zone = TEAM_TIME_ZONE): Date {
  const [y, m, d] = ymd.split('-').map(Number)
  const [h, mi] = hm.split(':').map(Number)
  const guess = Date.UTC(y, (m || 1) - 1, d || 1, h || 0, mi || 0)
  let t = guess - offsetMs(guess, zone)
  // Once more, in case the first guess landed on the other side of a change.
  t = guess - offsetMs(t, zone)
  return new Date(t)
}

const pad = (n: number) => String(n).padStart(2, '0')

/** YYYY-MM-DD of an instant, in a zone. */
export function ymdOf(instant: Date | string | number, zone = TEAM_TIME_ZONE): string {
  const z = zoneParts(instant, zone)
  return `${z.y}-${pad(z.m)}-${pad(z.d)}`
}

/** HH:MM of an instant, in a zone. */
export function hmOf(instant: Date | string | number, zone = TEAM_TIME_ZONE): string {
  const z = zoneParts(instant, zone)
  return `${pad(z.h)}:${pad(z.mi)}`
}

/** A calendar date moved by whole days, with no time zone involved at all. */
export function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d + days))
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`
}

/** Whole days from one calendar date to another. */
export function daysBetweenYmd(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number)
  const [by, bm, bd] = b.split('-').map(Number)
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000)
}
