'use client'

import { useMemo } from 'react'
import { colorFor, type CalItem } from '@/lib/calendarModel'
import {
  AGENDA_DAYS,
  MONTH_SHORT,
  WEEKDAY_NAMES,
  addDays,
  formatRange,
  groupByDay,
  isAllDayish,
  sameDay,
  startOfDay,
} from '@/lib/calendarMath'
import { whoIsOut, timeLabel } from '@/lib/availabilityText'
import { AUDIENCE_TONE, audienceBadge, dayKey, isAvailability, itemTitle, kindMeta, surname, teamLabel, coachLabel } from './calShared'

/**
 * The next two months as a list, a day at a time.
 *
 * The best view on a phone, and the one a coach reads on the bus: every row
 * says when, what, where and who can see it, with nothing to zoom into. Staff
 * availability rides along as one line under each day's heading rather than as
 * rows of its own.
 */

type Props = {
  from: Date
  items: CalItem[]
  now: number
  canCreate: boolean
  onOpen: (item: CalItem) => void
  onOpenOut: (day: Date, items: CalItem[]) => void
  onNew: () => void
  onLater: () => void
}

export function AgendaView({ from, items, now, canCreate, onOpen, onOpenOut, onNew, onLater }: Props) {
  const days = useMemo(() => groupByDay(items, from, addDays(startOfDay(from), AGENDA_DAYS)), [items, from])
  const nowDate = now ? new Date(now) : null

  if (days.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white px-5 py-10 text-center">
        <div className="text-3xl mb-2" aria-hidden>
          🗓
        </div>
        <p className="font-bold text-gray-800">Nothing on the calendar for the next {AGENDA_DAYS} days.</p>
        <p className="text-sm text-gray-500 mt-1">
          {canCreate
            ? 'Add a team dinner, a film session or a travel day — and pick who gets to see it.'
            : 'Games, practices and team events show here as soon as they are scheduled.'}
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {canCreate && (
            <button type="button" onClick={onNew} className="btn btn-primary">
              + New event
            </button>
          )}
          <button type="button" onClick={onLater} className="btn btn-ghost">
            Look further ahead &rarr;
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      {days.map(({ day, items: onDay }, index) => {
        const events = onDay.filter((i) => !isAvailability(i))
        const avail = onDay.filter(isAvailability)
        const out = whoIsOut(avail)
        const free = avail.filter((a) => a.kind === 'available')
        const today = nowDate ? sameDay(day, nowDate) : false
        const tomorrow = nowDate ? sameDay(day, addDays(startOfDay(nowDate), 1)) : false
        return (
          <section key={dayKey(day)} className="border-b border-gray-100 last:border-b-0">
            <div
              className={`sticky top-0 z-[5] flex items-center gap-2.5 px-3 sm:px-4 py-2 bg-white/95 backdrop-blur border-b border-gray-100 ${
                index === 0 ? 'rounded-t-xl' : ''
              }`}
            >
              <span
                className="grid place-items-center w-9 h-9 rounded-full text-base font-black shrink-0"
                style={today ? { background: 'var(--gh-green)', color: '#fff' } : { background: 'var(--color-gray-100, #f3f4f6)', color: 'var(--color-gray-900, #111827)' }}
              >
                {day.getDate()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="font-black text-gray-900 truncate">
                    {WEEKDAY_NAMES[day.getDay()]}
                    <span className="font-semibold text-gray-500">
                      , {MONTH_SHORT[day.getMonth()]} {day.getDate()}
                    </span>
                  </span>
                  {(today || tomorrow) && (
                    <span
                      className="badge shrink-0"
                      style={{ background: today ? 'var(--gh-green)' : 'var(--color-gray-200, #e5e7eb)', color: today ? '#fff' : 'var(--color-gray-700, #374151)' }}
                    >
                      {today ? 'Today' : 'Tomorrow'}
                    </span>
                  )}
                </span>
                {/* Who on staff is out, on its own line so it never squeezes the date. */}
                {(out.length > 0 || free.length > 0) && (
                  <button
                    type="button"
                    onClick={() => onOpenOut(day, avail)}
                    className="block max-w-full text-left text-xs font-bold truncate rounded hover:underline"
                    style={{ color: out.length ? 'var(--gh-maroon)' : '#00512F' }}
                  >
                    {out.length
                      ? `Out: ${out.map((o) => surname(o.coachName)).join(', ')}`
                      : `Free: ${[...new Set(free.map(coachLabel))].join(', ')}`}
                  </button>
                )}
              </span>
            </div>

            {events.length === 0 ? (
              <p className="px-4 py-2.5 text-sm text-gray-400">Nothing scheduled — just staff availability.</p>
            ) : (
              <ul>
                {events.map((it) => (
                  <AgendaRow key={it.key} item={it} day={day} onOpen={onOpen} />
                ))}
              </ul>
            )}
          </section>
        )
      })}
      <div className="px-4 py-3 flex items-center justify-between gap-3 text-sm">
        <span className="text-gray-400">Showing {AGENDA_DAYS} days.</span>
        <button type="button" onClick={onLater} className="btn btn-ghost !py-1.5">
          Later &rarr;
        </button>
      </div>
    </div>
  )
}

function AgendaRow({ item, day, onOpen }: { item: CalItem; day: Date; onOpen: (item: CalItem) => void }) {
  const c = colorFor(item)
  const meta = kindMeta(item)
  const allDay = isAllDayish(item)
  const s = new Date(item.startsAt)
  const e = new Date(item.endsAt)
  const startedBefore = s < startOfDay(day)
  const tone = AUDIENCE_TONE[item.audience]

  let when: string
  let sub: string | null = null
  if (allDay) {
    when = 'All day'
    const range = formatRange(item.startsAt, item.endsAt, true)
    if (range !== 'All day') sub = range
  } else if (startedBefore) {
    when = `Until ${timeLabel(e)}`
  } else {
    when = timeLabel(s)
    sub = e > s ? `to ${sameDay(s, e) ? timeLabel(e) : formatRange(item.startsAt, item.endsAt, false)}` : null
  }

  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(item)}
        className="w-full text-left flex items-stretch gap-3 px-3 sm:px-4 py-2.5 hover:bg-gray-50 active:bg-gray-100"
      >
        <span className="w-[4.6rem] shrink-0 pt-0.5">
          <span className="block text-sm font-bold text-gray-900 leading-tight">{when}</span>
          {sub && <span className="block text-[0.7rem] text-gray-500 leading-tight mt-0.5">{sub}</span>}
        </span>
        <span aria-hidden className="w-1 rounded-full shrink-0" style={{ background: c.bg }} />
        <span className="min-w-0 flex-1">
          <span className="block font-bold text-gray-900 leading-snug break-words">
            <span aria-hidden className="mr-1">
              {meta.icon}
            </span>
            {itemTitle(item)}
            {item.result && <span className="ml-1.5 text-sm font-black text-gray-600">Final {item.result}</span>}
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500">
            {item.location && <span className="truncate max-w-full">📍 {item.location}</span>}
            <span className="font-semibold">{teamLabel(item.team)}</span>
            <span className="badge" style={{ background: tone.bg, color: tone.fg }} title="Who sees this">
              {audienceBadge(item)}
            </span>
          </span>
        </span>
      </button>
    </li>
  )
}
