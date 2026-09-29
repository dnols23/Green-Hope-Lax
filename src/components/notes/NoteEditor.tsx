'use client'

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ClipboardEvent,
  type KeyboardEvent,
} from 'react'
import { ChartBlock } from '@/components/planner/ChartBlock'
import { NoteChartView } from '@/components/planner/NoteChartView'
import { imageFromClipboard } from '@/lib/uploadImage'
import {
  LIST_KINDS,
  MAX_BLOCKS,
  NESTABLE,
  emptyNoteBlock,
  isTextBlock,
  normalizeIndents,
  type NoteBlock,
  type NoteBlockKind,
  type NoteTextBlock,
} from '@/lib/noteBlocks'
import {
  canIndent,
  canMoveDown,
  canMoveUp,
  canOutdent,
  duplicateAt,
  firstDifference,
  hasChildren,
  hiddenIds,
  indentAt,
  moveDownAt,
  moveTo,
  moveUpAt,
  numberOf,
  outdentAt,
  progressUnder,
  removeKeepingChildren,
  removeWithChildren,
  subtreeEnd,
  turnInto,
} from '@/lib/noteTree'
import { concatRich, linkAt, plain, safeUrl, sliceRich, toggleMark, type MarkType, type Rich } from '@/lib/noteText'
import { RichText, type FocusRequest, type TypedInfo } from './RichText'
import { caretLine, caretRect, domToRich, getOffsets } from './caret'
import { BlockMenu, ChoiceTile, SlashMenu, filterChoices, BLOCK_CHOICES, type BlockAction, type BlockChoice } from './NoteMenus'
import { BoardBlock, BookmarkBlock, ImageBlock, TableBlock } from './NoteBlockViews'
import { ItemDetails, detailTags } from './ItemDetails'
import { SelectionBar, TouchBar, type SelSpot, type TouchAction } from './NoteToolbars'
import { NoteIcon } from './NoteIcons'

/**
 * A note you write the way you would in Notion.
 *
 * Every line is a block: type "/" for any kind of block, or start a line with
 * "- ", "[] ", "# " and it becomes one. Checklists nest — Tab in, Shift-Tab
 * out — and a parent shows how many of the items under it are done. Any line
 * can open a details panel written out like a drill: setup, how it runs, why,
 * a video and the field drawn. The ⋮⋮ beside a block drags it somewhere else,
 * or opens a menu to change it. Ctrl-Z takes back anything.
 *
 * On a phone there is no hover and no Tab key, so the handle is always there,
 * the block menu comes up from the bottom, and a bar above the keyboard does
 * what the keys would.
 */

interface History {
  past: NoteBlock[][]
  future: NoteBlock[][]
  /** What the last change was, so a run of typing undoes as one. */
  tag: string | null
  at: number
}

interface Slash {
  id: string
  /** Where the "/" is. */
  start: number
  query: string
  index: number
  /** The block was made just to hold this menu, and goes if nothing is picked. */
  made?: boolean
}

interface Drag {
  id: string
  pointerId: number
  x: number
  y: number
}

const UNDO_DEPTH = 150
const CALLOUT_ICONS = ['💡', '⚠️', '✅', '❗', '📌', '🥍', '🔥', '⭐', '⏱️', '🗣️']

const withRich = <B extends NoteTextBlock>(b: B, r: Rich): B => ({
  ...b,
  text: r.text,
  marks: r.marks?.length ? r.marks : undefined,
})

const replaceAt = (list: NoteBlock[], i: number, b: NoteBlock) => list.map((x, j) => (j === i ? b : x))

const indentOf = (d: number) => (d ? { indent: d } : {})

