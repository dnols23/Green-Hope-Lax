'use client'

import { useMemo } from 'react'
import { colorFor, type CalItem } from '@/lib/calendarModel'
import { MONTH_NAMES, MONTH_SHORT, WEEKDAY_NAMES, WEEKDAY_SHORT, addDays, isAllDayish, itemsOnDay, monthGrid, sameDay, startOfDay } from '@/lib/calendarMath'
import { whoIsOut } from '@/lib/availabilityText'
import { dayKey, gridTitle, isAvailability, isFieldTime, itemTitle, openSlotClass, openTags, shortTime } from './calShared'

/**
 * The month: six weeks, always, so the grid doesn't jump as the season pages by.
 *
 * On a laptop each day shows its first three things as chips and "+N more"
 * for the rest. On a phone a chip would be three letters wide, so each day
 * gets a row of coloured dots instead and a tap opens the day.
 *
 * Staff availability never takes a chip — a day with three coaches out would
 * have no room left for the game. It is a small "2 out" in the corner.
 */

type Props = {
  anchor: Date
  items: CalItem[]
  now: number
  narrow: boolean
  canCreate: boolean
  onOpen: (item: CalItem) => void
  onOpenOut: (day: Date, items: CalItem[]) => void
  onOpenDay: (day: Date) => void
  onCreate: (start: Date, end: Date, allDay: boolean) => void
}

const CHIPS = 3

