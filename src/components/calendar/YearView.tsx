'use client'

import { useEffect, useMemo, useRef } from 'react'
import type { CalItem } from '@/lib/calendarModel'
import { MONTH_NAMES, WEEKDAY_SHORT, addDays, monthGrid, sameDay, startOfDay, yearMonths } from '@/lib/calendarMath'
import { dayKey, isAvailability, isFieldTime } from './calShared'

/**
 * The season at a glance: twelve little months.
 *
 * Each day is shaded by how much is on it, and a game day carries a maroon
 * dot, so the head coach can see in one look where the busy stretches are and
 * where a team dinner or a film night still fits. A tap opens the day.
 */

export type DayLoad = Map<string, { count: number; game: boolean; out: boolean }>

/** How busy each day is, from a set of items. Availability isn't "busy". */
export function dayLoad(items: CalItem[], from: Date, to: Date): DayLoad {
  const load: DayLoad = new Map()
  const fromMs = from.getTime()
  const toMs = to.getTime()
  for (const it of items) {
    const s = Math.max(Date.parse(it.startsAt), fromMs)
    const e = Math.min(Math.max(Date.parse(it.endsAt), Date.parse(it.startsAt) + 1), toMs)
    if (Number.isNaN(s) || Number.isNaN(e) || e <= s) continue
    // Walk the local days it touches; ends are exclusive.
    for (let d = startOfDay(new Date(s)); d.getTime() < e; d = addDays(d, 1)) {
      const k = dayKey(d)
      const cur = load.get(k) ?? { count: 0, game: false, out: false }
      if (isAvailability(it)) {
        if (it.kind === 'unavailable') cur.out = true
      } else if (!isFieldTime(it)) {
        cur.count += 1
        if (it.source === 'game') cur.game = true
      }
      load.set(k, cur)
    }
  }
  return load
}

const SHADES = ['transparent', '#e3f1e9', '#b9dcc8', '#86c2a1']

/** One small month — the year view's building block, and the Day view's date picker. */
export function MiniMonth({
  month,
  load,
  now,
  selected,
  onPickDay,
  onPickMonth,
}: {
  month: Date
  load: DayLoad
  now: number
  selected?: Date
  onPickDay: (day: Date) => void
  onPickMonth?: (month: Date) => void
}) {
  const weeks = useMemo(() => monthGrid(month), [month])
  const nowDate = now ? new Date(now) : null
  return (
    <div className="min-w-0">
      {onPickMonth ? (
        <button
          type="button"
          onClick={() => onPickMonth(month)}
          className="mb-1 text-sm font-black text-gray-900 hover:text-[var(--gh-green)]"
        >
          {MONTH_NAMES[month.getMonth()]}
        </button>
      ) : (
        <div className="mb-1 text-sm font-black text-gray-900">
          {MONTH_NAMES[month.getMonth()]} {month.getFullYear()}
        </div>
      )}
      <div className="grid grid-cols-7 gap-y-0.5 text-center">
        {WEEKDAY_SHORT.map((d) => (
          <div key={d} className="text-[0.6rem] font-bold text-gray-400 leading-5">
            {d[0]}
          </div>
        ))}
        {weeks.flat().map((day) => {
          const inMonth = day.getMonth() === month.getMonth()
          if (!inMonth) return <div key={dayKey(day)} className="h-7" aria-hidden />
          const info = load.get(dayKey(day))
          const today = nowDate ? sameDay(day, nowDate) : false
          const picked = selected ? sameDay(day, selected) : false
          const shade = SHADES[Math.min(info?.count ?? 0, 3)]
          return (
            <button
              key={dayKey(day)}
              type="button"
              onClick={() => onPickDay(day)}
              className="relative h-7 grid place-items-center rounded-md text-[0.7rem] font-semibold hover:ring-1 hover:ring-gray-300"
              style={{
                background: picked ? 'var(--color-gray-900, #111827)' : shade,
                color: picked ? '#fff' : today ? 'var(--gh-green)' : 'var(--color-gray-700, #374151)',
                boxShadow: today && !picked ? 'inset 0 0 0 2px var(--gh-green)' : undefined,
                fontWeight: today || picked ? 900 : undefined,
              }}
              aria-label={`${MONTH_NAMES[day.getMonth()]} ${day.getDate()}${info?.count ? `, ${info.count} on the calendar` : ''}${info?.game ? ', game day' : ''}`}
            >
              {day.getDate()}
              {info?.game && (
                <span aria-hidden className="absolute bottom-[3px] left-1/2 -translate-x-1/2 w-1 h-1 rounded-full" style={{ background: '#7A1F2B' }} />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function YearView({
  anchor,
  items,
  now,
  onPickDay,
  onPickMonth,
}: {
  anchor: Date
  items: CalItem[]
  now: number
  onPickDay: (day: Date) => void
  onPickMonth: (month: Date) => void
}) {
  const months = useMemo(() => yearMonths(anchor), [anchor])
  const load = useMemo(
    () => dayLoad(items, months[0], new Date(months[0].getFullYear() + 1, 0, 1)),
    [items, months],
  )
  const games = useMemo(() => [...load.values()].filter((v) => v.game).length, [load])

  // In September a phone would open on January; bring the month you're on into
  // view instead, if it's below the fold.
  const current = useRef<HTMLDivElement>(null)
  const focusMonth = anchor.getMonth()
  useEffect(() => {
    const el = current.current
    if (!el || el.getBoundingClientRect().top < window.innerHeight - 80) return
    el.scrollIntoView({ block: 'start' })
  }, [focusMonth])

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 sm:p-5">
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-x-4 sm:gap-x-8 gap-y-6">
        {months.map((m) => (
          <div key={m.getMonth()} ref={m.getMonth() === focusMonth ? current : undefined} className="min-w-0 scroll-mt-20">
            <MiniMonth month={m} load={load} now={now} onPickDay={onPickDay} onPickMonth={onPickMonth} />
          </div>
        ))}
      </div>
      <div className="mt-5 pt-3 border-t border-gray-100 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-500">
        <span className="inline-flex items-center gap-1.5">
          Quiet
          {SHADES.slice(1).map((s) => (
            <span key={s} aria-hidden className="w-3.5 h-3.5 rounded" style={{ background: s }} />
          ))}
          Busy
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="w-1.5 h-1.5 rounded-full" style={{ background: '#7A1F2B' }} />
          Game day{games ? ` (${games})` : ''}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="w-3.5 h-3.5 rounded" style={{ boxShadow: 'inset 0 0 0 2px var(--gh-green)' }} />
          Today
        </span>
      </div>
    </div>
  )
}