/** A line typed at the start of a block that makes it another kind — "- " a bullet. */
function shortcut(prefix: string): { kind: NoteBlockKind; level?: 1 | 2 | 3; done?: boolean } | null {
  if (prefix === '#') return { kind: 'heading', level: 1 }
  if (prefix === '##') return { kind: 'heading', level: 2 }
  if (prefix === '###') return { kind: 'heading', level: 3 }
  if (/^[-*+•]$/.test(prefix)) return { kind: 'bullet' }
  if (/^\d{1,3}[.)]$/.test(prefix)) return { kind: 'number' }
  if (/^\[ ?\]$/.test(prefix)) return { kind: 'todo' }
  if (/^\[[xX]\]$/.test(prefix)) return { kind: 'todo', done: true }
  // As in Notion: ">" folds (a toggle), and a quotation mark quotes.
  if (prefix === '>') return { kind: 'toggle' }
  if (/^["“”|]$/.test(prefix)) return { kind: 'quote' }
  return null
}

/** Three dashes make a line — or two and the long dash a phone turns two into. */
const DIVIDER = /^(---|—-|-—|___|\*\*\*)$/

/** A pasted line of markdown, as the block it describes. */
function blockFromLine(line: string, base: number): NoteBlock {
  const m = /^([ \t]*)(.*)$/.exec(line) ?? ['', '', line]
  const indent = base + Math.floor(m[1].replace(/\t/g, '  ').length / 2)
  let s = m[2]
  let kind: NoteBlockKind = 'text'
  let level: 1 | 2 | 3 | undefined
  let done = false
  let x: RegExpExecArray | null
  if (DIVIDER.test(s.trim())) return { ...emptyNoteBlock('divider'), ...indentOf(indent) }
  if ((x = /^(?:[-*+]\s+)?\[( |x|X)?\]\s+/.exec(s))) {
    kind = 'todo'
    done = /x/i.test(x[1] ?? '')
    s = s.slice(x[0].length)
  } else if ((x = /^[-*+•]\s+/.exec(s))) {
    kind = 'bullet'
    s = s.slice(x[0].length)
  } else if ((x = /^\d{1,3}[.)]\s+/.exec(s))) {
    kind = 'number'
    s = s.slice(x[0].length)
  } else if ((x = /^(#{1,3})\s+/.exec(s))) {
    kind = 'heading'
    level = x[1].length as 1 | 2 | 3
    s = s.slice(x[0].length)
  } else if ((x = /^>\s+/.exec(s))) {
    kind = 'quote'
    s = s.slice(x[0].length)
  }
  const b = turnInto(emptyNoteBlock('text'), kind, level) as NoteTextBlock
  return { ...b, text: s, ...(kind === 'todo' ? { done } : {}), ...indentOf(indent) } as NoteBlock
}

const ALPHA = 'abcdefghijklmnopqrstuvwxyz'
function roman(n: number): string {
  const table: [number, string][] = [
    [1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'], [100, 'c'], [90, 'xc'],
    [50, 'l'], [40, 'xl'], [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i'],
  ]
  let out = ''
  let left = n
  for (const [v, s] of table) while (left >= v) {
    out += s
    left -= v
  }
  return out
}
/** 1. then a. then i., the way nested numbered lists go. */
const numberLabel = (n: number, depth: number) =>
  depth % 3 === 1 ? `${ALPHA[(n - 1) % 26].repeat(Math.floor((n - 1) / 26) + 1)}.` : depth % 3 === 2 ? `${roman(n)}.` : `${n}.`

const BULLETS = ['•', '◦', '▪']

/** The time of a change, read only from event handlers — it says which keystrokes undo together. */
const clock = () => Date.now()

const PLACEHOLDER: Record<string, string> = {
  heading: 'Heading',
  todo: 'To-do',
  bullet: 'List',
  number: 'List',
  toggle: 'Toggle',
  quote: 'Quote',
  callout: 'Something to stand out',
}

// A phone or a tablet: no hover, and fingers rather than a mouse.
const coarseQuery = '(pointer: coarse)'
function subscribeCoarse(cb: () => void) {
  const m = window.matchMedia(coarseQuery)
  m.addEventListener('change', cb)
  return () => m.removeEventListener('change', cb)
}

/** Where the selection is in this line, in the editor's own coordinates. */
function measureSpot(el: HTMLElement, id: string): SelSpot | null {
  const root = el.closest('[data-note-editor]')
  const sel = window.getSelection()
  const off = getOffsets(el)
  if (!root || !sel || !sel.rangeCount || !off) return null
  const range = sel.getRangeAt(0)
  let rect: DOMRect | null = range.getBoundingClientRect()
  if (!rect || (!rect.width && !rect.height)) rect = caretRect(el) ?? el.getBoundingClientRect()
  const box = root.getBoundingClientRect()
  return {
    id,
    start: off.start,
    end: off.end,
    x: rect.left + rect.width / 2 - box.left,
    top: rect.top - box.top,
    bottom: rect.bottom - box.top,
  }
}

export function NoteEditor({
  blocks,
  onChange,
  readOnly = false,
}: {
  blocks: NoteBlock[]
  onChange: (next: NoteBlock[]) => void
  readOnly?: boolean
}) {
  const [hist, setHist] = useState<History>({ past: [], future: [], tag: null, at: 0 })
  const [focus, setFocus] = useState<FocusRequest | null>(null)
  const [slash, setSlash] = useState<Slash | null>(null)
  const [menuId, setMenuId] = useState<string | null>(null)
  const [drag, setDrag] = useState<Drag | null>(null)
  /** Which lines have their details open. */
  const [opened, setOpened] = useState<string[]>([])
  /** A block just made from the menu — a field opens itself, a link box takes the caret. */
  const [fresh, setFresh] = useState<string | null>(null)
  /** The line being typed on. */
  const [active, setActive] = useState<string | null>(null)
  const [spot, setSpot] = useState<SelSpot | null>(null)
  const [linking, setLinking] = useState<{ spot: SelSpot; href: string } | null>(null)
  /** Pictures on their way up, by block. */
  const [files, setFiles] = useState<Record<string, File>>({})
  const [uploadErrors, setUploadErrors] = useState<Record<string, string>>({})
  const coarse = useSyncExternalStore(subscribeCoarse, () => window.matchMedia(coarseQuery).matches, () => false)
  const rootRef = useRef<HTMLDivElement>(null)
  // Whether the last click or tap was in here, so Ctrl-Z on an empty page undoes here.
  const touched = useRef(false)

  const hidden = useMemo(() => hiddenIds(blocks), [blocks])
  const at = (id: string) => blocks.findIndex((b) => b.id === id)

  const ask = (id: string, where: FocusRequest['at'], more: Partial<FocusRequest> = {}) =>
    setFocus((f) => ({ id, at: where, ...more, n: (f?.n ?? 0) + 1 }))

  /** Every change goes through here, so every change can be undone. */
  function commit(next: NoteBlock[], tag: string | null = null) {
    const now = clock()
    const same = tag !== null && hist.tag === tag && now - hist.at < 1500
    setHist({ past: same ? hist.past : [...hist.past, blocks].slice(-UNDO_DEPTH), future: [], tag, at: now })
    onChange(next)
  }

  function undo(redo = false) {
    const from = redo ? hist.future : hist.past
    if (!from.length) return
    const target = redo ? from[0] : from[from.length - 1]
    setHist(
      redo
        ? { past: [...hist.past, blocks], future: hist.future.slice(1), tag: null, at: 0 }
        : { past: hist.past.slice(0, -1), future: [blocks, ...hist.future].slice(0, UNDO_DEPTH), tag: null, at: 0 }
    )
    onChange(target)
    setSlash(null)
    setMenuId(null)
    setLinking(null)
    const k = firstDifference(blocks, target)
    const b = target[Math.max(0, Math.min(k, target.length - 1))]
    if (b && isTextBlock(b)) ask(b.id, 'end')
  }

  const patch = (id: string, next: Partial<NoteBlock>, tag: string | null = null) =>
    commit(blocks.map((b) => (b.id === id ? ({ ...b, ...next } as NoteBlock) : b)), tag)

  /** The nearest line above or below that can be typed on and can be seen. */
  function neighbour(id: string, dir: 1 | -1): NoteTextBlock | null {
    for (let i = at(id) + dir; i >= 0 && i < blocks.length; i += dir) {
      const b = blocks[i]
      if (!hidden.has(b.id) && isTextBlock(b)) return b
    }
    return null
  }
  /** The block right above or below on screen, whatever kind it is. */
  function beside(i: number, dir: 1 | -1): NoteBlock | null {
    for (let j = i + dir; j >= 0 && j < blocks.length; j += dir) if (!hidden.has(blocks[j].id)) return blocks[j]
    return null
  }

  // ── Typing ──

  function typed(b: NoteTextBlock, rich: Rich, info: TypedInfo) {
    const i = at(b.id)
    if (i < 0) return
    const c = info.caret

    if (info.inputType === 'insertText' && c !== null) {
      // "- ", "[] ", "# " … at the very start of a line.
      if ((info.data === ' ' || info.data === ' ') && rich.text[c - 1] === ' ') {
        const sc = shortcut(rich.text.slice(0, c - 1))
        const same = sc && sc.kind === b.kind && (b.kind !== 'heading' || sc.level === (b.level ?? 2))
        if (sc && !same) {
          let turned = turnInto(withRich(b, sliceRich(rich, c)), sc.kind, sc.level)
          if (turned.kind === 'todo' && sc.done) turned = { ...turned, done: true }
          setSlash(null)
          commit(replaceAt(blocks, i, turned))
          ask(b.id, 0)
          return
        }
      }
      if (DIVIDER.test(rich.text) && c === rich.text.length) {
        const para = { ...emptyNoteBlock('text'), ...indentOf(b.indent ?? 0) }
        setSlash(null)
        commit(normalizeIndents([...blocks.slice(0, i), turnInto(b, 'divider'), para, ...blocks.slice(i + 1)]))
        ask(para.id, 'start')
        return
      }
    }

    // The "/" menu opens on a slash at the start of a line or after a space,
    // and narrows with every letter after it.
    let s = slash
    if (info.inputType === 'insertText' && info.data === '/' && c !== null && (c === 1 || /\s/.test(rich.text[c - 2]))) {
      s = { id: b.id, start: c - 1, query: '', index: 0 }
    } else if (s && s.id === b.id) {
      if (c === null || c <= s.start || rich.text[s.start] !== '/') s = null
      else {
        const q = rich.text.slice(s.start + 1, c)
        s = q.length > 24 || q.includes('\n') || (!filterChoices(q).length && /\s$/.test(q)) ? null : { ...s, query: q, index: 0 }
      }
    }
    if (s !== slash) setSlash(s)
    commit(replaceAt(blocks, i, withRich(b, rich)), `type:${b.id}`)
  }

  /** Return: a new line of the same kind, or out of a list from an empty item. */
  function enter(el: HTMLElement, b: NoteTextBlock) {
    setSlash(null)
    const i = at(b.id)
    if (i < 0) return
    const rich = domToRich(el)
    const len = rich.text.length
    const off = getOffsets(el) ?? { start: len, end: len }
    const d = b.indent ?? 0

    if (LIST_KINDS.has(b.kind) && !rich.text) {
      // An empty item steps out a level; at the left edge it stops being a list.
      commit(d > 0 ? outdentAt(blocks, i) : replaceAt(blocks, i, turnInto(b, 'text')))
      ask(b.id, 0)
      return
    }
    if (off.start === 0 && off.end === 0 && rich.text) {
      // At the very start: an empty line opens above, and the caret stays put.
      const above = { ...turnInto(emptyNoteBlock('text'), LIST_KINDS.has(b.kind) ? b.kind : 'text'), ...indentOf(d) }
      commit(normalizeIndents([...blocks.slice(0, i), above, ...blocks.slice(i)]))
      ask(b.id, 0)
      return
    }

    const before = sliceRich(rich, 0, off.start)
    const after = sliceRich(rich, off.end)
    const kids = hasChildren(blocks, i)
    let kind: NoteBlockKind = b.kind
    if (b.kind === 'heading') kind = 'text'
    if ((b.kind === 'quote' || b.kind === 'callout') && !after.text) kind = 'text'
    let pos = i + 1
    let indent = d
    if (b.kind === 'toggle' && !b.collapsed && !after.text) {
      // Return at the end of an open toggle writes inside it.
      indent = d + 1
      kind = 'text'
    } else if (kids && !b.collapsed) {
      // An item with sub-items showing: the new line is the first of them.
      indent = d + 1
    } else if (kids) {
      // Folded: the new line goes after everything tucked inside.
      pos = subtreeEnd(blocks, i)
    }
    const made = { ...withRich(turnInto(emptyNoteBlock('text'), kind) as NoteTextBlock, after), ...indentOf(indent) }
    const next = [...blocks.slice(0, i), withRich(b, before), ...blocks.slice(i + 1, pos), made, ...blocks.slice(pos)]
    commit(normalizeIndents(next))
    ask(made.id, 0)
  }

  /**
   * Backspace with the caret at the very start. Returns whether it did
   * something, so the browser does not do it too.
   */
  function backspace(el: HTMLElement, b: NoteTextBlock): boolean {
    setSlash(null)
    const i = at(b.id)
    if (i < 0) return false
    const rich = domToRich(el)
    const prev = beside(i, -1)

    if (b.kind !== 'text' && (rich.text || !LIST_KINDS.has(b.kind))) {
      // A heading, quote or to-do with words in it turns back into a plain line first.
      commit(replaceAt(blocks, i, turnInto(withRich(b, rich), 'text')))
      ask(b.id, 0)
      return true
    }
    if (!rich.text) {
      // An empty line goes, and the caret goes to the end of the one above.
      if (!prev) return true
      const up = isTextBlock(prev) ? prev : neighbour(b.id, -1)
      commit(removeKeepingChildren(blocks, i))
      setOpened((o) => o.filter((x) => x !== b.id))
      if (up) ask(up.id, 'end')
      return true
    }
    if (!prev) return true
    if (prev.kind === 'divider') {
      commit(removeKeepingChildren(blocks, at(prev.id)))
      ask(b.id, 0)
      return true
    }
    // A field or a picture above: there is nothing to join onto.
    if (!isTextBlock(prev)) return true
    // Two sets of details cannot become one line's; step up instead of losing one.
    if (b.details && prev.details) {
      ask(prev.id, 'end')
      return true
    }
    const pi = at(prev.id)
    const joined = { ...withRich(prev, concatRich(prev, rich)), ...(b.details && !prev.details ? { details: b.details } : {}) }
    commit(removeKeepingChildren(replaceAt(blocks, pi, joined), i))
    ask(prev.id, prev.text.length)
    return true
  }

  /** Delete at the very end: the line below joins this one. */
  function deleteForward(el: HTMLElement, b: NoteTextBlock): boolean {
    const i = at(b.id)
    const next = beside(i, 1)
    if (!next) return false
    if (next.kind === 'divider') {
      commit(removeKeepingChildren(blocks, at(next.id)))
      ask(b.id, 'end')
      return true
    }
    if (!isTextBlock(next) || (b.details && next.details)) return false
    const rich = domToRich(el)
    const joined = { ...withRich(b, concatRich(rich, next)), ...(next.details && !b.details ? { details: next.details } : {}) }
    commit(removeKeepingChildren(replaceAt(blocks, i, joined), at(next.id)))
    ask(b.id, rich.text.length)
    return true
  }

  function indentKey(b: NoteBlock, out: boolean, caret: number | 'end') {
    const i = at(b.id)
    const next = out ? outdentAt(blocks, i) : indentAt(blocks, i)
    if (next !== blocks) commit(next)
    if (isTextBlock(b)) ask(b.id, caret)
  }

  function applyFormat(id: string, start: number, end: number, type: MarkType, from?: Rich) {
    const i = at(id)
    const b = blocks[i]
    if (!b || !isTextBlock(b) || end <= start) return
    commit(replaceAt(blocks, i, withRich(b, toggleMark(from ?? b, start, end, type))))
    ask(id, start, { end })
  }

  const EXEC: Record<string, string> = { b: 'bold', i: 'italic', u: 'underline', s: 'strikeThrough' }

  /** Ctrl-B and friends, and the same from a toolbar button. */
  function formatKey(el: HTMLElement, b: NoteTextBlock, type: MarkType) {
    const off = getOffsets(el)
    if (!off) return
    if (type === 'a') {
      const s = measureSpot(el, b.id)
      if (s) setLinking({ spot: s, href: linkAt(b, off.start, off.end)?.href ?? '' })
      return
    }
    if (off.start === off.end) {
      // Nothing selected: what is typed next is bold, as in any editor.
      if (EXEC[type]) document.execCommand(EXEC[type])
      return
    }
    applyFormat(b.id, off.start, off.end, type, domToRich(el))
  }

  function saveLink(href: string | null) {
    const l = linking
    if (!l) return
    setLinking(null)
    const i = at(l.spot.id)
    const b = blocks[i]
    if (!b || !isTextBlock(b)) return
    let { start, end } = l.spot
    const existing = linkAt(b, start, end)
    if (start === end && existing) {
      start = existing.start
      end = existing.end
    }
    const url = href ? safeUrl(href) : null
    if (href && !url) {
      ask(b.id, start, { end })
      return
    }
    let r: Rich
    if (start === end) {
      // Nothing selected: the link goes in as its own words.
      if (!url) {
        ask(b.id, start)
        return
      }
      r = concatRich(concatRich(sliceRich(b, 0, start), { text: url, marks: [{ type: 'a', start: 0, end: url.length, href: url }] }), sliceRich(b, start))
      end = start + url.length
    } else {
      r = toggleMark(b, start, end, 'a', url)
    }
    commit(replaceAt(blocks, i, withRich(b, r)))
    ask(b.id, end)
  }

  function keyDown(e: KeyboardEvent<HTMLDivElement>, b: NoteTextBlock) {
    if (e.nativeEvent.isComposing || e.keyCode === 229) return
    const el = e.currentTarget
    const mod = e.metaKey || e.ctrlKey

    if (slash && slash.id === b.id) {
      const items = filterChoices(slash.query)
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        if (items.length) setSlash({ ...slash, index: (slash.index + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length })
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        const c = items[slash.index]
        if (c) pick(c)
        else setSlash(null)
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        closeSlash()
        return
      }
    }

    if (mod && !e.altKey) {
      const k = e.key.toLowerCase()
      const type: MarkType | null =
        k === 'b' ? 'b' : k === 'i' ? 'i' : k === 'u' ? 'u' : k === 'e' ? 'code' : k === 'k' ? 'a' : k === 's' && e.shiftKey ? 's' : null
      if (type) {
        e.preventDefault()
        formatKey(el, b, type)
        return
      }
      if (k === 'd') {
        e.preventDefault()
        act(b.id, { type: 'duplicate' })
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        const i = at(b.id)
        if (b.kind === 'todo') patch(b.id, { done: !b.done })
        else if (b.kind === 'toggle' || hasChildren(blocks, i)) patch(b.id, { collapsed: b.collapsed ? undefined : true })
        return
      }
      if (e.shiftKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault()
        act(b.id, { type: e.key === 'ArrowUp' ? 'up' : 'down' }, getOffsets(el)?.start)
        return
      }
    }

    switch (e.key) {
      case 'Tab':
        e.preventDefault()
        indentKey(b, e.shiftKey, getOffsets(el)?.start ?? 'end')
        return
      case 'Enter':
        e.preventDefault()
        if (e.shiftKey) document.execCommand('insertLineBreak')
        else enter(el, b)
        return
      case 'Backspace': {
        const off = getOffsets(el)
        if (off && off.start === 0 && off.end === 0 && backspace(el, b)) e.preventDefault()
        return
      }
      case 'Delete': {
        const off = getOffsets(el)
        const len = domToRich(el).text.length
        if (off && off.start === len && off.end === len && deleteForward(el, b)) e.preventDefault()
        return
      }
      case 'ArrowUp':
      case 'ArrowDown': {
        if (e.shiftKey || mod || e.altKey) return
        const up = e.key === 'ArrowUp'
        const line = caretLine(el)
        if (up ? !line.first : !line.last) return
        const n = neighbour(b.id, up ? -1 : 1)
        if (!n) return
        e.preventDefault()
        const r = caretRect(el)
        ask(n.id, up ? 'end' : 'start', r ? { x: r.left, line: up ? 'last' : 'first' } : {})
        return
      }
      case 'ArrowLeft':
      case 'ArrowRight': {
        if (e.shiftKey || mod || e.altKey) return
        const off = getOffsets(el)
        if (!off || off.start !== off.end) return
        const left = e.key === 'ArrowLeft'
        if (left ? off.start !== 0 : off.end !== domToRich(el).text.length) return
        const n = neighbour(b.id, left ? -1 : 1)
        if (!n) return
        e.preventDefault()
        ask(n.id, left ? 'end' : 'start')
        return
      }
      case 'Escape':
        el.blur()
        setSlash(null)
        return
    }
  }

  function paste(e: ClipboardEvent<HTMLDivElement>, b: NoteTextBlock) {
    const el = e.currentTarget
    const i = at(b.id)
    const img = imageFromClipboard(e.clipboardData)
    if (img) {
      // A picture pasted into a line becomes a picture block below it (or in place of an empty line).
      e.preventDefault()
      const pic = { ...emptyNoteBlock('image'), ...indentOf(b.indent ?? 0) }
      const pos = subtreeEnd(blocks, i)
      const next = [...blocks.slice(0, pos), pic, ...blocks.slice(pos)]
      commit(normalizeIndents(b.text ? next : next.filter((x) => x.id !== b.id)))
      setFiles((f) => ({ ...f, [pic.id]: img }))
      return
    }
    // Only the words come in — never somebody else's formatting or markup.
    e.preventDefault()
    const words = e.clipboardData.getData('text/plain').replace(/\r\n?/g, '\n')
    if (!words) return
    const rich = domToRich(el)
    const off = getOffsets(el) ?? { start: rich.text.length, end: rich.text.length }
    const lines = words.split('\n')
    if (lines.length === 1) {
      const url = /^https?:\/\/\S+$/i.test(words.trim()) ? safeUrl(words.trim()) : null
      if (url && off.end > off.start) {
        // A link pasted over selected words links them.
        commit(replaceAt(blocks, i, withRich(b, toggleMark(rich, off.start, off.end, 'a', url))))
        ask(b.id, off.end)
        return
      }
      const piece: Rich = url ? { text: words, marks: [{ type: 'a', start: 0, end: words.length, href: url }] } : plain(words)
      commit(replaceAt(blocks, i, withRich(b, concatRich(concatRich(sliceRich(rich, 0, off.start), piece), sliceRich(rich, off.end)))))
      ask(b.id, off.start + words.length)
      return
    }
    // Several lines: one block each, and "- ", "1. ", "[ ] " and "# " understood.
    const room = Math.max(0, MAX_BLOCKS - blocks.length)
    const rest = lines.slice(1, 1 + room).map((l) => blockFromLine(l, b.indent ?? 0))
    const tail = sliceRich(rich, off.end)
    const head = concatRich(sliceRich(rich, 0, off.start), plain(lines[0]))
    let first: NoteBlock = withRich(b, head)
    if (!rich.text) {
      // Pasted into an empty line, the first line decides what kind it is too.
      const made = blockFromLine(lines[0], b.indent ?? 0)
      first = { ...made, id: b.id, ...(isTextBlock(made) && b.details ? { details: b.details } : {}) } as NoteBlock
    }
    const last = rest[rest.length - 1]
    const lastEnd = last && isTextBlock(last) ? last.text.length : 0
    const made = rest.map((x) => (x === last && isTextBlock(x) ? withRich(x, concatRich(x, tail)) : x))
    commit(normalizeIndents([...blocks.slice(0, i), first, ...made, ...blocks.slice(i + 1)]))
    if (last && isTextBlock(last)) ask(last.id, lastEnd)
  }

  // ── The "/" menu ──

  function pick(c: BlockChoice) {
    const s = slash
    if (!s) return
    setSlash(null)
    const i = at(s.id)
    const b = blocks[i]
    if (!b || !isTextBlock(b)) return
    const upto = Math.min(b.text.length, s.start + 1 + s.query.length)
    const cleaned = withRich(b, concatRich(sliceRich(b, 0, s.start), sliceRich(b, upto)))

    if (!cleaned.text.trim()) {
      // An empty line becomes the block.
      const t = turnInto(cleaned, c.kind, c.level)
      if (t.kind === 'divider') {
        const para = { ...emptyNoteBlock('text'), ...indentOf(b.indent ?? 0) }
        commit(normalizeIndents([...blocks.slice(0, i), t, para, ...blocks.slice(i + 1)]))
        ask(para.id, 'start')
        return
      }
      commit(replaceAt(blocks, i, t))
      if (isTextBlock(t)) ask(t.id, 'end')
      else setFresh(t.id)
      return
    }
    // A line with words on it keeps them, and the new block goes below.
    const made = { ...turnInto(emptyNoteBlock('text'), c.kind, c.level), ...indentOf(b.indent ?? 0) }
    const pos = subtreeEnd(blocks, i)
    commit(normalizeIndents(replaceAt([...blocks.slice(0, pos), made, ...blocks.slice(pos)], i, cleaned)))
    if (isTextBlock(made)) ask(made.id, 'start')
    else setFresh(made.id)
  }

  function closeSlash() {
    const s = slash
    setSlash(null)
    if (!s?.made) return
    // A line made only to hold the menu goes again if nothing was picked.
    const i = at(s.id)
    const b = blocks[i]
    if (b && isTextBlock(b) && b.text.trim() === `/${s.query}`.trim()) commit(removeKeepingChildren(blocks, i))
  }

  /** A new line below this block (and below anything under it), with the "/" menu open. */
  function addBelow(i: number) {
    const b = blocks[i]
    const pos = b ? subtreeEnd(blocks, i) : blocks.length
    const nb = { ...emptyNoteBlock('text'), text: '/', ...indentOf(b?.indent ?? 0) } as NoteBlock
    commit(normalizeIndents([...blocks.slice(0, pos), nb, ...blocks.slice(pos)]))
    ask(nb.id, 1)
    setSlash({ id: nb.id, start: 0, query: '', index: 0, made: true })
  }

  /** Start the note with a kind of block, from the empty page. */
  function begin(kind: NoteBlockKind, level?: 1 | 2 | 3) {
    const b = turnInto(emptyNoteBlock('text'), kind, level)
    commit([...blocks, b])
    if (isTextBlock(b)) ask(b.id, 'start')
    else setFresh(b.id)
  }

  /** A click on the space under the last block writes there. */
  function clickTail() {
    const last = blocks[blocks.length - 1]
    if (last && last.kind === 'text' && !last.text && !hidden.has(last.id)) {
      ask(last.id, 'start')
      return
    }
    const b = emptyNoteBlock('text')
    commit([...blocks, b])
    ask(b.id, 'start')
  }

  // ── The block menu ──

  function toggleDetails(id: string) {
    setOpened((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id]))
  }

  function act(id: string, a: BlockAction, caret?: number) {
    const i = at(id)
    if (i < 0) return
    const b = blocks[i]
    setMenuId(null)
    const refocus = () => {
      if (isTextBlock(b)) ask(id, caret ?? 'end')
    }
    switch (a.type) {
      case 'turn': {
        const t = turnInto(b, a.choice.kind, a.choice.level)
        commit(replaceAt(blocks, i, t))
        if (isTextBlock(t)) ask(id, 'end')
        return
      }
      case 'color':
      case 'tint': {
        const next = { ...b, [a.type]: a.color ?? undefined } as NoteBlock
        commit(replaceAt(blocks, i, next))
        return
      }
      case 'duplicate': {
        const r = duplicateAt(blocks, i)
        commit(r.blocks)
        if (isTextBlock(b)) ask(r.id, 'end')
        return
      }
      case 'delete': {
        const up = neighbour(id, -1)
        commit(removeWithChildren(blocks, i))
        setOpened((o) => o.filter((x) => x !== id))
        if (up) ask(up.id, 'end')
        return
      }
      case 'up':
        commit(moveUpAt(blocks, i))
        refocus()
        return
      case 'down':
        commit(moveDownAt(blocks, i))
        refocus()
        return
      case 'indent':
      case 'outdent':
        indentKey(b, a.type === 'outdent', caret ?? 'end')
        return
      case 'details':
        toggleDetails(id)
        return
      case 'below':
        addBelow(i)
        return
    }
  }

  function touch(a: TouchAction) {
    const id = active
    if (!id) return
    const i = at(id)
    const b = blocks[i]
    if (!b || !isTextBlock(b)) return
    const focused = document.activeElement as HTMLElement | null
    const el = focused?.dataset?.rt === id ? focused : null
    const caret = el ? getOffsets(el)?.start ?? 0 : 0
    switch (a) {
      case 'block':
        if (!b.text && el) document.execCommand('insertText', false, '/')
        else addBelow(i)
        return
      case 'todo':
        commit(replaceAt(blocks, i, turnInto(b, b.kind === 'todo' ? 'text' : 'todo')))
        ask(id, caret)
        return
      case 'indent':
      case 'outdent':
        indentKey(b, a === 'outdent', caret)
        return
      case 'undo':
      case 'redo':
        undo(a === 'redo')
        return
      case 'b':
      case 'i':
      case 's':
        if (el) formatKey(el, b, a)
        return
      case 'link':
        if (el) formatKey(el, b, 'a')
        return
      case 'details':
        toggleDetails(id)
        return
      case 'up':
      case 'down':
        act(id, { type: a }, caret)
        return
      case 'done':
        el?.blur()
        setActive(null)
        return
    }
  }

  function uploaded(id: string, res: { url?: string; error?: string }) {
    setFiles((f) => {
      const next = { ...f }
      delete next[id]
      return next
    })
    if (res.url) patch(id, { url: res.url })
    else setUploadErrors((x) => ({ ...x, [id]: res.error ?? 'That picture would not save.' }))
  }

  // ── Effects: the selection, dragging, and undo from anywhere on the page ──

  const latest = useRef({ blocks, hidden, commit, undo })
  useEffect(() => {
    latest.current = { blocks, hidden, commit, undo }
  })

  // Where the selection is, for the formatting bar.
  useEffect(() => {
    if (readOnly) return
    const onSelect = () => {
      const root = rootRef.current
      const sel = window.getSelection()
      if (!root || !sel || !sel.rangeCount) {
        setSpot(null)
        return
      }
      const node = sel.getRangeAt(0).startContainer
      const el = (node.nodeType === 1 ? (node as Element) : node.parentElement)?.closest<HTMLElement>('[data-rt]')
      const next = el && root.contains(el) ? measureSpot(el, el.dataset.rt ?? '') : null
      setSpot((p) =>
        p && next && p.id === next.id && p.start === next.start && p.end === next.end && Math.abs(p.top - next.top) < 1 && Math.abs(p.x - next.x) < 1
          ? p
          : next
      )
    }
    document.addEventListener('selectionchange', onSelect)
    return () => document.removeEventListener('selectionchange', onSelect)
  }, [readOnly])

  // Ctrl-Z with nothing focused, after working in here, still undoes here.
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      const k = e.key.toLowerCase()
      if (!(e.metaKey || e.ctrlKey) || (k !== 'z' && k !== 'y')) return
      const t = document.activeElement
      if ((t && t !== document.body) || !touched.current) return
      e.preventDefault()
      latest.current.undo(e.shiftKey || k === 'y')
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  /* Dragging a block by its handle. The block (and everything under it) follows
     the finger, a line shows where it will land, and the page scrolls at the
     top and bottom edges. A handle let go without moving opens the menu
     instead — one handle, two jobs, as in Notion. Pointer events, so it works
     on an iPhone; the handle alone has touch-action: none. */
  useEffect(() => {
    if (!drag) return
    const root = rootRef.current
    const { blocks: list, hidden: hid } = latest.current
    const i = list.findIndex((b) => b.id === drag.id)
    if (!root || i < 0) return
    const moving = new Set(list.slice(i, subtreeEnd(list, i)).map((b) => b.id))
    const rowOf = (id: string) => root.querySelector<HTMLElement>(`[data-row="${CSS.escape(id)}"]`)
    const movingEls = [...moving].map(rowOf).filter((x): x is HTMLElement => !!x)
    const others = list
      .filter((b) => !moving.has(b.id) && !hid.has(b.id))
      .map((b) => ({ b, el: rowOf(b.id) }))
      .filter((o): o is { b: NoteBlock; el: HTMLElement } => !!o.el)
    const spots = others.map((o) => {
      const r = o.el.getBoundingClientRect()
      return { top: r.top + window.scrollY, mid: r.top + window.scrollY + r.height / 2, bottom: r.bottom + window.scrollY }
    })
    const line = root.querySelector<HTMLElement>('[data-drop-line]')
    const startScroll = window.scrollY
    let y = drag.y
    let moved = false
    let gap = 0
    let raf = 0
    let over = false

    const target = () => {
      const above = others[gap - 1]?.b
      const below = others[gap]?.b
      const max = above ? (above.indent ?? 0) + (NESTABLE.has(above.kind) && !above.collapsed ? 1 : 0) : 0
      const want = below ? below.indent ?? 0 : above ? above.indent ?? 0 : 0
      return { beforeId: below?.id ?? null, indent: Math.max(0, Math.min(want, max)) }
    }
    const paint = () => {
      const py = y + window.scrollY
      gap = spots.filter((s) => s.mid < py).length
      const dy = y - drag.y + (window.scrollY - startScroll)
      for (const el of movingEls) {
        el.style.transform = `translateY(${dy}px)`
        el.style.opacity = '0.6'
        el.style.zIndex = '30'
        el.style.pointerEvents = 'none'
      }
      if (line) {
        const rootTop = root.getBoundingClientRect().top + window.scrollY
        const ly = gap < spots.length ? spots[gap].top : spots[spots.length - 1]?.bottom ?? rootTop
        line.style.display = 'block'
        line.style.top = `${ly - rootTop - 2}px`
        line.style.left = `calc(var(--ne-gutter) + var(--ne-step) * ${target().indent})`
      }
    }
    const reset = () => {
      for (const el of movingEls) {
        el.style.transform = ''
        el.style.opacity = ''
        el.style.zIndex = ''
        el.style.pointerEvents = ''
      }
      if (line) line.style.display = 'none'
    }
    const edge = () => {
      if (moved) {
        const vh = window.visualViewport?.height ?? window.innerHeight
        const speed = y < 72 ? -Math.ceil((72 - y) / 5) : y > vh - 72 ? Math.ceil((y - (vh - 72)) / 5) : 0
        if (speed) {
          window.scrollBy(0, speed)
          paint()
        }
      }
      raf = requestAnimationFrame(edge)
    }
    const move = (e: PointerEvent) => {
      if (e.pointerId !== drag.pointerId) return
      y = e.clientY
      if (!moved && Math.abs(e.clientY - drag.y) + Math.abs(e.clientX - drag.x) > 5) moved = true
      if (moved) paint()
    }
    const finish = (e: PointerEvent) => {
      if (e.pointerId !== drag.pointerId || over) return
      over = true
      stop()
      reset()
      setDrag(null)
      const now = latest.current
      if (e.type === 'pointercancel') return
      if (!moved) {
        setMenuId(drag.id)
        return
      }
      const t = target()
      const next = moveTo(now.blocks, drag.id, t.beforeId, t.indent)
      if (next !== now.blocks) now.commit(next)
    }
    const stop = () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', finish)
      window.removeEventListener('pointercancel', finish)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', finish)
    window.addEventListener('pointercancel', finish)
    raf = requestAnimationFrame(edge)
    return () => {
      stop()
      reset()
    }
  }, [drag])

  // ── Drawing ──

  const menuBlock = menuId ? blocks.find((b) => b.id === menuId) ?? null : null
  const menuIndex = menuBlock ? at(menuBlock.id) : -1
  const spotBlock = spot ? blocks.find((b) => b.id === spot.id) : undefined
  const barBlock = linking ? blocks.find((b) => b.id === linking.spot.id) : spotBlock
  const showBar =
    !readOnly &&
    !drag &&
    !slash &&
    !!barBlock &&
    isTextBlock(barBlock) &&
    (!!linking ||
      (!!spot && ((!coarse && spot.end > spot.start) || (spot.end === spot.start && !!linkAt(barBlock, spot.start, spot.end)))))
  const activeIndex = active ? at(active) : -1
  const activeBlock = activeIndex >= 0 ? blocks[activeIndex] : null

  function textRow(b: NoteTextBlock, i: number) {
    const d = b.indent ?? 0
    const kids = hasChildren(blocks, i)
    const prog = kids ? progressUnder(blocks, i) : null
    const tags = detailTags(b.details)
    const open = opened.includes(b.id)
    const under = kids ? subtreeEnd(blocks, i) - i - 1 : 0

    let marker = null
    if (b.kind === 'todo') {
      marker = (
        <button
          type="button"
          role="checkbox"
          aria-checked={b.done}
          aria-label={b.done ? 'Done — untick it' : 'Tick it off'}
          disabled={readOnly}
          className="ne-marker ne-check"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => patch(b.id, { done: !b.done })}
        >
          <span className="ne-box" data-on={b.done ? '' : undefined}>
            {b.done && (
              <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden>
                <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </span>
        </button>
      )
    } else if (b.kind === 'bullet') {
      marker = <span className="ne-marker ne-bullet" aria-hidden>{BULLETS[d % 3]}</span>
    } else if (b.kind === 'number') {
      marker = <span className="ne-marker ne-num" aria-hidden>{numberLabel(numberOf(blocks, i), d)}</span>
    } else if (b.kind === 'toggle') {
      marker = (
        <button
          type="button"
          className="ne-marker ne-tri"
          aria-expanded={!b.collapsed}
          aria-label={b.collapsed ? 'Open' : 'Fold away'}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => patch(b.id, { collapsed: b.collapsed ? undefined : true })}
        >
          <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden>
            <path d="M5 3l6 5-6 5z" fill="currentColor" />
          </svg>
        </button>
      )
    } else if (b.kind === 'callout') {
      marker = (
        <button
          type="button"
          className="ne-marker ne-icon"
          aria-label="Change the icon"
          disabled={readOnly}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            const k = CALLOUT_ICONS.indexOf(b.icon ?? '💡')
            patch(b.id, { icon: CALLOUT_ICONS[(k + 1) % CALLOUT_ICONS.length] })
          }}
        >
          {b.icon ?? '💡'}
        </button>
      )
    }

    const cls = [
      'ne-line',
      `ne-k-${b.kind}`,
      b.kind === 'heading' ? `ne-h${b.level ?? 2}` : '',
      b.kind === 'todo' && b.done ? 'ne-done' : '',
      b.color ? `nc-${b.color}` : '',
      b.tint ? `nt-${b.tint}` : '',
    ].join(' ')

    return (
      <>
        <div className={cls}>
          {marker}
          <RichText
            id={b.id}
            value={b}
            focus={focus?.id === b.id ? focus : null}
            readOnly={readOnly}
            placeholder={b.kind === 'heading' ? `Heading ${b.level ?? 2}` : PLACEHOLDER[b.kind] ?? (coarse ? 'Write, or tap + for blocks' : "Write, or type '/' for blocks")}
            alwaysHint={b.kind !== 'text'}
            className="flex-1 min-w-0"
            onTyped={(r, info) => typed(b, r, info)}
            onKeyDown={(e) => keyDown(e, b)}
            onPaste={(e) => paste(e, b)}
            onFocus={() => setActive(b.id)}
            onBlur={() => setActive((x) => (x === b.id ? null : x))}
            onEnter={(el) => enter(el, b)}
            onBackspace={(el) => backspace(el, b)}
            onUndo={(redo) => undo(redo)}
          />
          {kids && (b.kind !== 'toggle' || !!prog?.total) && (
            <button
              type="button"
              className={`ne-chip ${prog?.total && prog.done === prog.total ? 'ne-chip-done' : ''}`}
              aria-expanded={!b.collapsed}
              aria-label={`${prog?.total ? `${prog.done} of ${prog.total} done. ` : ''}${b.collapsed ? 'Show' : 'Hide'} what is under it`}
              title={b.collapsed ? 'Show what is under it' : 'Fold it away'}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => b.kind !== 'toggle' && patch(b.id, { collapsed: b.collapsed ? undefined : true })}
            >
              {b.kind !== 'toggle' && <span aria-hidden>{b.collapsed ? '▸' : '▾'}</span>}
              {prog?.total ? `${prog.done}/${prog.total}` : b.collapsed ? `${under} more` : ''}
            </button>
          )}
          {tags.length > 0 || open ? (
            <button
              type="button"
              className={`ne-chip ne-chip-on ${open ? 'ne-chip-open' : ''}`}
              aria-expanded={open}
              aria-label={open ? 'Hide details' : `Details: ${tags.join(', ')}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => toggleDetails(b.id)}
            >
              <NoteIcon name="details" size={13} />
              <span className="ne-chip-words">{tags.length ? tags.join(' · ') : 'Details'}</span>
            </button>
          ) : (
            b.kind === 'todo' &&
            !readOnly && (
              <button
                type="button"
                className="ne-add-details"
                aria-label="Add details — setup, how it runs, a video, a diagram"
                title="Add details"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => toggleDetails(b.id)}
              >
                <NoteIcon name="details" size={16} />
              </button>
            )
          )}
        </div>
        {open && (
          <ItemDetails
            details={b.details}
            title={b.text}
            readOnly={readOnly}
            onChange={(details) => patch(b.id, { details }, `details:${b.id}`)}
            onClose={() => toggleDetails(b.id)}
          />
        )}
      </>
    )
  }

  function otherRow(b: NoteBlock) {
    switch (b.kind) {
      case 'divider':
        return (
          <div className="ne-divider" role="separator">
            <hr />
          </div>
        )
      case 'board':
        return <BoardBlock block={b} startOpen={fresh === b.id} readOnly={readOnly} onPatch={(n) => patch(b.id, n, `board:${b.id}`)} />
      case 'chart':
        return readOnly ? <NoteChartView chart={b} /> : <ChartBlock block={b} onChange={(n) => patch(b.id, n, `chart:${b.id}`)} />
      case 'image':
        return (
          <ImageBlock
            block={b}
            file={files[b.id] ?? null}
            error={uploadErrors[b.id] ?? null}
            autoFocus={fresh === b.id}
            readOnly={readOnly}
            onPatch={(n) => patch(b.id, n, `image:${b.id}`)}
            onFile={(f) => {
              setUploadErrors((x) => ({ ...x, [b.id]: '' }))
              setFiles((x) => ({ ...x, [b.id]: f }))
            }}
            onUploaded={(res) => uploaded(b.id, res)}
          />
        )
      case 'bookmark':
        return <BookmarkBlock block={b} autoFocus={fresh === b.id} readOnly={readOnly} onPatch={(n) => patch(b.id, n)} />
      case 'table':
        return <TableBlock block={b} autoFocus={fresh === b.id} readOnly={readOnly} onPatch={(n) => patch(b.id, n, `table:${b.id}`)} />
      default:
        return null
    }
  }

  return (
    <div
      ref={rootRef}
      data-note-editor
      className={`ne ${readOnly ? 'ne-ro' : ''} ${coarse && activeBlock ? 'ne-typing' : ''}`}
      onPointerDownCapture={() => {
        touched.current = true
      }}
      onKeyDownCapture={(e) => {
        const k = e.key.toLowerCase()
        if (!(e.metaKey || e.ctrlKey) || (k !== 'z' && k !== 'y') || readOnly) return
        if ((e.target as HTMLElement).closest('[data-own-undo]')) return
        e.preventDefault()
        e.stopPropagation()
        undo(e.shiftKey || k === 'y')
      }}
    >
      {blocks.length === 0 && !readOnly && (
        <div className="ne-empty">
          <button type="button" className="ne-empty-write" onClick={clickTail}>
            {coarse ? 'Tap to start writing' : "Start writing, or type '/' for blocks"}
          </button>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {BLOCK_CHOICES.filter((c) => ['todo', 'h2', 'bullet', 'board', 'table'].includes(c.key)).map((c) => (
              <button key={c.key} type="button" className="ne-start" onClick={() => begin(c.kind, c.level)}>
                <ChoiceTile icon={c.icon} />
                <span>{c.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {blocks.length === 0 && readOnly && <p className="text-sm text-gray-400">Nothing written yet.</p>}

      {blocks.map((b, i) => {
        if (hidden.has(b.id)) return null
        const d = b.indent ?? 0
        return (
          <div
            key={b.id}
            data-row={b.id}
            data-kind={b.kind}
            data-level={b.kind === 'heading' ? b.level ?? 2 : undefined}
            data-active={active === b.id || menuId === b.id ? '' : undefined}
            className="ne-row"
            style={d ? { marginLeft: `calc(var(--ne-step) * ${d})` } : undefined}
          >
            {!readOnly && (
              <div className="ne-gutter">
                <button
                  type="button"
                  className="ne-gbtn ne-plus"
                  aria-label="Add a block below"
                  title="Add a block below"
                  onClick={() => addBelow(i)}
                >
                  <NoteIcon name="plus" size={16} />
                </button>
                <button
                  type="button"
                  data-handle
                  className="ne-gbtn ne-handle"
                  aria-label="Drag to move, or open the block menu"
                  aria-haspopup="menu"
                  aria-expanded={menuId === b.id}
                  title="Drag to move · click for options"
                  style={{ touchAction: 'none' }}
                  onPointerDown={(e) => {
                    if (e.button !== 0 || drag) return
                    e.preventDefault()
                    setSlash(null)
                    setDrag({ id: b.id, pointerId: e.pointerId, x: e.clientX, y: e.clientY })
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setMenuId(b.id)
                    } else if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
                      e.preventDefault()
                      commit(e.key === 'ArrowUp' ? moveUpAt(blocks, i) : moveDownAt(blocks, i))
                    }
                  }}
                >
                  <NoteIcon name="grip" size={16} />
                </button>
              </div>
            )}
            {isTextBlock(b) ? textRow(b, i) : otherRow(b)}
          </div>
        )
      })}

      <div data-drop-line className="ne-drop" aria-hidden />

      {!readOnly && blocks.length > 0 && (
        <>
          <button type="button" className="ne-add" onClick={() => addBelow(blocks.length)}>
            <NoteIcon name="plus" size={16} /> Add a block
          </button>
          <div className="ne-tail" onClick={clickTail} aria-hidden />
        </>
      )}

      {slash && !readOnly && (
        <SlashMenu
          anchorId={slash.id}
          items={filterChoices(slash.query)}
          index={slash.index}
          onPick={pick}
          onHover={(k) => setSlash({ ...slash, index: k })}
          onClose={closeSlash}
        />
      )}

      {menuBlock && !readOnly && (
        <BlockMenu
          block={menuBlock}
          sheet={coarse}
          detailsOpen={opened.includes(menuBlock.id)}
          can={{
            indent: canIndent(blocks, menuIndex),
            outdent: canOutdent(blocks, menuIndex),
            up: canMoveUp(blocks, menuIndex),
            down: canMoveDown(blocks, menuIndex),
          }}
          onAction={(a) => act(menuBlock.id, a)}
          onClose={() => setMenuId(null)}
        />
      )}

      {showBar && barBlock && isTextBlock(barBlock) && (linking || spot) && (
        <SelectionBar
          key={linking ? 'link' : 'format'}
          spot={linking?.spot ?? spot!}
          rich={barBlock}
          linking={linking ? linking.href : null}
          onFormat={(type) => spot && applyFormat(spot.id, spot.start, spot.end, type)}
          onLinkStart={(href) => spot && setLinking({ spot, href })}
          onLinkSave={saveLink}
          onLinkCancel={() => {
            const l = linking
            setLinking(null)
            if (l) ask(l.spot.id, l.spot.start, { end: l.spot.end })
          }}
        />
      )}

      {coarse && activeBlock && !readOnly && isTextBlock(activeBlock) && (
        <TouchBar
          canIndent={canIndent(blocks, activeIndex)}
          canOutdent={canOutdent(blocks, activeIndex)}
          canUndo={hist.past.length > 0}
          canRedo={hist.future.length > 0}
          isTodo={activeBlock.kind === 'todo'}
          onAction={touch}
        />
      )}
    </div>
  )
}
