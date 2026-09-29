'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { hasMark, linkAt, type MarkType, type Rich } from '@/lib/noteText'
import { NoteIcon } from './NoteIcons'

/** Where a selection is, relative to the editor, and what it covers. */
export interface SelSpot {
  id: string
  start: number
  end: number
  /** Middle of the selection, and its top and bottom, in the editor's own coordinates. */
  x: number
  top: number
  bottom: number
}

const FORMATS: { type: Exclude<MarkType, 'a'>; icon: string; label: string; keys: string }[] = [
  { type: 'b', icon: 'bold', label: 'Bold', keys: '⌘B' },
  { type: 'i', icon: 'italic', label: 'Italic', keys: '⌘I' },
  { type: 'u', icon: 'underline', label: 'Underline', keys: '⌘U' },
  { type: 's', icon: 'strike', label: 'Strikethrough', keys: '⌘⇧S' },
  { type: 'code', icon: 'code', label: 'Code', keys: '⌘E' },
]

/** Stops a tap on a toolbar button taking the caret out of the line being edited. */
const keep = (e: React.MouseEvent | React.PointerEvent) => e.preventDefault()

/**
 * The little bar over selected words: bold, italic, underline, strike, code,
 * link. With the caret inside a link and nothing selected it offers to open,
 * change or remove the link — the only way to follow one on a phone while the
 * note is being edited.
 */
export function SelectionBar({
  spot,
  rich,
  linking,
  onFormat,
  onLinkStart,
  onLinkSave,
  onLinkCancel,
}: {
  spot: SelSpot
  rich: Rich
  /** The link being typed, when the bar is asking for one. */
  linking: string | null
  onFormat: (type: Exclude<MarkType, 'a'>) => void
  onLinkStart: (current: string) => void
  onLinkSave: (href: string | null) => void
  onLinkCancel: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [draft, setDraft] = useState(linking ?? '')
  const link = linkAt(rich, spot.start, spot.end)
  const range = spot.end > spot.start

  useLayoutEffect(() => {
    const bar = ref.current
    const root = bar?.closest('[data-note-editor]') as HTMLElement | null
    if (!bar || !root) return
    const box = root.getBoundingClientRect()
    const w = bar.offsetWidth
    const left = Math.max(8 - box.left, Math.min(spot.x - w / 2, window.innerWidth - 8 - w - box.left))
    // Above the words if there is room on screen, below them if not.
    const above = box.top + spot.top - bar.offsetHeight - 8
    const top = above > 8 ? spot.top - bar.offsetHeight - 8 : spot.bottom + 8
    bar.style.left = `${left}px`
    bar.style.top = `${top}px`
  })

  if (linking !== null) {
    return (
      <div ref={ref} className="ne-menu ne-selbar absolute z-40 flex items-center gap-1 p-1">
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              onLinkSave(draft.trim() || null)
            }
            if (e.key === 'Escape') {
              e.preventDefault()
              onLinkCancel()
            }
          }}
          inputMode="url"
          placeholder="Paste a link"
          aria-label="Link address"
          className="field !py-1 !px-2 text-sm w-52 max-w-[60vw]"
        />
        <button type="button" className="ne-tb" onMouseDown={keep} onClick={() => onLinkSave(draft.trim() || null)} aria-label="Save link">
          <span className="text-sm font-bold">✓</span>
        </button>
        {link && (
          <button type="button" className="ne-tb" onMouseDown={keep} onClick={() => onLinkSave(null)} aria-label="Remove link">
            <NoteIcon name="trash" size={16} />
          </button>
        )}
      </div>
    )
  }

  if (!range && link?.href) {
    return (
      <div ref={ref} className="ne-menu ne-selbar absolute z-40 flex items-center gap-1 p-1 max-w-[calc(100vw-16px)]">
        <a
          href={link.href}
          target="_blank"
          rel="noopener noreferrer"
          onMouseDown={keep}
          className="ne-tb !w-auto px-2 gap-1.5 text-sm font-semibold text-[var(--gh-green)] min-w-0"
        >
          <NoteIcon name="open" size={15} />
          <span className="truncate max-w-[12rem]">{link.href.replace(/^https?:\/\/(www\.)?/, '')}</span>
        </a>
        <button type="button" className="ne-tb" onMouseDown={keep} onClick={() => onLinkStart(link.href ?? '')} aria-label="Change link">
          <NoteIcon name="edit" size={16} />
        </button>
      </div>
    )
  }

  return (
    <div ref={ref} className="ne-menu ne-selbar absolute z-40 flex items-center gap-0.5 p-1" role="toolbar" aria-label="Format">
      {FORMATS.map((f) => (
        <button
          key={f.type}
          type="button"
          className="ne-tb"
          aria-label={f.label}
          aria-pressed={hasMark(rich, spot.start, spot.end, f.type)}
          title={`${f.label} ${f.keys}`}
          onMouseDown={keep}
          onClick={() => onFormat(f.type)}
        >
          <NoteIcon name={f.icon} size={16} />
        </button>
      ))}
      <span className="w-px h-5 bg-gray-200 mx-0.5" aria-hidden />
      <button
        type="button"
        className="ne-tb !w-auto px-2 gap-1 text-sm font-semibold"
        aria-pressed={!!link}
        title="Link ⌘K"
        onMouseDown={keep}
        onClick={() => onLinkStart(link?.href ?? '')}
      >
        <NoteIcon name="link" size={16} /> Link
      </button>
    </div>
  )
}

