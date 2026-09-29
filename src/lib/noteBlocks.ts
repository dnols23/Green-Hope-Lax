import { CHART_KINDS, MAX_SERIES, type ChartType } from './charts'
import {
  EMPTY_BOARD,
  newId,
  readBoard,
  readClip,
  readShotUrl,
  type Board,
  type BoardClip,
} from './planner'
import { readMarks, safeImageUrl, safeUrl, type NoteMark } from './noteText'

/**
 * What a note is made of.
 *
 * A note is a list of blocks, each one a line of thinking: a heading to break
 * the page up, a paragraph, a to-do, a bullet, a toggle that folds a section
 * away, a chart, a picture, or a lacrosse field with a play drawn on it. The
 * field is the reason this exists — a play drawn into a note is there on the
 * sideline in March, which a paragraph describing the same play is not.
 *
 * The list is flat, and nesting is each block's `indent`: a block one step in
 * from the block above it sits under it, the way an outline does. That keeps
 * what is stored a plain list — easy to check, easy to read back, and every
 * note saved before sub-items existed is simply a list with nothing indented.
 *
 * Pure, and forgiving: a note written by an older build, or half-saved, reads
 * back as the parts that still make sense rather than an error.
 */

export type NoteColor = 'gray' | 'brown' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple' | 'pink' | 'red'

export const NOTE_COLORS: { key: NoteColor; label: string }[] = [
  { key: 'gray', label: 'Gray' },
  { key: 'brown', label: 'Brown' },
  { key: 'orange', label: 'Orange' },
  { key: 'yellow', label: 'Yellow' },
  { key: 'green', label: 'Green' },
  { key: 'blue', label: 'Blue' },
  { key: 'purple', label: 'Purple' },
  { key: 'pink', label: 'Pink' },
  { key: 'red', label: 'Red' },
]

/** The blocks that are a line of words, and can be typed in. */
export const TEXT_KINDS = ['text', 'heading', 'todo', 'bullet', 'number', 'toggle', 'quote', 'callout'] as const
export type TextKind = (typeof TEXT_KINDS)[number]

export type NoteBlockKind = TextKind | 'divider' | 'bookmark' | 'image' | 'table' | 'board' | 'chart'

/** The ones that can have blocks tucked under them. */
export const NESTABLE: ReadonlySet<string> = new Set(['text', 'todo', 'bullet', 'number', 'toggle'])

/** Items in a list: Enter makes another, an empty one steps back out. */
export const LIST_KINDS: ReadonlySet<string> = new Set(['todo', 'bullet', 'number', 'toggle'])

/** Six levels of outline. Deeper than that is a different note. */
export const MAX_DEPTH = 5
export const MAX_BLOCKS = 500
export const MAX_TEXT = 20000
const MAX_DETAIL = 8000
export const MAX_TABLE_ROWS = 60
export const MAX_TABLE_COLS = 10
const MAX_CELL = 2000
const MAX_CHART_ROWS = 200

/**
 * What a drill carries, on any line of a note: how it is set up, how it
 * runs, why it is run, a video, the field drawn, and anything else. A
 * checklist of what to put in on Tuesday can explain each item the way the
 * drill bank does.
 */
export interface NoteDetails {
  setup?: string
  /** How it runs. */
  run?: string
  /** Why we run it. */
  why?: string
  link?: string
  linkLabel?: string
  board?: Board | null
  notes?: string
}

interface BlockBase {
  id: string
  /** How many steps in from the left. Omitted is zero. */
  indent?: number
  /** Text colour. */
  color?: NoteColor
  /** Background tint. */
  tint?: NoteColor
  /** Folded shut: what is tucked under it is hidden. */
  collapsed?: boolean
}

interface TextBase extends BlockBase {
  text: string
  /** Bold, italic, links — ranges over `text`. */
  marks?: NoteMark[]
  details?: NoteDetails
}

export interface NoteText extends TextBase {
  kind: 'text'
}

export interface NoteHeading extends TextBase {
  kind: 'heading'
  /** Notes written before there were three sizes are the middle one. */
  level?: 1 | 2 | 3
}

export interface NoteTodo extends TextBase {
  kind: 'todo'
  done: boolean
}

export interface NoteBullet extends TextBase {
  kind: 'bullet'
}

export interface NoteNumber extends TextBase {
  kind: 'number'
}

export interface NoteToggle extends TextBase {
  kind: 'toggle'
}

export interface NoteQuote extends TextBase {
  kind: 'quote'
}

export interface NoteCallout extends TextBase {
  kind: 'callout'
  icon?: string
}

export interface NoteDivider extends BlockBase {
  kind: 'divider'
}

