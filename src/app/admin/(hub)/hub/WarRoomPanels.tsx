'use client'
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'

const ORDER_KEY = 'gh-warroom-order-v1'
const ORDER_EVENT = 'gh-warroom-order-changed'
const SLIDE_MS = 200
const EASE = 'cubic-bezier(0.2, 0, 0, 1)'

function readOrder(): string {
  try { return localStorage.getItem(ORDER_KEY) ?? '' } catch { return '' }
}
function subscribe(onChange: () => void) {
  window.addEventListener(ORDER_EVENT, onChange)
  window.addEventListener('storage', onChange)
  return () => {
    window.removeEventListener(ORDER_EVENT, onChange)
    window.removeEventListener('storage', onChange)
  }
}

export interface Panel {
  key: string
  title: string
  body: React.ReactNode
}

/** The panel being carried, and the gap it would drop into (its place among the others). */
type Drag = { key: string; slot: number; width: number; height: number; x0: number; y0: number }

type Session = {
  key: string
  pointerId: number
  /** Where on the panel it was picked up, so it doesn't jump to the finger. */
  dx: number
  dy: number
  x: number
  y: number
  slot: number
  others: string[]
  scroll: number
  done: boolean
  /** Where it was picked up, so the page only scrolls once the panel is really moving. */
  sx: number
  sy: number
}

/**
 * The War Room's panels, in this coach's own order.
 *
 * Pick a panel up by its grip and it lifts off the page and follows the
 * finger; the others slide out of the way and a dashed gap shows where it
 * will land before anything is let go. Pointer events rather than the
 * browser's drag and drop, which iPhones don't have. The order is kept in the
 * coach's own browser — the head coach wants today's plan first, the goalie
 * coach wants the schedule.
 */
