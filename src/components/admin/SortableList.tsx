'use client'

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'

/** What a row's handle needs to start a drag. Spread onto the grip element. */
export interface GripProps {
  onPointerDown: (e: PointerEvent) => void
  onKeyDown: (e: KeyboardEvent) => void
  style: CSSProperties
  'aria-label': string
  role: 'button'
  tabIndex: number
}

/**
 * A list you put in order by sliding the rows.
 *
 * Pointer events rather than the browser's drag-and-drop, which an iPhone
 * doesn't do: press the grip, slide, and the other rows make room as the
 * finger passes them. Arrow keys on the grip move a row one place. The new
 * order is handed over once, when the row is let go, and shows straight away.
 */
export function SortableList<T extends { id: string }>({
  items,
  onReorder,
  renderItem,
  className = '',
  itemClassName = '',
  label = (item: T) => item.id,
}: {
  items: T[]
  onReorder: (ids: string[]) => void
  renderItem: (item: T, grip: GripProps, dragging: boolean) => ReactNode
  className?: string
  itemClassName?: string
  /** What a screen reader hears for a row's grip. */
  label?: (item: T) => string
}) {
  const baseIds = items.map((i) => i.id)
  const baseKey = baseIds.join(',')
  // A slide shows at once and holds until the saved order comes back.
  const [moved, setMoved] = useState<{ from: string; ids: string[] } | null>(null)
  const ids = moved && moved.from === baseKey ? moved.ids : baseIds
  // The row being slid, and the order when it was picked up.
  const [drag, setDrag] = useState<{ id: string; start: string[] } | null>(null)
  const dragId = drag?.id ?? null
  const rows = useRef(new Map<string, HTMLLIElement>())

  const byId = new Map(items.map((i) => [i.id, i]))

  useEffect(() => {
    if (!drag) return
    const dragId = drag.id
    let order = drag.start
    const move = (e: globalThis.PointerEvent) => {
      const others = order.filter((id) => id !== dragId)
      // Where the finger is among the other rows' middles.
      let at = others.length
      for (let i = 0; i < others.length; i++) {
        const el = rows.current.get(others[i])
        if (!el) continue
        const r = el.getBoundingClientRect()
        if (e.clientY < r.top + r.height / 2) {
          at = i
          break
        }
      }
      const next = [...others.slice(0, at), dragId, ...others.slice(at)]
      if (next.join(',') !== order.join(',')) {
        order = next
        setMoved({ from: baseKey, ids: next })
      }
    }
    const up = () => {
      setDrag(null)
      if (order.join(',') !== drag.start.join(',')) onReorder(order)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [drag, baseKey, onReorder])

  function nudge(id: string, by: number) {
    const from = ids.indexOf(id)
    const to = from + by
    if (from < 0 || to < 0 || to >= ids.length) return
    const next = [...ids]
    next.splice(from, 1)
    next.splice(to, 0, id)
    setMoved({ from: baseKey, ids: next })
    onReorder(next)
  }

  return (
    <ul className={className}>
      {ids.map((id) => {
        const item = byId.get(id)
        if (!item) return null
        const grip: GripProps = {
          role: 'button',
          tabIndex: 0,
          'aria-label': `Move ${label(item)} — drag, or use the arrow keys`,
          style: { touchAction: 'none', cursor: dragId === id ? 'grabbing' : 'grab' },
          onPointerDown: (e) => {
            e.preventDefault()
            setDrag({ id, start: ids })
          },
          onKeyDown: (e) => {
            if (e.key === 'ArrowUp') {
              e.preventDefault()
              nudge(id, -1)
            } else if (e.key === 'ArrowDown') {
              e.preventDefault()
              nudge(id, 1)
            }
          },
        }
        return (
          <li
            key={id}
            ref={(el) => {
              if (el) rows.current.set(id, el)
              else rows.current.delete(id)
            }}
            className={`${itemClassName} ${dragId === id ? 'relative z-10 rounded-lg bg-white shadow-lg ring-1 ring-[var(--gh-green)]' : ''}`}
          >
            {renderItem(item, grip, dragId === id)}
          </li>
        )
      })}
    </ul>
  )
}

/** The six dots a row is picked up by. */
export function GripDots() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden fill="currentColor">
      <circle cx="9" cy="6" r="1.6" /><circle cx="15" cy="6" r="1.6" />
      <circle cx="9" cy="12" r="1.6" /><circle cx="15" cy="12" r="1.6" />
      <circle cx="9" cy="18" r="1.6" /><circle cx="15" cy="18" r="1.6" />
    </svg>
  )
}
