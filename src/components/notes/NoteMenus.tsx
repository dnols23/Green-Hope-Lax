'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { NOTE_COLORS, isTextBlock, type NoteBlock, type NoteBlockKind, type NoteColor } from '@/lib/noteBlocks'
import { caretRect } from './caret'
import { NoteIcon } from './NoteIcons'

/** One thing the "/" menu can make. */
export interface BlockChoice {
  key: string
  label: string
  hint: string
  kind: NoteBlockKind
  level?: 1 | 2 | 3
  /** What its tile shows: an icon name, or a couple of letters. */
  icon: string
  /** Other words someone might type for it. */
  words: string
}

export const BLOCK_CHOICES: BlockChoice[] = [
  { key: 'text', label: 'Text', hint: 'Just start writing', kind: 'text', icon: 'Aa', words: 'text paragraph plain words' },
  { key: 'h1', label: 'Heading 1', hint: 'Big section heading', kind: 'heading', level: 1, icon: 'H1', words: 'heading h1 title big section #' },
  { key: 'h2', label: 'Heading 2', hint: 'Medium section heading', kind: 'heading', level: 2, icon: 'H2', words: 'heading h2 subtitle section ##' },
  { key: 'h3', label: 'Heading 3', hint: 'Small section heading', kind: 'heading', level: 3, icon: 'H3', words: 'heading h3 small section ###' },
  { key: 'todo', label: 'To-do list', hint: 'Tick things off — with sub-items and details', kind: 'todo', icon: 'todo', words: 'todo to-do checklist checkbox task check list []' },
  { key: 'bullet', label: 'Bulleted list', hint: 'A simple list', kind: 'bullet', icon: 'bullet', words: 'bullet bulleted list unordered ul dash -' },
  { key: 'number', label: 'Numbered list', hint: 'A list in order', kind: 'number', icon: 'number', words: 'number numbered ordered list ol steps 1.' },
  { key: 'toggle', label: 'Toggle list', hint: 'Fold a section away', kind: 'toggle', icon: 'toggle', words: 'toggle collapse fold dropdown hide >' },
  { key: 'callout', label: 'Callout', hint: 'Make a line stand out', kind: 'callout', icon: 'callout', words: 'callout note tip warning box highlight' },
  { key: 'quote', label: 'Quote', hint: 'Something somebody said', kind: 'quote', icon: 'quote', words: 'quote blockquote said "' },
  { key: 'divider', label: 'Divider', hint: 'A line across the page', kind: 'divider', icon: 'divider', words: 'divider line rule separator hr ---' },
  { key: 'bookmark', label: 'Link', hint: 'A web page or a video, with a title', kind: 'bookmark', icon: 'link', words: 'link bookmark url web page video youtube hudl' },
  { key: 'image', label: 'Image', hint: 'Upload a photo or paste a link', kind: 'image', icon: 'image', words: 'image picture photo upload screenshot' },
  { key: 'table', label: 'Table', hint: 'Rows and columns', kind: 'table', icon: 'table', words: 'table grid rows columns spreadsheet' },
  { key: 'board', label: 'Field diagram', hint: 'Draw a play on the field', kind: 'board', icon: 'field', words: 'field board diagram play draw lacrosse set' },
  { key: 'chart', label: 'Chart', hint: 'Numbers as a chart', kind: 'chart', icon: 'chart', words: 'chart graph stats numbers' },
]

/** The choices that match what was typed after "/", best first. */
export function filterChoices(query: string, choices = BLOCK_CHOICES): BlockChoice[] {
  const q = query.trim().toLowerCase()
  if (!q) return choices
  const scored = choices
    .map((c) => {
      const label = c.label.toLowerCase()
      const words = c.words.split(' ')
      const score = label.startsWith(q)
        ? 0
        : words.some((w) => w.startsWith(q))
          ? 1
          : label.includes(q)
            ? 2
            : c.words.includes(q)
              ? 3
              : -1
      return { c, score }
    })
    .filter((x) => x.score >= 0)
  return scored.sort((a, b) => a.score - b.score).map((x) => x.c)
}