export function MonthView({ anchor, items, now, narrow, canCreate, onOpen, onOpenOut, onOpenDay, onCreate }: Props) {
  const weeks = useMemo(() => monthGrid(anchor), [anchor])

  const byDay = useMemo(() => {
    // Real events first; open field slots after them, since they are only room to fill.
    const events = items
      .filter((i) => !isAvailability(i))
      .sort((a, b) => Number(isFieldTime(a)) - Number(isFieldTime(b)))
    const avail = items.filter(isAvailability)
    const map = new Map<string, { events: CalItem[]; avail: CalItem[]; out: number }>()
    for (const week of weeks) {
      for (const day of week) {
        const ev = itemsOnDay(events, day).sort(
          (a, b) =>
            Number(isAllDayish(b)) - Number(isAllDayish(a)) ||
            a.startsAt.localeCompare(b.startsAt) ||
            a.title.localeCompare(b.title),
        )
        const av = itemsOnDay(avail, day)
        map.set(dayKey(day), { events: ev, avail: av, out: whoIsOut(av).length })
      }
    }
    return map
  }, [items, weeks])

  const nowDate = now ? new Date(now) : null
  const month = anchor.getMonth()

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden flex flex-col" style={{ minHeight: narrow ? undefined : 'max(34rem, calc(100dvh - 18rem))' }}>
      <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50/60">
        {WEEKDAY_SHORT.map((d) => (
          <div key={d} className="py-1.5 text-center text-[0.66rem] font-black uppercase tracking-wider text-gray-500">
            {narrow ? d[0] : d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 flex-1" style={{ gridTemplateRows: 'repeat(6, minmax(0, 1fr))' }}>
        {weeks.flat().map((day, i) => {
          const k = dayKey(day)
          const info = byDay.get(k) ?? { events: [], avail: [], out: 0 }
          const inMonth = day.getMonth() === month
          const today = nowDate ? sameDay(day, nowDate) : false
          const hidden = Math.max(0, info.events.length - CHIPS)
          const freeOnly = info.out === 0 && info.avail.length > 0
          return (
            <div
              key={k}
              className={`relative min-w-0 border-gray-100 ${i % 7 ? 'border-l' : ''} ${i >= 7 ? 'border-t' : ''} ${
                inMonth ? '' : 'bg-gray-50/70'
              } ${narrow ? 'min-h-[4.25rem] cursor-pointer active:bg-gray-100' : 'min-h-[6.5rem]'} ${
                !narrow && canCreate ? 'cursor-cell' : ''
              }`}
              onClick={(e) => {
                if ((e.target as HTMLElement).closest('button')) return
                // A phone opens the day; a laptop starts an all-day event there.
                if (narrow) onOpenDay(day)
                else if (canCreate) onCreate(startOfDay(day), addDays(startOfDay(day), 1), true)
              }}
            >
              <div className={`flex items-center px-1 pt-1 ${narrow ? 'gap-0.5' : 'gap-1'}`}>
                <button
                  type="button"
                  onClick={() => onOpenDay(day)}
                  className={`grid place-items-center rounded-full font-black leading-none hover:bg-gray-100 ${
                    narrow ? 'min-w-6 h-6 px-0.5 text-[0.75rem]' : 'min-w-7 h-7 px-1 text-[0.8rem]'
                  }`}
                  style={
                    today
                      ? { background: 'var(--gh-green)', color: '#fff' }
                      : { color: inMonth ? 'var(--color-gray-900, #111827)' : 'var(--color-gray-400, #9ca3af)' }
                  }
                  aria-label={`Open ${WEEKDAY_NAMES[day.getDay()]}, ${MONTH_NAMES[day.getMonth()]} ${day.getDate()}`}
                >
                  {day.getDate() === 1 && !narrow ? `${MONTH_SHORT[day.getMonth()]} 1` : day.getDate()}
                </button>
                {(info.out > 0 || freeOnly) && (
                  <button
                    type="button"
                    onClick={() => onOpenOut(day, info.avail)}
                    className={`ml-auto rounded-full font-black hover:brightness-95 ${
                      narrow ? 'min-w-[1.05rem] h-[1.05rem] px-1 text-[0.6rem] leading-[1.05rem]' : 'px-1.5 text-[0.62rem] leading-4'
                    }`}
                    style={
                      info.out > 0
                        ? { background: '#fde8ea', color: '#7A1F2B', boxShadow: 'inset 0 0 0 1px #f3b8bf' }
                        : { background: '#e3f4ea', color: '#00512F', boxShadow: 'inset 0 0 0 1px #a9d8bd' }
                    }
                    title={info.out > 0 ? `${info.out} coach${info.out === 1 ? '' : 'es'} out` : 'Coaches offering time'}
                    aria-label={info.out > 0 ? `${info.out} coach${info.out === 1 ? '' : 'es'} out` : 'Coaches offering time'}
                  >
                    {/* On a phone the cell is a thumb wide: just the number, or a tick for "free". */}
                    {info.out > 0 ? (narrow ? info.out : `${info.out} out`) : narrow ? '✓' : 'free'}
                  </button>
                )}
              </div>

              {narrow ? (
                <div className="px-1 pt-1 space-y-[3px]" style={{ opacity: inMonth ? 1 : 0.55 }}>
                  {/* What is happening: a dot each. */}
                  {(() => {
                    const real = info.events.filter((it) => !isFieldTime(it))
                    const open = openTags(info.events.filter(isFieldTime))
                    return (
                      <>
                        {real.length > 0 && (
                          <div className="flex flex-wrap gap-[3px] px-0.5">
                            {real.slice(0, 6).map((it) => (
                              <span key={it.key} className="w-[7px] h-[7px] rounded-full" style={{ background: colorFor(it).bg }} aria-hidden />
                            ))}
                            {real.length > 6 && <span className="text-[0.55rem] font-bold text-gray-500 leading-[7px]">+</span>}
                          </div>
                        )}
                        {/* Where there is room: a small tag per place. */}
                        {open.length > 0 && (
                          <div className="flex flex-wrap gap-[2px]">
                            {open.map((t) => (
                              <span key={t.label} className={`cal-open-tag ${t.weight ? 'cal-open-tag-weight' : ''}`}>
                                {t.label}
                              </span>
                            ))}
                          </div>
                        )}
                        {info.events.length > 0 && <span className="sr-only">{info.events.length} on the calendar</span>}
                      </>
                    )
                  })()}
                </div>
              ) : (
                <div className="px-1 pb-1 pt-0.5 space-y-[2px]" style={{ opacity: inMonth ? 1 : 0.6 }}>
                  {info.events.slice(0, hidden ? CHIPS - 1 : CHIPS).map((it) => {
                    const c = colorFor(it)
                    const allDay = isAllDayish(it)
                    if (isFieldTime(it)) {
                      return (
                        <button
                          key={it.key}
                          type="button"
                          onClick={() => onOpen(it)}
                          className={`w-full flex items-center gap-1 rounded px-1 text-left text-[0.7rem] leading-[1.1rem] truncate ${openSlotClass(it)}`}
                          title={`${it.location ?? itemTitle(it)} open`}
                        >
                          <span className="shrink-0 opacity-80">{shortTime(new Date(it.startsAt))}</span>
                          <span className="truncate">{it.location ?? itemTitle(it)} open</span>
                        </button>
                      )
                    }
                    return (
                      <button
                        key={it.key}
                        type="button"
                        onClick={() => onOpen(it)}
                        className="w-full flex items-center gap-1 rounded px-1 text-left text-[0.72rem] leading-[1.15rem] truncate hover:bg-gray-100"
                        style={allDay ? { background: c.bg, color: c.fg } : undefined}
                        title={itemTitle(it)}
                      >
                        {!allDay && (
                          <span aria-hidden className="w-2 h-2 rounded-full shrink-0" style={{ background: c.bg }} />
                        )}
                        {!allDay && <span className="text-gray-500 shrink-0">{shortTime(new Date(it.startsAt))}</span>}
                        <span className={`truncate ${allDay ? 'font-bold' : 'font-semibold text-gray-800'}`}>
                          {gridTitle(it)}
                        </span>
                      </button>
                    )
                  })}
                  {hidden > 0 && (
                    <button
                      type="button"
                      onClick={() => onOpenDay(day)}
                      className="w-full text-left px-1 text-[0.72rem] font-bold text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded"
                    >
                      +{hidden + 1} more
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