export interface NoteBookmark extends BlockBase {
  kind: 'bookmark'
  url: string
  title: string
}

export interface NoteImage extends BlockBase {
  kind: 'image'
  url: string
  caption: string
}

export interface NoteTable extends BlockBase {
  kind: 'table'
  /** Every row the same width. */
  rows: string[][]
  /** The first row is the column names. */
  header?: boolean
}

export interface NoteBoard extends BlockBase {
  kind: 'board'
  /** What this play is called, shown above the field. */
  label: string
  board: Board
  /** The take, when the play came out of the Library recorded. */
  clip?: BoardClip | null
  /** A screenshot from the Library, shown instead of a field. */
  shotUrl?: string | null
}

export interface NoteChartRow {
  label: string
  /** One number per series — one per column of the little table in the editor. */
  values: number[]
}

/**
 * A column of numbers.
 *
 * Most are typed in and drawn. Some are typed in only to feed another — the
 * shots and goals behind a shooting percentage — and some are not typed in at
 * all because they are worked out from two that were.
 */
export interface NoteChartSeries {
  name: string
  /** Typed in, but kept off the chart because it feeds a worked-out column. */
  input?: boolean
  /** Worked out: this column is top ÷ bottom as a percentage. */
  percent?: { top: number; bottom: number }
  /** Worked out: top ÷ bottom as it is — 1.08 possessions for every one of theirs. */
  ratio?: { top: number; bottom: number }
}

export interface NoteChart extends BlockBase {
  kind: 'chart'
  /** The title. It is what the chart is of, so a single series needs no legend. */
  label: string
  /** Which kind of chart to draw. Missing means columns, which is the old one. */
  type?: ChartType
  /** What the rows are — Opponent, Game, Player. Names the across axis. */
  axis?: string
  /** What the numbers are — Goals, Shots, Minutes. Names the value axis. */
  unit?: string
  /** One per column of numbers. The ones that get drawn are the legend. */
  series?: NoteChartSeries[]
  rows: NoteChartRow[]
}

export type NoteTextBlock =
  | NoteText
  | NoteHeading
  | NoteTodo
  | NoteBullet
  | NoteNumber
  | NoteToggle
  | NoteQuote
  | NoteCallout

export type NoteBlock = NoteTextBlock | NoteDivider | NoteBookmark | NoteImage | NoteTable | NoteBoard | NoteChart

export const isTextBlock = (b: NoteBlock): b is NoteTextBlock => (TEXT_KINDS as readonly string[]).includes(b.kind)

export const isTextKind = (k: string): k is TextKind => (TEXT_KINDS as readonly string[]).includes(k)

/** A field with nothing drawn on it is no diagram. */
export const boardDrawn = (b: Board | null | undefined): b is Board =>
  !!b && (b.tokens.length > 0 || b.paths.length > 0 || (b.texts?.length ?? 0) > 0)

export function hasDetails(d: NoteDetails | undefined): boolean {
  if (!d) return false
  return (
    [d.setup, d.run, d.why, d.link, d.notes].some((v) => !!v?.trim()) || boardDrawn(d.board)
  )
}

export function emptyNoteBlock(kind: NoteBlockKind, id = newId('n')): NoteBlock {
  switch (kind) {
    case 'heading':
      return { id, kind, text: '', level: 2 }
    case 'todo':
      return { id, kind, text: '', done: false }
    case 'bullet':
    case 'number':
    case 'toggle':
    case 'quote':
      return { id, kind, text: '' }
    case 'callout':
      return { id, kind, text: '', icon: '💡' }
    case 'divider':
      return { id, kind }
    case 'bookmark':
      return { id, kind, url: '', title: '' }
    case 'image':
      return { id, kind, url: '', caption: '' }
    case 'table':
      return { id, kind, header: true, rows: [['', '', ''], ['', '', ''], ['', '', '']] }
    case 'board':
      return { id, kind, label: '', board: EMPTY_BOARD }
    case 'chart':
      return {
        id,
        kind,
        label: '',
        type: 'column',
        axis: '',
        unit: '',
        series: [{ name: '' }],
        rows: [{ label: '', values: [0] }],
      }
    default:
      return { id, kind: 'text', text: '' }
  }
}

const text = (v: unknown, max = MAX_TEXT) => (typeof v === 'string' ? v.slice(0, max) : '')
const colorOf = (v: unknown): NoteColor | undefined =>
  NOTE_COLORS.some((c) => c.key === v) ? (v as NoteColor) : undefined

