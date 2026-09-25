'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { colorFor, type CalItem } from '@/lib/calendarModel'
import {
  WEEKDAY_SHORT,
  addDays,
  atMinutes,
  formatRange,
  isAllDayish,
  itemsOnDay,
  layoutDay,
  minutesInto,
  minutesToLabel,
  sameDay,
  snapMinutes,
  startOfDay,
  type Positioned,
} from '@/lib/calendarMath'
import { whoIsOut } from '@/lib/availabilityText'
import { HOUR_PX, MIN_PX, SCROLL_TO_HOUR, dayKey, isAvailability, isFieldTime, itemTitle, openSlotClass, gridTitle, shortTime, surname, coachLabel } from './calShared'

/**
 * The day and week views: a 24-hour grid, one column per day.
 *
 * Built by hand rather than from a library so it can do the three things a
 * coach actually does on a calendar the way Google does them — drag across
 * empty time to make something, drag a block to move it, drag its bottom edge
 * to change how long it runs — and nothing else.
 *
 * Staff availability is drawn so it never fights the events for room. An "out"
 * is a thin hatched strip down the right edge of the day, the same height as
 * the time it covers, and the day's heading says who: "Out: Rutledge, Little".
 * The practice keeps the whole width of its column; the head coach still sees
 * at a glance that two assistants can't make it.
 *
 * On a phone, the week scrolls sideways with the hour labels pinned, and a tap
 * on an empty slot starts an event there. Dragging is for a mouse: on a touch
 * screen a drag has to scroll the grid, and a coach scrolling to Thursday must
 * never pick up Tuesday's practice by accident.
 */

type Props = {
  days: Date[]
  items: CalItem[]
  /** Now, to the minute, in ms. */
  now: number
  /** Whether this coach may put things on the calendar. */
  canCreate: boolean
  onOpen: (item: CalItem) => void
  onOpenOut: (day: Date, items: CalItem[]) => void
  onCreate: (start: Date, end: Date, allDay: boolean) => void
  onMove: (item: CalItem, startsAt: Date, endsAt: Date) => void
  /** A day heading was tapped — the week view uses it to open that day. */
  onPickDay?: (day: Date) => void
}

/** The time labels down the left. */
const GUTTER = 52
/** Room kept down the right of each day for the availability strips. */
const STRIP_W = 11
/** A week column is never narrower than this; a phone scrolls sideways instead. */
const MIN_COL = 104
const DAY_MIN = 1440
const BAND_ROW = 24
const BAND_ROWS_SHUT = 3

type Drag =
  | { mode: 'create'; col: number; from: number; to: number }
  | { mode: 'move'; item: CalItem; col: number; top: number; height: number }
  | { mode: 'resize'; item: CalItem; col: number; top: number; height: number }

interface Session {
  mode: Drag['mode']
  item?: CalItem
  x0: number
  y0: number
  moved: boolean
  touch: boolean
  col: number
  /** create: where the drag started, in minutes. move: how far into the block it was grabbed. */
  grab: number
  /** move/resize: the block's own top and height, in minutes. */
  top: number
  height: number
  durMs: number
  cleanup: () => void
}

const editableEvent = (it: CalItem) => it.source === 'event' && it.editable

