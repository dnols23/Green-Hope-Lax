'use client'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { PLAYBOOK_SECTIONS, type PlaybookSection } from '@/lib/playbook'

/** Where a menu opens, worked out when it is asked for (never while drawing). */
export interface Anchor {
  left: number
  top?: number
  bottom?: number
}

const MENU_W = 232

/** A menu at a point — under a ⋯ button, or wherever the right-click was. */
export function anchorAt(x: number, y: number): Anchor {
  const left = Math.max(8, Math.min(x, window.innerWidth - MENU_W - 8))
  // In the bottom half of the screen it opens upward, so it is never cut off.
  return y > window.innerHeight * 0.55 ? { left, bottom: Math.max(8, window.innerHeight - y) } : { left, top: y }
}

/** Under (or over) the button that opened it. */
export function anchorUnder(el: Element): Anchor {
  const r = el.getBoundingClientRect()
  const a = anchorAt(r.left, r.bottom + 4)
  return a.bottom !== undefined ? { ...a, bottom: window.innerHeight - r.top + 4 } : a
}

/**
 * A small menu, floating. It goes away on a click anywhere else, on Escape and
 * when the window changes size — the way every other menu does.
 */
export function Popover({ at, onClose, label, children }: { at: Anchor; onClose: () => void; label: string; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null)
  const close = useRef(onClose)
  useEffect(() => {
    close.current = onClose
  })
  useEffect(() => {
    const away = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) close.current()
    }
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        close.current()
      }
    }
    const resize = () => close.current()
    document.addEventListener('pointerdown', away, true)
    window.addEventListener('keydown', key)
    window.addEventListener('resize', resize)
    // Straight to the first choice, so a keyboard can drive it.
    box.current?.querySelector<HTMLElement>('button:not([disabled])')?.focus()
    return () => {
      document.removeEventListener('pointerdown', away, true)
      window.removeEventListener('keydown', key)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <div
      ref={box}
      role="menu"
      aria-label={label}
      className="fixed z-[80] rounded-xl border border-gray-200 bg-white shadow-xl p-1 max-h-[70vh] overflow-y-auto"
      style={{ ...at, width: MENU_W }}
    >
      {children}
    </div>
  )
}

export function MenuItem({
  onClick,
  children,
  danger = false,
  disabled = false,
  checked,
}: {
  onClick: () => void
  children: ReactNode
  danger?: boolean
  disabled?: boolean
  checked?: boolean
}) {
  return (
    <button
      type="button"
      role={checked === undefined ? 'menuitem' : 'menuitemradio'}
      aria-checked={checked}
      disabled={disabled}
      onClick={onClick}
      className={`w-full flex items-center gap-2 text-left text-sm font-semibold rounded-lg px-3 py-2 disabled:opacity-40 focus:outline-none focus-visible:bg-gray-100 hover:bg-gray-100 ${
        danger ? 'text-red-600' : 'text-gray-700'
      }`}
    >
      {children}
    </button>
  )
}

const Rule = () => <div className="my-1 border-t border-gray-100" role="separator" />

/** What can be done to one page: the thumbnail's ⋯ and right-click, and the top bar's ⋯. */
export function SlideMenu({
  at,
  title,
  section,
  canEarlier,
  canLater,
  onClose,
  onDuplicate,
  onSection,
  onMove,
  onDelete,
}: {
  at: Anchor
  title: string
  section: PlaybookSection | null
  canEarlier: boolean
  canLater: boolean
  onClose: () => void
  onDuplicate: () => void
  onSection: (s: PlaybookSection | null) => void
  onMove: (by: -1 | 1) => void
  onDelete: () => void
}) {
  const [sections, setSections] = useState(false)
  const then = (fn: () => void) => () => {
    onClose()
    fn()
  }
  return (
    <Popover at={at} onClose={onClose} label={`${title || 'Page'} — options`}>
      {sections ? (
        <>
          <MenuItem onClick={() => setSections(false)}>
            <span aria-hidden>‹</span> Move to section
          </MenuItem>
          <Rule />
          {[...PLAYBOOK_SECTIONS, { key: null, label: 'Not sorted', icon: '·' }].map((s) => (
            <MenuItem key={s.key ?? 'none'} checked={section === s.key} onClick={then(() => onSection(s.key))}>
              <span aria-hidden className="w-5 text-center">{s.icon}</span>
              <span className="flex-1">{s.label}</span>
              {section === s.key && <span aria-hidden className="text-[var(--gh-green)]">✓</span>}
            </MenuItem>
          ))}
        </>
      ) : (
        <>
          <MenuItem onClick={then(onDuplicate)}>
            <span aria-hidden className="w-5 text-center">⧉</span> Duplicate
          </MenuItem>
          <MenuItem onClick={() => setSections(true)}>
            <span aria-hidden className="w-5 text-center">↳</span>
            <span className="flex-1">Move to section</span>
            <span aria-hidden className="text-gray-400">›</span>
          </MenuItem>
          <MenuItem disabled={!canEarlier} onClick={then(() => onMove(-1))}>
            <span aria-hidden className="w-5 text-center">↑</span> Move earlier
          </MenuItem>
          <MenuItem disabled={!canLater} onClick={then(() => onMove(1))}>
            <span aria-hidden className="w-5 text-center">↓</span> Move later
          </MenuItem>
          <Rule />
          <MenuItem danger onClick={then(onDelete)}>
            <span aria-hidden className="w-5 text-center">🗑</span> Delete page
          </MenuItem>
        </>
      )}
    </Popover>
  )
}

/** The kinds of new slide, as createSlide names them. */
export type NewKind = 'field' | 'field-half' | 'words' | 'picture'

export const NEW_KINDS: { key: NewKind; label: string; icon: string; hint: string }[] = [
  { key: 'field', label: 'Field', icon: '🥍', hint: 'The whole field, to draw on' },
  { key: 'field-half', label: 'Half field', icon: '🥅', hint: 'One end' },
  { key: 'words', label: 'Words', icon: '✍️', hint: 'A title and what to say' },
  { key: 'picture', label: 'Picture', icon: '🖼', hint: 'A photo or screenshot' },
]

export function NewSlideMenu({ at, where, onClose, onPick }: { at: Anchor; where: string; onClose: () => void; onPick: (k: NewKind) => void }) {
  return (
    <Popover at={at} onClose={onClose} label="New slide">
      <div className="px-3 pt-1.5 pb-1 text-[0.65rem] font-black uppercase tracking-wider text-gray-400">{where}</div>
      {NEW_KINDS.map((k) => (
        <MenuItem
          key={k.key}
          onClick={() => {
            onClose()
            onPick(k.key)
          }}
        >
          <span aria-hidden className="w-5 text-center">{k.icon}</span>
          <span className="flex flex-col leading-tight">
            <span>{k.label}</span>
            <span className="text-xs font-normal text-gray-400">{k.hint}</span>
          </span>
        </MenuItem>
      ))}
    </Popover>
  )
}