/** The parts every block can have, leaving out the ones at their default. */
function readBase(b: Record<string, unknown>, id: string): BlockBase {
  const out: BlockBase = { id }
  const indent = Math.floor(Number(b.indent))
  if (Number.isFinite(indent) && indent > 0) out.indent = Math.min(indent, MAX_DEPTH)
  const color = colorOf(b.color)
  if (color) out.color = color
  const tint = colorOf(b.tint)
  if (tint) out.tint = tint
  if (b.collapsed === true) out.collapsed = true
  return out
}

function readDetails(raw: unknown): NoteDetails | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const d = raw as Record<string, unknown>
  const out: NoteDetails = {}
  for (const k of ['setup', 'run', 'why', 'notes'] as const) {
    const v = text(d[k], MAX_DETAIL)
    if (v.trim()) out[k] = v
  }
  const link = safeUrl(d.link)
  if (link) out.link = link
  const label = text(d.linkLabel, 120)
  if (label.trim() && link) out.linkLabel = label
  const board = readBoard(d.board)
  if (boardDrawn(board)) out.board = board
  return Object.keys(out).length ? out : undefined
}

/** A block's words, its formatting and its details. */
function readWords(b: Record<string, unknown>) {
  const words = text(b.text)
  const marks = readMarks(b.marks, words.length)
  const details = readDetails(b.details)
  return { text: words, ...(marks.length ? { marks } : {}), ...(details ? { details } : {}) }
}

/** Read what was stored. Anything unrecognisable is dropped, not guessed at. */
export function readNoteBlocks(raw: unknown): NoteBlock[] {
  if (!Array.isArray(raw)) return []
  const out: NoteBlock[] = []
  // Two blocks with one id would edit as one; the second gets its own.
  const seen = new Set<string>()
  const idFor = (v: unknown) => {
    let id = typeof v === 'string' && /^[\w-]{1,64}$/.test(v) ? v : newId('n')
    while (seen.has(id)) id = newId('n')
    seen.add(id)
    return id
  }

  for (const item of raw) {
    if (out.length >= MAX_BLOCKS) break
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue
    const b = item as Record<string, unknown>
    const kind = b.kind

    // A checklist from before each item was its own block: one to-do per item,
    // in order, top level, the first keeping the list's id.
    if (kind === 'list') {
      const items = Array.isArray(b.items) ? b.items : []
      items.forEach((i, k) => {
        if (out.length >= MAX_BLOCKS) return
        const row = (i ?? {}) as Record<string, unknown>
        const base = typeof b.id === 'string' ? (k === 0 ? b.id : `${b.id}-${k}`) : null
        out.push({ id: idFor(base), kind: 'todo', text: text(row.text), done: row.done === true })
      })
      continue
    }

    const base = () => readBase(b, idFor(b.id))
    switch (kind) {
      case 'heading': {
        const level = Number(b.level)
        out.push({ ...base(), kind, level: level === 1 || level === 3 ? level : 2, ...readWords(b) })
        break
      }
      case 'text':
      case 'bullet':
      case 'number':
      case 'toggle':
      case 'quote':
        out.push({ ...base(), kind, ...readWords(b) })
        break
      case 'todo':
        out.push({ ...base(), kind, done: b.done === true, ...readWords(b) })
        break
      case 'callout': {
        const icon = typeof b.icon === 'string' && b.icon.trim() ? b.icon.trim().slice(0, 16) : '💡'
        out.push({ ...base(), kind, icon, ...readWords(b) })
        break
      }
      case 'divider':
        out.push({ ...base(), kind })
        break
      case 'bookmark':
        out.push({ ...base(), kind, url: safeUrl(b.url) ?? '', title: text(b.title, 300) })
        break
      case 'image':
        out.push({ ...base(), kind, url: safeImageUrl(b.url) ?? '', caption: text(b.caption, 500) })
        break
      case 'table': {
        const rows = (Array.isArray(b.rows) ? b.rows : [])
          .slice(0, MAX_TABLE_ROWS)
          .map((r) => (Array.isArray(r) ? r.slice(0, MAX_TABLE_COLS).map((c) => text(c, MAX_CELL)) : []))
        const width = Math.max(1, ...rows.map((r) => r.length))
        const even = (rows.length ? rows : [['']]).map((r) => Array.from({ length: width }, (_, i) => r[i] ?? ''))
        out.push({ ...base(), kind, rows: even, header: b.header === true })
        break
      }
      case 'board':
        out.push({
          ...base(),
          kind: 'board',
          label: text(b.label, 300),
          board: readBoard(b.board) ?? EMPTY_BOARD,
          clip: readClip(b.clip),
          shotUrl: readShotUrl(b.shotUrl),
        })
        break
      case 'chart': {
        const series: NoteChartSeries[] = Array.isArray(b.series)
          ? b.series.slice(0, MAX_SERIES).map((x) => {
              const col = (x ?? {}) as Record<string, unknown>
              const pair = (raw: unknown) => {
                const v = (raw ?? null) as Record<string, unknown> | null
                const top = Number(v?.top)
                const bottom = Number(v?.bottom)
                return v && Number.isInteger(top) && Number.isInteger(bottom) && top >= 0 && bottom >= 0
                  ? { top, bottom }
                  : undefined
              }
              return {
                name: text(col.name, 200),
                input: col.input === true || undefined,
                percent: pair(col.percent),
                ratio: pair(col.ratio),
              }
            })
          : []
        const rows = Array.isArray(b.rows)
          ? b.rows.slice(0, MAX_CHART_ROWS).map((r) => {
              const row = (r ?? {}) as Record<string, unknown>
              // Charts written before there were columns kept one number called
              // `value`. That is the first column now.
              const values = Array.isArray(row.values)
                ? row.values.slice(0, MAX_SERIES).map((v) => (Number.isFinite(Number(v)) ? Number(v) : 0))
                : [Number.isFinite(Number(row.value)) ? Number(row.value) : 0]
              return { label: text(row.label, 200), values }
            })
          : []
        // However many numbers the widest row actually carries — the chart is
        // drawn from the data, not from a count that could disagree with it.
        const width = Math.max(1, series.length, ...rows.map((r) => r.values.length))
        out.push({
          ...base(),
          kind: 'chart',
          label: text(b.label, 300),
          type: CHART_KINDS.some((k) => k.key === b.type) ? (b.type as ChartType) : 'column',
          axis: text(b.axis, 200),
          unit: text(b.unit, 200),
          series: Array.from({ length: Math.min(width, MAX_SERIES) }, (_, i) => ({
            name: series[i]?.name ?? '',
            input: series[i]?.input,
            percent: series[i]?.percent,
            ratio: series[i]?.ratio,
          })),
          rows: rows.map((r) => ({
            label: r.label,
            values: Array.from({ length: Math.min(width, MAX_SERIES) }, (_, i) => r.values[i] ?? 0),
          })),
        })
        break
      }
      default:
      // A kind from a future build, or junk. Leaving it out is better than
      // rendering something nobody meant.
    }
  }

  return normalizeIndents(out)
}