export function WarRoomPanels({ panels }: { panels: Panel[] }) {
  const [drag, setDrag] = useState<Drag | null>(null)
  const savedJson = useSyncExternalStore(subscribe, readOrder, () => '')
  const grid = useRef<HTMLDivElement>(null)
  const gap = useRef<HTMLDivElement>(null)
  const els = useRef(new Map<string, HTMLElement>())
  const last = useRef(new Map<string, { x: number; y: number }>())
  const session = useRef<Session | null>(null)
  const skipSlide = useRef<string | null>(null)

  let saved: string[] = []
  try { saved = savedJson ? (JSON.parse(savedJson) as string[]) : [] } catch { saved = [] }

  const byKey = new Map(panels.map((p) => [p.key, p]))
  const ordered: Panel[] = []
  for (const key of saved) {
    const found = byKey.get(key)
    if (found) { ordered.push(found); byKey.delete(key) }
  }
  const shown = [...ordered, ...byKey.values()]
  const others = drag ? shown.filter((p) => p.key !== drag.key) : shown

  // Where each panel sits in the grid, ignoring any slide in progress.
  function measure() {
    const at = new Map<string, { x: number; y: number }>()
    for (const [k, el] of els.current) at.set(k, { x: el.offsetLeft, y: el.offsetTop })
    return at
  }

  /* Whenever the gap moves, every panel that changed place slides there from
     where it was, instead of snapping. */
  useLayoutEffect(() => {
    const now = measure()
    for (const [k, el] of els.current) {
      const was = last.current.get(k)
      const is = now.get(k)
      if (!was || !is || k === drag?.key || k === skipSlide.current) continue
      const dx = was.x - is.x
      const dy = was.y - is.y
      if (!dx && !dy) continue
      el.style.transition = 'none'
      el.style.transform = `translate(${dx}px, ${dy}px)`
      void el.offsetWidth
      el.style.transition = `transform ${SLIDE_MS}ms ${EASE}`
      el.style.transform = ''
    }
    skipSlide.current = null
    last.current = now
  })

  // No text gets selected while a panel is being carried.
  const carrying = drag !== null
  useEffect(() => {
    if (!carrying) return
    const body = document.body
    body.style.userSelect = 'none'
    return () => {
      body.style.userSelect = ''
    }
  }, [carrying])

  function persist(next: string[]) {
    try { localStorage.setItem(ORDER_KEY, JSON.stringify(next)) } catch {}
    window.dispatchEvent(new Event(ORDER_EVENT))
  }

  function place(s: Session) {
    const el = els.current.get(s.key)
    if (el) el.style.transform = `translate(${s.x - s.dx}px, ${s.y - s.dy}px) scale(1.02)`
  }

  /**
   * Which gap the finger is asking for. A panel only makes way once the finger
   * is past its middle — side to side within a row, up and down between rows —
   * so panels of different heights can't flip back and forth under a finger
   * that has stopped.
   */
  function slotAt(s: Session): number {
    const g = grid.current
    const hole = gap.current
    if (!g || !hole) return s.slot
    const r = g.getBoundingClientRect()
    const x = s.x - r.left
    const y = s.y - r.top
    let bottom = 0
    for (let i = 0; i < s.others.length; i++) {
      const el = els.current.get(s.others[i])
      if (!el) continue
      const { offsetLeft: left, offsetTop: top, offsetWidth: w, offsetHeight: h } = el
      bottom = Math.max(bottom, top + h)
      if (x < left || x > left + w || y < top || y > top + h) continue
      const sameRow = Math.abs(top - hole.offsetTop) < 4
      const after = i >= s.slot // this panel sits after the gap
      const past = sameRow ? (after ? x > left + w / 2 : x < left + w / 2) : after ? y > top + h / 2 : y < top + h / 2
      if (!past) return s.slot
      return after ? i + 1 : i
    }
    return y > bottom ? s.others.length : s.slot
  }

  function onMoveTo(s: Session) {
    place(s)
    const slot = slotAt(s)
    if (slot !== s.slot) {
      s.slot = slot
      setDrag((d) => (d ? { ...d, slot } : d))
    }
  }

  // Near the top or bottom of the screen the page scrolls, so a panel can go anywhere.
  function autoScroll() {
    const s = session.current
    if (!s || s.done) return
    const edge = 80
    const h = window.innerHeight
    const travelled = Math.abs(s.y - s.sy) > 24 || Math.abs(s.x - s.sx) > 24
    if (!travelled) {
      s.scroll = requestAnimationFrame(autoScroll)
      return
    }
    const speed = s.y < edge ? -Math.ceil((edge - s.y) / 5) : s.y > h - edge ? Math.ceil((s.y - (h - edge)) / 5) : 0
    if (speed) {
      window.scrollBy(0, speed)
      onMoveTo(s)
    }
    s.scroll = requestAnimationFrame(autoScroll)
  }

  function start(e: React.PointerEvent, key: string) {
    if (e.button !== 0 || session.current) return
    const el = els.current.get(key)
    if (!el) return
    e.preventDefault()
    const box = el.getBoundingClientRect()
    const from = shown.findIndex((p) => p.key === key)
    const s: Session = {
      key,
      pointerId: e.pointerId,
      dx: e.clientX - box.left,
      dy: e.clientY - box.top,
      x: e.clientX,
      y: e.clientY,
      slot: from,
      others: shown.filter((p) => p.key !== key).map((p) => p.key),
      scroll: 0,
      done: false,
      sx: e.clientX,
      sy: e.clientY,
    }
    session.current = s
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    last.current = measure()
    // Lifted in place: the panel starts exactly where it was.
    setDrag({ key, slot: from, width: box.width, height: box.height, x0: box.left, y0: box.top })
    s.scroll = requestAnimationFrame(autoScroll)
  }

  function move(e: React.PointerEvent) {
    const s = session.current
    if (!s || s.done || e.pointerId !== s.pointerId) return
    s.x = e.clientX
    s.y = e.clientY
    onMoveTo(s)
  }

  function finish(e: React.PointerEvent, cancel = false) {
    const s = session.current
    if (!s || s.done || e.pointerId !== s.pointerId) return
    s.done = true
    cancelAnimationFrame(s.scroll)
    const el = els.current.get(s.key)
    const target = gap.current?.getBoundingClientRect()
    const slot = cancel ? shown.findIndex((p) => p.key === s.key) : s.slot
    const land = () => {
      const next = [...s.others]
      next.splice(slot, 0, s.key)
      skipSlide.current = s.key
      if (el) {
        el.style.transition = ''
        el.style.transform = ''
      }
      session.current = null
      if (next.join() !== shown.map((p) => p.key).join()) persist(next)
      setDrag(null)
    }
    // Settle into the gap, then take its place.
    if (el && target && !cancel) {
      el.style.transition = `transform ${SLIDE_MS}ms ${EASE}, box-shadow ${SLIDE_MS}ms ${EASE}`
      el.style.transform = `translate(${target.left}px, ${target.top}px)`
      window.setTimeout(land, SLIDE_MS)
    } else {
      land()
    }
  }

  /** Arrow keys on the grip move a panel one place, for anyone not dragging. */
  function nudge(e: React.KeyboardEvent, key: string) {
    const by = e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : 0
    if (!by) return
    e.preventDefault()
    const keys = shown.map((p) => p.key)
    const i = keys.indexOf(key)
    const j = i + by
    if (j < 0 || j >= keys.length) return
    ;[keys[i], keys[j]] = [keys[j], keys[i]]
    persist(keys)
  }

  // Visual place of each panel while carrying one: the others close up around the gap.
  const orderOf = new Map<string, number>()
  others.forEach((p, i) => orderOf.set(p.key, drag && i >= drag.slot ? i + 1 : i))

  return (
    <div ref={grid} className="relative grid gap-3 md:grid-cols-2" data-tour="warroom-panels">
      {shown.map((p) => {
        const carried = drag?.key === p.key
        return (
          <section
            key={p.key}
            ref={(el) => {
              if (el) els.current.set(p.key, el)
              else els.current.delete(p.key)
            }}
            className="card p-4"
            style={
              carried && drag
                ? {
                    position: 'fixed',
                    left: 0,
                    top: 0,
                    width: drag.width,
                    height: drag.height,
                    zIndex: 60,
                    margin: 0,
                    pointerEvents: 'none',
                    boxShadow: '0 18px 40px rgb(0 0 0 / 0.22), 0 4px 10px rgb(0 0 0 / 0.12)',
                    willChange: 'transform',
                    transform: `translate(${drag.x0}px, ${drag.y0}px)`,
                  }
                : { order: orderOf.get(p.key) }
            }
          >
            <div className="flex items-center gap-1.5 mb-2 -ml-2">
              <button
                type="button"
                aria-label={`Move ${p.title}`}
                title="Drag to move this panel"
                onPointerDown={(e) => start(e, p.key)}
                onPointerMove={move}
                onPointerUp={(e) => finish(e)}
                onPointerCancel={(e) => finish(e, true)}
                onKeyDown={(e) => nudge(e, p.key)}
                className={`w-8 h-8 grid place-items-center rounded-md text-gray-300 hover:text-gray-500 hover:bg-gray-100 ${
                  carried ? 'cursor-grabbing text-gray-500' : 'cursor-grab'
                }`}
                style={{ touchAction: 'none', pointerEvents: 'auto' }}
              >
                <span aria-hidden className="text-sm leading-none">☰</span>
              </button>
              <h2 className="font-black text-gray-700 text-sm tracking-wide uppercase">{p.title}</h2>
            </div>
            {p.body}
          </section>
        )
      })}
      {drag && (
        <div
          ref={gap}
          aria-hidden
          className="rounded-2xl border-2 border-dashed"
          style={{
            order: drag.slot,
            height: drag.height,
            borderColor: 'var(--gh-green)',
            background: 'rgb(0 105 62 / 0.06)',
          }}
        />
      )}
    </div>
  )
}