export function ChoiceTile({ icon }: { icon: string }) {
  const letters = /^(Aa|H1|H2|H3)$/.test(icon)
  return (
    <span className="ne-tile" aria-hidden>
      {letters ? <span className="text-[0.8rem] font-black tracking-tight">{icon}</span> : <NoteIcon name={icon} size={18} />}
    </span>
  )
}

/**
 * A menu kept on screen: below what it belongs to if there is room, above if
 * not, never off either side, and never under a phone's keyboard.
 */
function placeMenu(menu: HTMLElement, root: HTMLElement, r: DOMRect) {
  const box = root.getBoundingClientRect()
  const vv = window.visualViewport
  const top0 = vv ? vv.offsetTop : 0
  const bottom0 = vv ? vv.offsetTop + vv.height : window.innerHeight
  const width = menu.offsetWidth || 300
  const left = Math.max(8 - box.left, Math.min(r.left - box.left, window.innerWidth - 8 - width - box.left))
  const below = bottom0 - r.bottom - 12
  const above = r.top - top0 - 12
  const up = below < 240 && above > below
  menu.style.maxHeight = `${Math.max(150, Math.min(380, up ? above : below))}px`
  menu.style.left = `${left}px`
  if (up) {
    menu.style.top = ''
    menu.style.bottom = `${box.bottom - r.top + 4}px`
  } else {
    menu.style.bottom = ''
    menu.style.top = `${r.bottom - box.top + 4}px`
  }
}

/** Close when a tap or click lands anywhere outside. */
function useOutside(ref: React.RefObject<HTMLElement | null>, onClose: () => void) {
  const latest = useRef(onClose)
  useEffect(() => {
    latest.current = onClose
  })
  useEffect(() => {
    const down = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) latest.current()
    }
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') latest.current()
    }
    // Next tick, so the tap that opened it does not close it.
    const t = window.setTimeout(() => document.addEventListener('pointerdown', down), 0)
    document.addEventListener('keydown', key)
    return () => {
      window.clearTimeout(t)
      document.removeEventListener('pointerdown', down)
      document.removeEventListener('keydown', key)
    }
  }, [ref])
}

/**
 * The "/" menu: every kind of block, narrowed as you type, picked with the
 * arrow keys and Return or with a tap. It sits under the caret.
 */