/**
 * Every block at a depth the outline allows: nothing more than one step in
 * from the block above it, and nothing tucked under a block that cannot hold
 * anything (a heading, a field). Run after every change as well as on reading,
 * so an edit can never leave the note in a shape it could not be saved in.
 */
export function normalizeIndents<T extends { kind: string; indent?: number }>(blocks: T[]): T[] {
  let prev: T | null = null
  return blocks.map((b) => {
    const want = b.indent ?? 0
    const max = prev ? (prev.indent ?? 0) + (NESTABLE.has(prev.kind) ? 1 : 0) : 0
    const indent = Math.max(0, Math.min(want, max, MAX_DEPTH))
    let next = b
    if (indent !== want) {
      next = { ...b, indent }
      if (!indent) delete next.indent
    }
    prev = next
    return next
  })
}

/** The tallest bar, used to scale a chart. Never zero, so nothing divides by it. */
export function chartMax(rows: NoteChartRow[]): number {
  return Math.max(
    1,
    ...rows.flatMap((r) => r.values.map((v) => (Number.isFinite(v) ? Math.abs(v) : 0)))
  )
}

/** A one-line description for the Notes list: "3 of 7 done · 2 sections · a field". */
export function describeNote(blocks: NoteBlock[]): string {
  const counts = blocks.reduce<Record<string, number>>((acc, b) => {
    acc[b.kind] = (acc[b.kind] ?? 0) + 1
    return acc
  }, {})
  const parts: string[] = []
  const say = (n: number, one: string, many: string) => (n === 1 ? `1 ${one}` : `${n} ${many}`)
  const todos = blocks.filter((b): b is NoteTodo => b.kind === 'todo')
  if (todos.length) parts.push(`${todos.filter((t) => t.done).length} of ${todos.length} done`)
  if (counts.heading) parts.push(say(counts.heading, 'section', 'sections'))
  if (counts.board) parts.push(say(counts.board, 'field', 'fields'))
  if (counts.chart) parts.push(say(counts.chart, 'chart', 'charts'))
  if (counts.table) parts.push(say(counts.table, 'table', 'tables'))
  if (counts.image) parts.push(say(counts.image, 'picture', 'pictures'))
  const detailed = blocks.filter((b) => isTextBlock(b) && hasDetails(b.details)).length
  if (detailed) parts.push(`${detailed} with details`)
  return parts.join(' · ')
}
