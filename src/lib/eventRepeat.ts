// Repeating an event: which days it lands on. Pure, and on calendar dates only
// (YYYY-MM-DD), so the editor's count and the server's save agree.

/** At most this many events in one series — a season of practices, with room. */
export const MAX_REPEATS = 200
/** And never further out than this. */
export const MAX_REPEAT_DAYS = 400

export interface Repeat {
  /** Weekdays, 0 = Sunday. */
  days: number[]
  /** Last day it can land on, YYYY-MM-DD, inclusive. */
  until: string
}

const pad = (n: number) => String(n).padStart(2, '0')
const utc = (ymd: string) => {
  const [y, m, d] = ymd.split('-').map(Number)
  return Date.UTC(y, (m || 1) - 1, d || 1)
}
const ymdOfUtc = (t: number) => {
  const d = new Date(t)
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

export const weekdayOf = (ymd: string) => new Date(utc(ymd)).getUTCDay()

export function readRepeat(raw: unknown): Repeat | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const days = Array.isArray(r.days)
    ? [...new Set(r.days.filter((d): d is number => Number.isInteger(d) && d >= 0 && d <= 6))].sort()
    : []
  const until = typeof r.until === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.until) ? r.until : ''
  return days.length && until ? { days, until } : null
}

/** Every day the series lands on, starting with the first event's own day. */
export function repeatDates(firstYmd: string, r: Repeat): string[] {
  const out = [firstYmd]
  const start = utc(firstYmd)
  const last = Math.min(utc(r.until), start + MAX_REPEAT_DAYS * 86_400_000)
  for (let t = start + 86_400_000; t <= last && out.length < MAX_REPEATS; t += 86_400_000) {
    if (r.days.includes(new Date(t).getUTCDay())) out.push(ymdOfUtc(t))
  }
  return out
}
