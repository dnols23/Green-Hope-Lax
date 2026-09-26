'use client'

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'

const SLIDE_MS = 180
const EASE = 'cubic-bezier(0.2, 0, 0, 1)'

/** Spread onto a row's handle. */
export interface SlideGrip {
  onPointerDown: (e: PointerEvent) => void
  onKeyDown: (e: KeyboardEvent) => void
  style: CSSProperties
  role: 'button'
  tabIndex: number
  'aria-label': string
}

function scrollParent(el: HTMLElement | null): HTMLElement | null {
  for (let p = el?.parentElement ?? null; p; p = p.parentElement) {
    const s = getComputedStyle(p)
    if (/(auto|scroll)/.test(s.overflowY) && p.scrollHeight > p.clientHeight) return p
  }
  return null
}

/**
 * A vertical list you rearrange by sliding rows, the way the War Room's panels
 * move: the row follows the finger and the others slide out of its way, so
 * where it will land is plain before it is let go. Pointer events, so it works
 * on an iPhone. Near the top or bottom of its scroll area the area scrolls.
 */
export function SlideList<T extends { id: string }>({
  items,
  onReorder,
  renderItem,
  locked = false,
  className = '',
  label = (item: T) => item.id,
}: {
  items: T[]
  onReorder: (ids: string[]) => void
  renderItem: (item: T, grip: SlideGrip | null, dragging: boolean) => ReactNode
  /** Locked: no grips, nothing moves. */
  locked?: boolean
  className?: string
  label?: (item: T) => string
}) {
  // The row picked up, and where the finger was. Everything else lives in the effect.
  const [drag, setDrag] = useState<{ id: string; y: number; pointerId: number } | null>(null)
  const dragging = drag?.id ?? null
  const rows = useRef(new Map<string, HTMLLIElement>())
  const ids = items.map((i) => i.id)
  const latest = useRef({ ids, onReorder })
  useEffect(() => {
    latest.current = { ids, onReorder }
  })

  useEffect(() => {
    if (!drag) return
    const { ids: order, onReorder: done } = latest.current
    const el = rows.current.get(drag.id)
    if (!el) return
    const from = order.indexOf(drag.id)
    // The distance one row moves: its own height plus the gap to the next.
    const near = rows.current.get(order[from + 1] ?? '') ?? rows.current.get(order[from - 1] ?? '')
    const step = near ? Math.abs(near.offsetTop - el.offsetTop) || el.offsetHeight : el.offsetHeight
    const scroller = scrollParent(el)
    const startScroll = scroller?.scrollTop ?? 0
    let y = drag.y
    let target = from
    let raf = 0
    let over = false

    const paint = () => {
      const dy = y - drag.y + ((scroller?.scrollTop ?? 0) - startScroll)
      target = Math.max(0, Math.min(order.length - 1, from + Math.round(dy / step)))
      order.forEach((id, j) => {
        const row = rows.current.get(id)
        if (!row) return
        if (id === drag.id) {
          row.style.transition = 'box-shadow 150ms'
          row.style.transform = `translateY(${dy}px) scale(1.02)`
          return
        }
        let shift = 0
        if (from < target && j > from && j <= target) shift = -step
        if (from > target && j < from && j >= target) shift = step
        row.style.transition = `transform ${SLIDE_MS}ms ${EASE}`
        row.style.transform = shift ? `translateY(${shift}px)` : ''
      })
    }
    // Near the top or bottom of the scroll area, the area scrolls.
    const edge = () => {
      const box = scroller?.getBoundingClientRect()
      const top = box ? Math.max(box.top, 0) : 0
      const bottom = box ? Math.min(box.bottom, window.innerHeight) : window.innerHeight
      const speed = y < top + 56 ? -Math.ceil((top + 56 - y) / 4) : y > bottom - 56 ? Math.ceil((y - (bottom - 56)) / 4) : 0
      if (speed && scroller) {
        scroller.scrollTop += speed
        paint()
      }
      raf = requestAnimationFrame(edge)
    }
    const move = (e: globalThis.PointerEvent) => {
      if (e.pointerId !== drag.pointerId) return
      y = e.clientY
      paint()
    }
    const up = (e: globalThis.PointerEvent) => {
      if (e.pointerId !== drag.pointerId || over) return
      over = true
      stop()
      // Settle into the gap, then take its place.
      el.style.transition = `transform ${SLIDE_MS}ms ${EASE}`
      el.style.transform = `translateY(${(target - from) * step}px)`
      window.setTimeout(() => {
        for (const row of rows.current.values()) {
          row.style.transition = 'none'
          row.style.transform = ''
        }
        setDrag(null)
        if (target !== from) {
          const next = order.filter((x) => x !== drag.id)
          next.splice(target, 0, drag.id)
          done(next)
        }
      }, SLIDE_MS)
    }
    const stop = () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    raf = requestAnimationFrame(edge)
    return stop
  }, [drag])

  function nudge(id: string, by: number) {
    const from = ids.indexOf(id)
    const to = from + by
    if (locked || from < 0 || to < 0 || to >= ids.length) return
    const next = [...ids]
    next.splice(to, 0, next.splice(from, 1)[0])
    onReorder(next)
  }

  return (
    <ul className={className}>
      {items.map((item) => {
        const grip: SlideGrip | null = locked
          ? null
          : {
              role: 'button',
              tabIndex: 0,
              'aria-label': `Move ${label(item)} — drag, or use the arrow keys`,
              style: { touchAction: 'none', cursor: dragging === item.id ? 'grabbing' : 'grab' },
              onPointerDown: (e) => {
                if (e.button !== 0 || drag) return
                e.preventDefault()
                setDrag({ id: item.id, y: e.clientY, pointerId: e.pointerId })
              },
              onKeyDown: (e) => {
                if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                  e.preventDefault()
                  nudge(item.id, e.key === 'ArrowUp' ? -1 : 1)
                }
              },
            }
        return (
          <li
            key={item.id}
            ref={(el) => {
              if (el) rows.current.set(item.id, el)
              else rows.current.delete(item.id)
            }}
            className={dragging === item.id ? 'relative z-10 rounded-lg shadow-lg' : 'relative'}
            style={dragging === item.id ? { background: 'var(--surface, #fff)' } : undefined}
          >
            {renderItem(item, grip, dragging === item.id)}
          </li>
        )
      })}
    </ul>
  )
}
