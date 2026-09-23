import Link from 'next/link'
import { formatDate, formatTime } from '@/lib/format'
import { addDaysYmd, daysBetweenYmd, ymdOf, zonedToUtc } from '@/lib/zoned'
import { CAL_EVENT_KINDS, CAL_TEAMS, colorFor, type CalItem } from '@/lib/calendarModel'

/**
 * The calendar as a plain list, a day at a time.
 *
 * This is what players, parents and the public get: no grid to learn, just
 * "here is what is coming, and when". Every time is written in Cary time, since
 * that is where the team is — a parent checking from a work trip still reads
 * "4:00 PM" as practice starting at four.
 *
 * Renders on the server. It only draws what it is handed; deciding who may see
 * what is the data layer's job (listCalendarItems with the right surface), and
 * this never goes looking for more.
 */

interface Props {
  items: CalItem[]
  /** What to say when there is nothing to show. */
  empty: string
  /** Tighter rows with no notes, for a sidebar card. */
  compact?: boolean
  /** Show at most this many items. */
  limit?: number
  /**
   * Today, as YYYY-MM-DD in the team's zone. Lets the list say "Today" and
   * "Tomorrow", and file a trip that started yesterday under today, where
   * somebody will actually look for it.
   */
  today?: string
}

// Anything longer than this folds away behind "Details", so one long note
// cannot push the rest of the week off a phone screen.
const LONG_NOTE = 140

function iconFor(item: CalItem): string {
  if (item.source === 'game') return '🥅'
  if (item.source === 'practice') return '🥍'
  if (item.source === 'availability') return item.kind === 'available' ? '✅' : '⛔'
  return CAL_EVENT_KINDS.find((k) => k.key === item.kind)?.icon ?? '📌'
}

function teamTag(item: CalItem): string | null {
  if (item.team === 'program') return null
  return CAL_TEAMS.find((t) => t.key === item.team)?.label ?? null
}

/** The date an all-day item ends on — its end is midnight after the last day. */
function lastDayOf(item: CalItem): string {
  const endYmd = ymdOf(item.endsAt)
  const startYmd = ymdOf(item.startsAt)
  const last = addDaysYmd(endYmd, -1)
  return last < startYmd ? startYmd : last
}

/** A date written for people, from a YYYY-MM-DD in the team's zone. */
function dayLabel(ymd: string, opts?: Intl.DateTimeFormatOptions): string {
  // Noon, so no clock change can tip it onto the day before or after.
  return formatDate(zonedToUtc(ymd, '12:00').toISOString(), opts)
}

function whenText(item: CalItem): string {
  if (item.allDay) {
    const last = lastDayOf(item)
    return last === ymdOf(item.startsAt) ? 'All day' : `All day · through ${dayLabel(last)}`
  }
  // A game's end is only a guess (the schedule knows when it starts, not when
  // it finishes), so do not print one.
  if (item.source === 'game') return formatTime(item.startsAt)
  const start = formatTime(item.startsAt)
  const end = formatTime(item.endsAt)
  const days = daysBetweenYmd(ymdOf(item.startsAt), ymdOf(item.endsAt))
  // Something running past midnight names the day it finishes, so an overnight
  // trip does not look like it ends before it starts.
  if (days > 0) return `${start} – ${dayLabel(ymdOf(item.endsAt), { month: undefined, day: undefined })} ${end}`
  return start === end ? start : `${start} – ${end}`
}

function headingFor(ymd: string, today?: string): string {
  const full = dayLabel(ymd, { weekday: 'long', month: 'long', day: 'numeric' })
  if (!today) return full
  const diff = daysBetweenYmd(today, ymd)
  if (diff === 0) return `Today · ${full}`
  if (diff === 1) return `Tomorrow · ${full}`
  return full
}

export function UpcomingList({ items, empty, compact = false, limit, today }: Props) {
  const shown = typeof limit === 'number' ? items.slice(0, Math.max(0, limit)) : items
  if (shown.length === 0) {
    return <p className="text-sm text-gray-500">{empty}</p>
  }

  // Group by the day each thing starts. Something already under way when the
  // list begins — the second day of a tournament — sits under today.
  const groups: { ymd: string; items: CalItem[] }[] = []
  for (const item of shown) {
    let ymd = ymdOf(item.startsAt)
    if (today && ymd < today) ymd = today
    const last = groups[groups.length - 1]
    if (last && last.ymd === ymd) last.items.push(item)
    else groups.push({ ymd, items: [item] })
  }

  return (
    <div className={compact ? 'space-y-3' : 'space-y-6'}>
      {groups.map((g) => (
        <section key={g.ymd}>
          <h3
            className={
              compact
                ? 'text-xs font-bold text-gray-500 mb-1.5'
                : 'text-sm font-black text-gray-700 mb-2 pb-1 border-b border-gray-200'
            }
          >
            {headingFor(g.ymd, today)}
          </h3>
          <ul className={compact ? 'space-y-2' : 'space-y-2.5'}>
            {g.items.map((item) => (
              <UpcomingRow key={item.key} item={item} compact={compact} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

function UpcomingRow({ item, compact }: { item: CalItem; compact: boolean }) {
  const color = colorFor(item)
  const tag = teamTag(item)
  const notes = compact ? null : item.notes?.trim() || null
  const longNotes = !!notes && (notes.length > LONG_NOTE || notes.includes('\n'))

  const title = (
    <span className="font-semibold leading-snug break-words">
      <span aria-hidden className="mr-1">{iconFor(item)}</span>
      {item.title}
    </span>
  )

  return (
    <li
      className={compact ? 'text-sm pl-2.5' : 'bg-white rounded-lg border border-gray-200 text-sm pl-3 pr-3 py-2.5'}
      style={{ borderLeft: `4px solid ${color.bg}` }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {item.href ? (
            <Link href={item.href} className="hover:underline">
              {title}
            </Link>
          ) : (
            title
          )}
          <div className="text-gray-500 mt-0.5">
            {whenText(item)}
            {item.location ? ` · ${item.location}` : ''}
          </div>
        </div>
        {(tag || item.result) && (
          <div className="flex flex-col items-end gap-1 shrink-0">
            {item.result && <span className="badge badge-sched">{item.result}</span>}
            {tag && !compact && <span className="badge badge-sched">{tag}</span>}
          </div>
        )}
      </div>
      {notes &&
        (longNotes ? (
          <details className="mt-1.5">
            <summary className="cursor-pointer text-xs font-bold" style={{ color: 'var(--gh-green)' }}>
              Details
            </summary>
            <p className="mt-1 text-gray-600 whitespace-pre-line break-words">{notes}</p>
          </details>
        ) : (
          <p className="mt-1 text-gray-600 break-words">{notes}</p>
        ))}
    </li>
  )
}