export function SlashMenu({
  anchorId,
  items,
  index,
  onPick,
  onHover,
  onClose,
}: {
  anchorId: string
  items: BlockChoice[]
  index: number
  onPick: (c: BlockChoice) => void
  onHover: (i: number) => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  useOutside(ref, onClose)

  useLayoutEffect(() => {
    const menu = ref.current
    const root = menu?.closest('[data-note-editor]') as HTMLElement | null
    const el = root?.querySelector(`[data-rt="${CSS.escape(anchorId)}"]`) as HTMLElement | null
    if (!menu || !root || !el) return
    placeMenu(menu, root, caretRect(el) ?? el.getBoundingClientRect())
  })

  useEffect(() => {
    ref.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [index])

  return (
    <div
      ref={ref}
      className="ne-menu ne-slash absolute z-40 overflow-y-auto p-1"
      role="listbox"
      aria-label="Blocks"
      onMouseDown={(e) => e.preventDefault()}
    >
      {items.length === 0 ? (
        <p className="px-3 py-2 text-sm text-gray-500">No block by that name</p>
      ) : (
        <>
          <p className="px-2 pt-1 pb-1 text-[0.68rem] font-bold uppercase tracking-wider text-gray-400">Blocks</p>
          {items.map((c, i) => (
            <button
              key={c.key}
              type="button"
              role="option"
              aria-selected={i === index}
              className="ne-mi"
              onPointerMove={() => i !== index && onHover(i)}
              onClick={() => onPick(c)}
            >
              <ChoiceTile icon={c.icon} />
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-gray-800">{c.label}</span>
                <span className="block text-xs text-gray-500 truncate">{c.hint}</span>
              </span>
            </button>
          ))}
        </>
      )}
    </div>
  )
}

export type BlockAction =
  | { type: 'turn'; choice: BlockChoice }
  | { type: 'color'; color: NoteColor | null }
  | { type: 'tint'; color: NoteColor | null }
  | { type: 'duplicate' | 'delete' | 'up' | 'down' | 'indent' | 'outdent' | 'details' | 'below' }

const KIND_LABEL: Record<string, string> = {
  text: 'Text',
  heading: 'Heading',
  todo: 'To-do',
  bullet: 'Bulleted list',
  number: 'Numbered list',
  toggle: 'Toggle',
  quote: 'Quote',
  callout: 'Callout',
  divider: 'Divider',
  bookmark: 'Link',
  image: 'Image',
  table: 'Table',
  board: 'Field diagram',
  chart: 'Chart',
}

/**
 * What the ⋮⋮ handle opens: turn it into something else, colour it, give it
 * details, move it, copy it, delete it. Beside the handle on a computer; a
 * sheet from the bottom on a phone, where there is no room beside anything.
 */
export function BlockMenu({
  block,
  sheet,
  can,
  detailsOpen,
  onAction,
  onClose,
}: {
  block: NoteBlock
  sheet: boolean
  can: { indent: boolean; outdent: boolean; up: boolean; down: boolean }
  detailsOpen: boolean
  onAction: (a: BlockAction) => void
  onClose: () => void
}) {
  const [page, setPage] = useState<'main' | 'turn' | 'color'>('main')
  const ref = useRef<HTMLDivElement>(null)
  useOutside(ref, onClose)

  useLayoutEffect(() => {
    const menu = ref.current
    if (!menu || sheet) return
    const root = menu.closest('[data-note-editor]') as HTMLElement | null
    const handle = root?.querySelector(`[data-row="${CSS.escape(block.id)}"] [data-handle]`) as HTMLElement | null
    if (!root || !handle) return
    placeMenu(menu, root, handle.getBoundingClientRect())
  })

  const text = isTextBlock(block)
  const current = (c: BlockChoice) =>
    c.kind === block.kind && (block.kind !== 'heading' || (block.level ?? 2) === c.level)

  const item = (icon: string, label: string, action: () => void, opts: { disabled?: boolean; hint?: string; danger?: boolean; more?: boolean } = {}) => (
    <button
      type="button"
      className={`ne-mi ${opts.danger ? 'text-red-700' : ''}`}
      disabled={opts.disabled}
      onClick={action}
    >
      <NoteIcon name={icon} className={opts.danger ? '' : 'text-gray-500'} />
      <span className="flex-1 text-sm font-medium">{label}</span>
      {opts.hint && <span className="text-xs text-gray-400 hidden sm:inline">{opts.hint}</span>}
      {opts.more && <NoteIcon name="chevron" size={16} className="text-gray-400" />}
    </button>
  )

  const body =
    page === 'turn' ? (
      <>
        <BackRow label="Turn into" onBack={() => setPage('main')} />
        {BLOCK_CHOICES.filter((c) => (TEXTISH as readonly string[]).includes(c.kind)).map((c) => (
          <button
            key={c.key}
            type="button"
            className="ne-mi"
            aria-current={current(c) || undefined}
            onClick={() => onAction({ type: 'turn', choice: c })}
          >
            <ChoiceTile icon={c.icon} />
            <span className="flex-1 text-sm font-medium">{c.label}</span>
            {current(c) && <span className="text-[var(--gh-green)] font-black">✓</span>}
          </button>
        ))}
      </>
    ) : page === 'color' ? (
      <>
        <BackRow label="Color" onBack={() => setPage('main')} />
        <p className="px-2 pt-1 text-[0.68rem] font-bold uppercase tracking-wider text-gray-400">Text</p>
        <div className="grid grid-cols-5 gap-1 p-1">
          <Swatch label="Default" on={!block.color} onClick={() => onAction({ type: 'color', color: null })} />
          {NOTE_COLORS.map((c) => (
            <Swatch key={c.key} label={c.label} color={c.key} on={block.color === c.key} onClick={() => onAction({ type: 'color', color: c.key })} />
          ))}
        </div>
        <p className="px-2 pt-1 text-[0.68rem] font-bold uppercase tracking-wider text-gray-400">Background</p>
        <div className="grid grid-cols-5 gap-1 p-1">
          <Swatch label="Default" tint on={!block.tint} onClick={() => onAction({ type: 'tint', color: null })} />
          {NOTE_COLORS.map((c) => (
            <Swatch key={c.key} label={c.label} tint color={c.key} on={block.tint === c.key} onClick={() => onAction({ type: 'tint', color: c.key })} />
          ))}
        </div>
      </>
    ) : (
      <>
        <p className="px-2 pt-1 pb-1 text-[0.68rem] font-bold uppercase tracking-wider text-gray-400">
          {KIND_LABEL[block.kind] ?? 'Block'}
        </p>
        {text && item('turn', 'Turn into', () => setPage('turn'), { more: true })}
        {item('color', 'Color', () => setPage('color'), { more: true })}
        {text &&
          item('details', detailsOpen ? 'Hide details' : block.details ? 'Show details' : 'Add details', () => onAction({ type: 'details' }), {
            hint: 'Setup, video, diagram',
          })}
        <div className="ne-sep" />
        {item('indent', 'Indent', () => onAction({ type: 'indent' }), { disabled: !can.indent, hint: 'Tab' })}
        {item('outdent', 'Outdent', () => onAction({ type: 'outdent' }), { disabled: !can.outdent, hint: '⇧Tab' })}
        {item('up', 'Move up', () => onAction({ type: 'up' }), { disabled: !can.up, hint: '⌘⇧↑' })}
        {item('down', 'Move down', () => onAction({ type: 'down' }), { disabled: !can.down, hint: '⌘⇧↓' })}
        <div className="ne-sep" />
        {item('below', 'Add a block below', () => onAction({ type: 'below' }))}
        {item('copy', 'Duplicate', () => onAction({ type: 'duplicate' }), { hint: '⌘D' })}
        {item('trash', 'Delete', () => onAction({ type: 'delete' }), { danger: true })}
      </>
    )

  if (sheet) {
    return (
      <div className="fixed inset-0 z-50" role="dialog" aria-label="Block menu">
        <div className="absolute inset-0 bg-black/30" aria-hidden />
        <div
          ref={ref}
          className="ne-menu absolute inset-x-0 bottom-0 max-h-[75vh] overflow-y-auto rounded-b-none p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
          onMouseDown={(e) => e.preventDefault()}
        >
          <div className="mx-auto mb-1 h-1 w-10 rounded-full bg-gray-300" aria-hidden />
          {body}
          <button type="button" className="ne-mi justify-center mt-1 font-semibold text-sm" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    )
  }
  return (
    <div
      ref={ref}
      className="ne-menu absolute z-40 w-64 overflow-y-auto p-1"
      role="menu"
      aria-label="Block menu"
      onMouseDown={(e) => e.preventDefault()}
    >
      {body}
    </div>
  )
}

const TEXTISH = ['text', 'heading', 'todo', 'bullet', 'number', 'toggle', 'quote', 'callout'] as const

function BackRow({ label, onBack }: { label: string; onBack: () => void }) {
  return (
    <button type="button" className="ne-mi" onClick={onBack}>
      <NoteIcon name="back" className="text-gray-500" />
      <span className="text-sm font-bold">{label}</span>
    </button>
  )
}

function Swatch({
  label,
  color,
  tint = false,
  on,
  onClick,
}: {
  label: string
  color?: NoteColor
  tint?: boolean
  on: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${label}${tint ? ' background' : ''}`}
      aria-pressed={on}
      title={label}
      className={`ne-swatch ${on ? 'ne-swatch-on' : ''} ${color ? (tint ? `nt-${color}` : `nc-${color}`) : ''}`}
    >
      <span className="font-black text-sm">A</span>
    </button>
  )
}
