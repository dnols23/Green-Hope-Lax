'use client'
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'

export type Anchor = { left: number; top: number; right: number; bottom: number }

export const anchorOf = (el: Element): Anchor => {
  const r = el.getBoundingClientRect()
  return { left: r.left, top: r.top, right: r.right, bottom: r.bottom }
}

/**
 * A card that opens under the button that asked for it, in the style of the
 * board's format menu.
 *
 * Fixed to the window, and flipped or nudged to stay on it: a menu opened from
 * the bottom of a phone opens upwards rather than off the glass. It is drawn
 * inside the board, not in a portal, because a board in the browser's own full
 * screen shows nothing that is outside it.
 */
export function Popover({
  anchor,
  onClose,
  children,
  width = 300,
  label,
}: {
  anchor: Anchor
  onClose: () => void
  children: ReactNode
  width?: number
  label: string
}) {
  const card = useRef<HTMLDivElement>(null)
  /* A long press that opened the menu ends with the finger lifting, and the
     browser calls that a tap on whatever is now under it — this. Only a press
     that starts on the backdrop closes the menu. */
  const pressed = useRef(false)
  const [place, setPlace] = useState<{ left: number; top: number; maxH: number } | null>(null)

  // Measure once it is on the glass, then put it where it fits.
  useLayoutEffect(() => {
    const el = card.current
    if (!el) return
    const pad = 8
    const vw = window.innerWidth
    const vh = window.innerHeight
    const w = Math.min(width, vw - pad * 2)
    const h = el.scrollHeight
    const below = vh - anchor.bottom - pad - 6
    const above = anchor.top - pad - 6
    const down = h <= below || below >= above
    setPlace({
      left: Math.max(pad, Math.min(anchor.left, vw - w - pad)),
      top: down ? anchor.bottom + 6 : Math.max(pad, anchor.top - 6 - Math.min(h, above)),
      maxH: Math.max(160, down ? below : above),
    })
  }, [anchor.left, anchor.top, anchor.bottom, width])

  // Escape closes the menu, and only the menu: caught on the way in, before the board sees it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  return (
    <>
      {/* Catches the tap that closes it, so that tap does not also draw on the field. */}
      <button
        type="button"
        aria-label="Close menu"
        tabIndex={-1}
        onPointerDown={(e) => {
          e.stopPropagation()
          pressed.current = true
        }}
        onClick={() => {
          if (pressed.current) onClose()
        }}
        onContextMenu={(e) => {
          e.preventDefault()
          if (pressed.current) onClose()
        }}
        className="fixed inset-0 z-[100] cursor-default"
      />
      <div
        ref={card}
        role="menu"
        aria-label={label}
        onContextMenu={(e) => e.preventDefault()}
        onPointerDown={(e) => e.stopPropagation()}
        className="fixed z-[101] rounded-xl border border-gray-200 bg-white shadow-2xl p-2.5 text-gray-700"
        style={{
          left: place?.left ?? anchor.left,
          top: place?.top ?? anchor.bottom + 6,
          width: `min(${width}px, calc(100vw - 16px))`,
          maxHeight: place?.maxH ?? '70vh',
          overflowY: 'auto',
          visibility: place ? 'visible' : 'hidden',
        }}
      >
        {children}
      </div>
    </>
  )
}

/** A small uppercase heading inside a menu. */
export function MenuLabel({ children }: { children: ReactNode }) {
  return <div className="text-[0.65rem] font-black uppercase tracking-wider text-gray-400 px-1 pt-1.5 pb-1">{children}</div>
}

/** A labelled row of controls inside a menu. */
export function MenuRow({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap py-1">
      {label && <span className="text-[0.65rem] font-black uppercase tracking-wider text-gray-400 w-12 shrink-0 px-1">{label}</span>}
      {children}
    </div>
  )
}

/** A chip: the board's small on/off button. At least 36px tall, for a thumb. */
export function Chip({
  active = false,
  onClick,
  children,
  title,
  disabled,
  wide = false,
}: {
  active?: boolean
  onClick: () => void
  children: ReactNode
  title?: string
  disabled?: boolean
  wide?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      aria-pressed={active}
      disabled={disabled}
      className={`min-h-9 min-w-9 ${wide ? 'px-2.5' : 'px-1.5'} rounded-lg text-xs font-bold border inline-flex items-center justify-center gap-1 transition-colors disabled:opacity-35`}
      style={{
        background: active ? 'var(--gh-green)' : '#fff',
        color: active ? '#fff' : '#4b5563',
        borderColor: active ? 'var(--gh-green)' : '#e5e7eb',
      }}
    >
      {children}
    </button>
  )
}

/** A full-width row in a menu: an icon, what it does, and its key. */
export function MenuItem({
  icon,
  children,
  keys,
  onClick,
  disabled,
  danger,
}: {
  icon?: ReactNode
  children: ReactNode
  keys?: string
  onClick: () => void
  disabled?: boolean
  danger?: boolean
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      className={`w-full min-h-9 flex items-center gap-2.5 px-2 rounded-lg text-sm font-semibold text-left hover:bg-gray-50 disabled:opacity-35 ${
        danger ? 'text-[var(--gh-maroon)]' : ''
      }`}
    >
      <span className="w-5 inline-flex justify-center text-gray-500">{icon}</span>
      <span className="flex-1">{children}</span>
      {keys && <span className="text-[0.7rem] text-gray-400 font-medium hidden sm:inline">{keys}</span>}
    </button>
  )
}

export const MenuRule = () => <div className="h-px bg-gray-100 my-1" />