export function TimeGrid({ days, items, now, canCreate, onOpen, onOpenOut, onCreate, onMove, onPickDay }: Props) {
  const n = days.length
  const week = n > 1
  const scroller = useRef<HTMLDivElement>(null)
  const cols = useRef<HTMLDivElement>(null)
  const session = useRef<Session | null>(null)
  const suppressClick = useRef(false)
  const [drag, setDrag] = useState<Drag | null>(null)
  const [bandOpen, setBandOpen] = useState(false)

  // Open on the morning, not on 2 AM.
  // On a phone the week is wider than the screen, so bring today's column
  // (when it is in this week) to the left edge rather than always opening on Sunday.
  useEffect(() => {
    const el = scroller.current
    if (!el) return
    el.scrollTop = SCROLL_TO_HOUR * HOUR_PX - 6
    const today = new Date()
    const idx = days.findIndex((d) => sameDay(d, today))
    const r = cols.current?.getBoundingClientRect()
    if (idx > 0 && r && r.width > el.clientWidth - GUTTER) el.scrollLeft = (r.width / days.length) * idx
    // Only on first show: paging keeps wherever the coach had scrolled to.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // A drag left half-done (the grid swapped out from under it) cleans up after itself.
  useEffect(() => () => session.current?.cleanup(), [])

  // ── What goes where ──────────────────────────────────────────────────────

  const layout = useMemo(() => {
    const events = items.filter((i) => !isAvailability(i) && !isFieldTime(i))
    const avail = items.filter(isAvailability)
    const fieldTimes = items.filter(isFieldTime)
    const bandItems = events.filter(isAllDayish)
    const timed = events.filter((i) => !isAllDayish(i))

    const perDay = days.map((day) => {
      const dayStart = startOfDay(day).getTime()
      const dayEnd = addDays(startOfDay(day), 1).getTime()
      const availToday = itemsOnDay(avail, day)
      // Every availability block, all-day or not, becomes a strip the height of
      // the part of the day it covers. Clipped a minute short of midnight so
      // the layout treats it as timed rather than sending it up top.
      const strips = layoutDay(
        availToday.map((item) => ({
          item,
          startsAt: new Date(Math.max(Date.parse(item.startsAt), dayStart)).toISOString(),
          endsAt: new Date(Math.min(Date.parse(item.endsAt), dayEnd - 60_000)).toISOString(),
          allDay: false,
        })),
        day,
      )
      return {
        day,
        blocks: layoutDay(timed, day),
        // Open field time sits underneath, side by side only with other open slots.
        fields: layoutDay(fieldTimes, day),
        strips,
        availToday,
        out: whoIsOut(availToday),
        free: availToday.filter((a) => a.kind === 'available'),
      }
    })

    // All-day things across the top, each one a single bar however many days
    // it runs, packed into as few rows as they fit.
    const rows: number[] = []
    const bars = bandItems
      .map((item) => {
        let first = -1
        let last = -1
        days.forEach((d, i) => {
          if (itemsOnDay([item], d).length) {
            if (first < 0) first = i
            last = i
          }
        })
        return { item, first, last }
      })
      .filter((b) => b.first >= 0)
      .sort((a, b) => a.first - b.first || b.last - b.first - (a.last - a.first))
      .map((b) => {
        let row = rows.findIndex((end) => end < b.first)
        if (row < 0) {
          row = rows.length
          rows.push(b.last)
        } else rows[row] = b.last
        return { ...b, row }
      })
    return { perDay, bars, bandRows: rows.length }
  }, [items, days])

  const { perDay, bars, bandRows } = layout
  const shownRows = bandOpen ? bandRows : Math.min(bandRows, BAND_ROWS_SHUT)
  const hiddenPerDay = days.map((_, i) => bars.filter((b) => b.row >= shownRows && b.first <= i && b.last >= i).length)
  const anyHidden = hiddenPerDay.some((h) => h > 0)
  const bandHeight = Math.max(1, shownRows + (anyHidden ? 1 : 0)) * BAND_ROW + 6

  // ── Pointer work ─────────────────────────────────────────────────────────

  function locate(clientX: number, clientY: number): { col: number; min: number } {
    const r = cols.current?.getBoundingClientRect()
    if (!r) return { col: 0, min: 0 }
    const col = Math.min(n - 1, Math.max(0, Math.floor(((clientX - r.left) / r.width) * n)))
    return { col, min: (clientY - r.top) / MIN_PX }
  }

  /** Nudge the grid when a drag reaches its top or bottom edge. */
  function edgeScroll(clientY: number) {
    const el = scroller.current
    if (!el) return
    const r = el.getBoundingClientRect()
    if (clientY > r.bottom - 36) el.scrollTop += 14
    else if (clientY < r.top + 36 + bandHeight + 56) el.scrollTop -= 14
  }

  function begin(e: React.PointerEvent, s: Omit<Session, 'cleanup' | 'x0' | 'y0' | 'moved' | 'touch'>) {
    const touch = e.pointerType === 'touch'
    const onMoveEvt = (ev: PointerEvent) => step(ev)
    const onUp = (ev: PointerEvent) => finish(ev)
    const onCancel = () => abort()
    const cleanup = () => {
      window.removeEventListener('pointermove', onMoveEvt)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
    }
    session.current?.cleanup()
    session.current = { ...s, x0: e.clientX, y0: e.clientY, moved: false, touch, cleanup }
    window.addEventListener('pointermove', onMoveEvt)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
  }

  function step(ev: PointerEvent) {
    const s = session.current
    if (!s) return
    // A touch never drags here — the finger is scrolling the grid.
    if (s.touch) {
      if (Math.abs(ev.clientX - s.x0) > 8 || Math.abs(ev.clientY - s.y0) > 8) abort()
      return
    }
    if (!s.moved && Math.abs(ev.clientX - s.x0) < 4 && Math.abs(ev.clientY - s.y0) < 4) return
    s.moved = true
    edgeScroll(ev.clientY)
    const { col, min } = locate(ev.clientX, ev.clientY)
    if (s.mode === 'create') {
      const a = snapMinutes(s.grab)
      const b = snapMinutes(min)
      setDrag({ mode: 'create', col: s.col, from: Math.min(a, b), to: Math.max(a, b, Math.min(a, b) + 15) })
    } else if (s.mode === 'move' && s.item) {
      const top = Math.min(DAY_MIN - 15, Math.max(0, snapMinutes(min - s.grab)))
      setDrag({ mode: 'move', item: s.item, col: week ? col : s.col, top, height: s.height })
    } else if (s.mode === 'resize' && s.item) {
      const end = Math.max(s.top + 15, Math.min(DAY_MIN, snapMinutes(min)))
      setDrag({ mode: 'resize', item: s.item, col: s.col, top: s.top, height: end - s.top })
    }
  }

  function abort() {
    session.current?.cleanup()
    session.current = null
    setDrag(null)
  }

  function finish(ev: PointerEvent) {
    const s = session.current
    if (!s) return
    s.cleanup()
    session.current = null
    setDrag(null)
    const { col, min } = locate(ev.clientX, ev.clientY)

    if (s.mode === 'create') {
      const day = days[s.col]
      if (!s.moved) {
        // A tap or a click: an hour, from the half-hour tapped.
        const from = Math.min(DAY_MIN - 60, Math.floor(s.grab / 30) * 30)
        onCreate(atMinutes(day, from), atMinutes(day, from + 60), false)
        return
      }
      const a = snapMinutes(s.grab)
      const b = snapMinutes(min)
      const from = Math.min(a, b)
      const to = Math.max(a, b, from + 15)
      onCreate(atMinutes(day, from), atMinutes(day, Math.min(DAY_MIN, to)), false)
      return
    }

    if (!s.item || !s.moved) return
    suppressClick.current = true
    // The click that follows a pointerup lands wherever the block ended up;
    // swallow it, then stop swallowing in case it never comes.
    window.setTimeout(() => {
      suppressClick.current = false
    }, 0)

    if (s.mode === 'move') {
      const top = Math.min(DAY_MIN - 15, Math.max(0, snapMinutes(min - s.grab)))
      const target = days[week ? col : s.col]
      const start = atMinutes(target, top)
      const end = new Date(start.getTime() + s.durMs)
      if (start.getTime() !== Date.parse(s.item.startsAt)) onMove(s.item, start, end)
    } else {
      const end = Math.max(s.top + 15, Math.min(DAY_MIN, snapMinutes(min)))
      const start = new Date(s.item.startsAt)
      const endAt = atMinutes(days[s.col], end)
      if (endAt.getTime() !== Date.parse(s.item.endsAt)) onMove(s.item, start, endAt)
    }
  }

  function onColumnDown(e: React.PointerEvent, col: number) {
    if (!canCreate || e.button !== 0) return
    if ((e.target as HTMLElement).closest('[data-block]')) return
    const { min } = locate(e.clientX, e.clientY)
    if (e.pointerType !== 'touch') e.preventDefault()
    begin(e, { mode: 'create', col, grab: min, top: 0, height: 0, durMs: 0 })
  }

  function onBlockDown(e: React.PointerEvent, p: Positioned<CalItem>, col: number, resize: boolean) {
    if (e.pointerType === 'touch' || e.button !== 0 || !editableEvent(p.item)) return
    const day = days[col]
    const s = Date.parse(p.item.startsAt)
    const eMs = Date.parse(p.item.endsAt)
    // Only a block that sits wholly on this day can be picked up; one that ran
    // over from last night is changed in the editor instead.
    const dayStart = startOfDay(day).getTime()
    const dayEnd = addDays(startOfDay(day), 1).getTime()
    if (s < dayStart || eMs > dayEnd) return
    e.stopPropagation()
    e.preventDefault()
    const { min } = locate(e.clientX, e.clientY)
    begin(e, {
      mode: resize ? 'resize' : 'move',
      item: p.item,
      col,
      grab: min - p.top,
      top: p.top,
      height: p.height,
      durMs: eMs - s,
    })
  }

  function click(item: CalItem) {
    if (suppressClick.current) return
    onOpen(item)
  }

  // ── Drawing ──────────────────────────────────────────────────────────────

  const nowDate = now ? new Date(now) : null
  const template = `${GUTTER}px minmax(0, 1fr)`
  const inner = `repeat(${n}, minmax(0, 1fr))`

  return (
    <div
      ref={scroller}
      className="relative overflow-auto overscroll-contain rounded-xl border border-gray-200 bg-white select-none"
      style={{ height: 'max(26rem, calc(100dvh - 18rem))' }}
    >
      <div style={{ minWidth: week ? GUTTER + n * MIN_COL : undefined }}>
        {/* ── Header: the days, who's out, and the all-day band ── */}
        <div className="sticky top-0 z-20 bg-white border-b border-gray-200" style={{ display: 'grid', gridTemplateColumns: template }}>
          <div className="sticky left-0 z-10 bg-white" />
          <div style={{ display: 'grid', gridTemplateColumns: inner }}>
            {perDay.map(({ day, out, free, availToday }) => {
              const today = nowDate ? sameDay(day, nowDate) : false
              const names = out.map((o) => surname(o.coachName))
              return (
                <div key={dayKey(day)} className={`min-w-0 px-1.5 pt-2 pb-1 ${week ? 'border-l border-gray-100' : ''}`}>
                  <button
                    type="button"
                    onClick={() => onPickDay?.(day)}
                    disabled={!onPickDay}
                    className={`flex items-center gap-1.5 rounded-lg px-1 -mx-1 ${onPickDay ? 'hover:bg-gray-50' : 'cursor-default'}`}
                    aria-label={`Open ${WEEKDAY_SHORT[day.getDay()]} ${day.getDate()}`}
                  >
                    <span
                      className="text-[0.68rem] font-black uppercase tracking-wider"
                      style={{ color: today ? 'var(--gh-green)' : 'var(--color-gray-500, #6b7280)' }}
                    >
                      {WEEKDAY_SHORT[day.getDay()]}
                    </span>
                    <span
                      className="grid place-items-center w-8 h-8 rounded-full text-lg font-black leading-none"
                      style={today ? { background: 'var(--gh-green)', color: '#fff' } : { color: 'var(--color-gray-900, #111827)' }}
                    >
                      {day.getDate()}
                    </span>
                  </button>
                  {/* Who's out, in a line that fits a column. */}
                  <button
                    type="button"
                    onClick={() => onOpenOut(day, availToday)}
                    disabled={availToday.length === 0}
                    className="block w-full text-left text-[0.7rem] leading-4 font-bold truncate min-h-4 rounded disabled:cursor-default"
                    title={availToday.length ? 'Who’s out and who’s free' : undefined}
                  >
                    {names.length > 0 ? (
                      <span style={{ color: 'var(--gh-maroon)' }}>Out: {names.join(', ')}</span>
                    ) : free.length > 0 ? (
                      <span style={{ color: '#00512F' }}>Free: {[...new Set(free.map(coachLabel))].join(', ')}</span>
                    ) : (
                      <span aria-hidden>&nbsp;</span>
                    )}
                  </button>
                </div>
              )
            })}
          </div>

          {/* All-day band */}
          <div className="sticky left-0 z-10 bg-white flex flex-col items-end justify-start pr-1.5 pt-1 border-t border-gray-100">
            <span className="text-[0.62rem] font-bold text-gray-400 whitespace-nowrap leading-5">All day</span>
            {bandRows > BAND_ROWS_SHUT && (
              <button
                type="button"
                onClick={() => setBandOpen(!bandOpen)}
                className="text-[0.65rem] font-bold text-gray-500 hover:text-gray-900"
                aria-expanded={bandOpen}
              >
                {bandOpen ? 'Less ▴' : 'More ▾'}
              </button>
            )}
          </div>
          <div
            className="relative border-t border-gray-100"
            style={{ height: bandHeight, display: 'grid', gridTemplateColumns: inner, gridAutoRows: BAND_ROW, paddingTop: 3 }}
            onDoubleClick={(e) => {
              if (!canCreate) return
              const { col } = locate(e.clientX, e.clientY)
              onCreate(startOfDay(days[col]), addDays(startOfDay(days[col]), 1), true)
            }}
          >
            {bars
              .filter((b) => b.row < shownRows)
              .map((b) => {
                const c = colorFor(b.item)
                return (
                  <button
                    key={b.item.key}
                    type="button"
                    data-block
                    onClick={() => onOpen(b.item)}
                    className="mx-0.5 mb-0.5 rounded-md px-1.5 text-left text-[0.72rem] font-bold truncate hover:brightness-95"
                    style={{
                      gridColumn: `${b.first + 1} / ${b.last + 2}`,
                      gridRow: b.row + 1,
                      background: c.bg,
                      color: c.fg,
                    }}
                    title={`${itemTitle(b.item)} · ${formatRange(b.item.startsAt, b.item.endsAt, true)}`}
                  >
                    {gridTitle(b.item)}
                  </button>
                )
              })}
            {anyHidden &&
              hiddenPerDay.map((h, i) =>
                h > 0 ? (
                  <button
                    key={`more-${i}`}
                    type="button"
                    onClick={() => setBandOpen(true)}
                    className="mx-0.5 text-left px-1.5 text-[0.7rem] font-bold text-gray-500 hover:text-gray-900"
                    style={{ gridColumn: `${i + 1} / ${i + 2}`, gridRow: shownRows + 1 }}
                  >
                    +{h} more
                  </button>
                ) : null,
              )}
            {week &&
              days.map((d, i) => (
                <span
                  key={`sep-${dayKey(d)}`}
                  aria-hidden
                  className="absolute top-0 bottom-0 border-l border-gray-100 pointer-events-none"
                  style={{ left: `${(i / n) * 100}%` }}
                />
              ))}
          </div>
        </div>

        {/* ── Body: hours down the side, a column per day ── */}
        <div style={{ display: 'grid', gridTemplateColumns: template }}>
          <div className="sticky left-0 z-10 bg-white relative" style={{ height: 24 * HOUR_PX }}>
            {Array.from({ length: 23 }, (_, i) => i + 1).map((h) => (
              <span
                key={h}
                className="absolute right-2 text-[0.66rem] font-semibold text-gray-400 -translate-y-1/2 whitespace-nowrap"
                style={{ top: h * HOUR_PX }}
              >
                {minutesToLabel(h * 60)}
              </span>
            ))}
          </div>

          <div
            ref={cols}
            className="relative"
            style={{
              display: 'grid',
              gridTemplateColumns: inner,
              height: 24 * HOUR_PX,
              backgroundImage:
                'linear-gradient(to bottom, var(--color-gray-200, #eceeec) 1px, transparent 1px), linear-gradient(to bottom, var(--color-gray-100, #f6f7f6) 1px, transparent 1px)',
              backgroundSize: `100% ${HOUR_PX}px, 100% ${HOUR_PX}px`,
              backgroundPosition: `0 0, 0 ${HOUR_PX / 2}px`,
            }}
          >
            {perDay.map(({ day, blocks, fields, strips }, col) => {
              const today = nowDate ? sameDay(day, nowDate) : false
              return (
                <div
                  key={dayKey(day)}
                  className={`relative min-w-0 ${week ? 'border-l border-gray-100' : ''} ${canCreate ? 'cursor-crosshair sm:cursor-cell' : ''}`}
                  style={{ background: today && week ? 'rgba(0,105,62,0.025)' : undefined }}
                  onPointerDown={(e) => onColumnDown(e, col)}
                >
                  {/* Availability strips down the right edge. */}
                  {strips.map((p) => {
                    const it = p.item.item
                    const out = it.kind === 'unavailable'
                    const w = STRIP_W / p.lanes
                    return (
                      <button
                        key={`${it.key}-strip`}
                        type="button"
                        data-block
                        onClick={() => onOpen(it)}
                        title={`${itemTitle(it)} · ${formatRange(it.startsAt, it.endsAt, it.allDay || isAllDayish(it))}${it.notes ? ` — ${it.notes}` : ''}`}
                        aria-label={itemTitle(it)}
                        className="absolute rounded-sm hover:opacity-80"
                        style={{
                          top: p.top * MIN_PX,
                          height: Math.max(p.height * MIN_PX, 8),
                          right: 1 + (p.lanes - 1 - p.lane) * w,
                          width: Math.max(w - 1, 3),
                          background: out
                            ? 'repeating-linear-gradient(135deg, #d98f99 0 2px, #fde8ea 2px 5px)'
                            : 'repeating-linear-gradient(0deg, #8fcaa9 0 2px, #e3f4ea 2px 5px)',
                          boxShadow: `inset 0 0 0 1px ${out ? '#e8aab2' : '#a9d8bd'}`,
                        }}
                      />
                    )
                  })}

                  {/* Field availability: open slots, dashed and see-through, under the real events. */}
                  {fields.map((p) => {
                    const it = p.item
                    const px = p.height * MIN_PX
                    const w = `calc((100% - ${STRIP_W + 2}px) / ${p.lanes} - 2px)`
                    const l = `calc((100% - ${STRIP_W + 2}px) * ${p.lane} / ${p.lanes} + 1px)`
                    return (
                      <button
                        key={it.key}
                        type="button"
                        data-block
                        onClick={() => onOpen(it)}
                        title={`${it.location ?? itemTitle(it)} open · ${formatRange(it.startsAt, it.endsAt, false)}`}
                        className={`absolute rounded-md text-left overflow-hidden px-1.5 py-0.5 ${openSlotClass(it)}`}
                        style={{ top: p.top * MIN_PX + 1, height: Math.max(px - 2, 14), left: l, width: w }}
                      >
                        <span className="block text-[0.66rem] font-semibold leading-tight truncate">
                          {it.location ?? itemTitle(it)}
                        </span>
                      </button>
                    )
                  })}

                  {/* The events themselves. */}
                  {blocks.map((p) => {
                    const it = p.item
                    const moving = drag && drag.mode !== 'create' && drag.item.key === it.key
                    const resizing = moving && drag.mode === 'resize'
                    const height = resizing ? drag.height : p.height
                    return (
                      <Block
                        key={it.key}
                        p={{ ...p, height }}
                        faded={!!moving && drag.mode === 'move'}
                        editable={editableEvent(it)}
                        onClick={() => click(it)}
                        onPointerDown={(e, r) => onBlockDown(e, p, col, r)}
                        timeOverride={
                          resizing
                            ? `${minutesToLabel(p.top)} – ${minutesToLabel(p.top + drag.height)}`
                            : undefined
                        }
                      />
                    )
                  })}

                  {/* Where a dragged block will land. */}
                  {drag && drag.mode === 'move' && drag.col === col && (
                    <Block
                      p={{ item: drag.item, top: drag.top, height: drag.height, lane: 0, lanes: 1 }}
                      ghost
                      editable={false}
                      onClick={() => {}}
                      timeOverride={`${minutesToLabel(drag.top)} – ${minutesToLabel(drag.top + drag.height)}`}
                    />
                  )}

                  {/* The new event being drawn. */}
                  {drag && drag.mode === 'create' && drag.col === col && (
                    <div
                      className="absolute left-0.5 rounded-md border-2 border-dashed px-1.5 py-0.5 text-[0.72rem] font-bold pointer-events-none"
                      style={{
                        top: drag.from * MIN_PX,
                        height: Math.max((drag.to - drag.from) * MIN_PX, 12),
                        right: STRIP_W + 2,
                        borderColor: 'var(--gh-green)',
                        background: 'rgba(0,105,62,0.12)',
                        color: 'var(--gh-green-dk)',
                      }}
                    >
                      New · {minutesToLabel(drag.from)} – {minutesToLabel(drag.to)}
                    </div>
                  )}

                  {/* Now. */}
                  {today && nowDate && (
                    <div
                      aria-hidden
                      className="absolute left-0 right-0 z-[5] pointer-events-none"
                      style={{ top: minutesInto(nowDate) * MIN_PX - 1 }}
                    >
                      <div className="relative h-0.5 bg-red-500">
                        <span className="absolute -left-1.5 -top-[5px] w-3 h-3 rounded-full bg-red-500" />
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

/** One event on the grid. */
function Block({
  p,
  faded,
  ghost,
  editable,
  onClick,
  onPointerDown,
  timeOverride,
}: {
  p: Positioned<CalItem>
  faded?: boolean
  ghost?: boolean
  editable: boolean
  onClick: () => void
  onPointerDown?: (e: React.PointerEvent, resize: boolean) => void
  timeOverride?: string
}) {
  const it = p.item
  const c = colorFor(it)
  const px = p.height * MIN_PX
  const time = timeOverride ?? formatRange(it.startsAt, it.endsAt, false)
  const title = gridTitle(it)
  const roomy = px >= 34
  const width = `calc((100% - ${STRIP_W + 2}px) / ${p.lanes} - 2px)`
  const left = `calc((100% - ${STRIP_W + 2}px) * ${p.lane} / ${p.lanes} + 1px)`

  return (
    <button
      type="button"
      data-block
      onClick={onClick}
      onPointerDown={onPointerDown ? (e) => onPointerDown(e, false) : undefined}
      // A button centres its content by default; a block reads from the top.
      className={`absolute flex flex-col justify-start items-stretch rounded-md text-left overflow-hidden px-1.5 ${roomy ? 'py-1' : 'py-0'} ${
        ghost ? 'pointer-events-none shadow-lg ring-2 ring-white z-10' : 'hover:brightness-[0.97] hover:z-[6]'
      } ${editable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}`}
      style={{
        top: p.top * MIN_PX + 1,
        height: Math.max(px - 2, 14),
        left: ghost ? 1 : left,
        width: ghost ? `calc(100% - ${STRIP_W + 4}px)` : width,
        background: c.bg,
        color: c.fg,
        borderLeft: `3px solid ${c.border}`,
        opacity: faded ? 0.35 : ghost ? 0.92 : 1,
        boxShadow: p.lanes > 1 && !ghost ? '0 0 0 1px var(--surface, #fff)' : undefined,
      }}
      title={`${title} · ${time}${it.location ? ` · ${it.location}` : ''}`}
    >
      {roomy ? (
        <>
          {/* Two lines of title only when there is room left for the time under them. */}
          <span className={`text-[0.74rem] font-bold leading-tight ${px >= 60 ? 'line-clamp-2' : 'line-clamp-1'}`}>{title}</span>
          <span className="block text-[0.68rem] leading-tight opacity-90 truncate">{time}</span>
          {px >= 76 && it.location && <span className="block text-[0.66rem] leading-tight opacity-80 truncate">{it.location}</span>}
        </>
      ) : (
        <span className="block text-[0.7rem] font-bold leading-[14px] truncate">
          {title}
          <span className="font-normal opacity-90">, {shortTime(new Date(it.startsAt))}</span>
        </span>
      )}
      {editable && !ghost && onPointerDown && (
        <span
          aria-hidden
          onPointerDown={(e) => {
            e.stopPropagation()
            onPointerDown(e, true)
          }}
          className="absolute left-0 right-0 bottom-0 h-2 cursor-ns-resize"
        />
      )}
    </button>
  )
}