/**
 * A phone has no Tab key, no Ctrl-B and no hover. This bar sits just above
 * the keyboard while a line is being typed on and does what those would:
 * add a block, make it a to-do, in and out, bold, move it, undo.
 */
export function TouchBar({
  canIndent,
  canOutdent,
  canUndo,
  canRedo,
  isTodo,
  onAction,
}: {
  canIndent: boolean
  canOutdent: boolean
  canUndo: boolean
  canRedo: boolean
  isTodo: boolean
  onAction: (a: TouchAction) => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  // Ride on top of the keyboard: the visual viewport is what is left above it.
  useEffect(() => {
    const vv = window.visualViewport
    const bar = ref.current
    if (!vv || !bar) return
    const place = () => {
      const gap = window.innerHeight - (vv.height + vv.offsetTop)
      bar.style.transform = `translateY(${-Math.max(0, gap)}px)`
    }
    place()
    vv.addEventListener('resize', place)
    vv.addEventListener('scroll', place)
    return () => {
      vv.removeEventListener('resize', place)
      vv.removeEventListener('scroll', place)
    }
  }, [])

  const btn = (a: TouchAction, icon: string, label: string, opts: { disabled?: boolean; on?: boolean } = {}) => (
    <button
      type="button"
      className="ne-tb ne-tb-touch"
      aria-label={label}
      aria-pressed={opts.on}
      disabled={opts.disabled}
      onMouseDown={keep}
      onClick={() => onAction(a)}
    >
      <NoteIcon name={icon} size={20} />
    </button>
  )

  return (
    <div
      ref={ref}
      className="ne-touchbar fixed inset-x-0 bottom-0 z-40 border-t"
      role="toolbar"
      aria-label="Editing"
      onMouseDown={keep}
    >
      <div className="flex items-center gap-0.5 overflow-x-auto px-1 py-1">
        {btn('block', 'plus', 'Add a block')}
        {btn('todo', 'todo', isTodo ? 'Make it text' : 'Make it a to-do', { on: isTodo })}
        {btn('outdent', 'outdent', 'Outdent', { disabled: !canOutdent })}
        {btn('indent', 'indent', 'Indent', { disabled: !canIndent })}
        {btn('undo', 'undo', 'Undo', { disabled: !canUndo })}
        {btn('redo', 'redo', 'Redo', { disabled: !canRedo })}
        <span className="w-px h-6 bg-gray-200 mx-0.5 shrink-0" aria-hidden />
        {btn('b', 'bold', 'Bold')}
        {btn('i', 'italic', 'Italic')}
        {btn('s', 'strike', 'Strikethrough')}
        {btn('link', 'link', 'Link')}
        {btn('details', 'details', 'Details')}
        {btn('up', 'up', 'Move up')}
        {btn('down', 'down', 'Move down')}
        {btn('done', 'hide', 'Done typing')}
      </div>
    </div>
  )
}

export type TouchAction =
  | 'block'
  | 'todo'
  | 'indent'
  | 'outdent'
  | 'undo'
  | 'redo'
  | 'b'
  | 'i'
  | 's'
  | 'link'
  | 'details'
  | 'up'
  | 'down'
  | 'done'
