import { EMPTY_BOARD, newId, readBoard, type Board } from './planner'

/**
 * What a note is made of.
 *
 * A note is a list of blocks, each one a different kind of thinking: a heading
 * to break the page up, a paragraph, a list of things to get through, a chart,
 * or a lacrosse field with a play drawn on it. The field is the reason this
 * exists — a play drawn into a note is there on the sideline in March, which a
 * paragraph describing the same play is not.
 *
 * Pure, and forgiving: a note written by an older build, or half-saved, reads
 * back as the parts that still make sense rather than an error.
 */

export type NoteBlockKind = 'heading' | 'text' | 'list' | 'board' | 'chart'

export interface NoteHeading {
  id: string
  kind: 'heading'
  text: string
}

export interface NoteText {
  id: string
  kind: 'text'
  text: string
}

export interface NoteListItem {
  text: string
  done: boolean
}

export interface NoteList {
  id: string
  kind: 'list'
  items: NoteListItem[]
}

export interface NoteBoard {
  id: string
  kind: 'board'
  /** What this play is called, shown above the field. */
  label: string
  board: Board
}

export interface NoteChartRow {
  label: string
  value: number
}

export interface NoteChart {
  id: string
  kind: 'chart'
  label: string
  rows: NoteChartRow[]
}

export type NoteBlock = NoteHeading | NoteText | NoteList | NoteBoard | NoteChart

export const NOTE_BLOCK_KINDS: { key: NoteBlockKind; label: string; icon: string }[] = [
  { key: 'heading', label: 'Section', icon: '#' },
  { key: 'text', label: 'Text', icon: '¶' },
  { key: 'list', label: 'Checklist', icon: '☑' },
  { key: 'board', label: 'Field', icon: '🥍' },
  { key: 'chart', label: 'Chart', icon: '▥' },
]

export function emptyNoteBlock(kind: NoteBlockKind): NoteBlock {
  const id = newId('n')
  switch (kind) {
    case 'heading':
      return { id, kind, text: '' }
    case 'list':
      return { id, kind, items: [{ text: '', done: false }] }
    case 'board':
      return { id, kind, label: '', board: EMPTY_BOARD }
    case 'chart':
      return { id, kind, label: '', rows: [{ label: '', value: 0 }] }
    default:
      return { id, kind: 'text', text: '' }
  }
}

const text = (v: unknown) => (typeof v === 'string' ? v : '')

/** Read what was stored. Anything unrecognisable is dropped, not guessed at. */
export function readNoteBlocks(raw: unknown): NoteBlock[] {
  if (!Array.isArray(raw)) return []
  const out: NoteBlock[] = []

  for (const item of raw) {
    const b = (item ?? {}) as Record<string, unknown>
    const id = typeof b.id === 'string' && b.id ? b.id : newId('n')

    switch (b.kind) {
      case 'heading':
        out.push({ id, kind: 'heading', text: text(b.text) })
        break
      case 'text':
        out.push({ id, kind: 'text', text: text(b.text) })
        break
      case 'list':
        out.push({
          id,
          kind: 'list',
          items: Array.isArray(b.items)
            ? b.items.map((i) => {
                const row = (i ?? {}) as Record<string, unknown>
                return { text: text(row.text), done: row.done === true }
              })
            : [],
        })
        break
      case 'board':
        out.push({ id, kind: 'board', label: text(b.label), board: readBoard(b.board) ?? EMPTY_BOARD })
        break
      case 'chart':
        out.push({
          id,
          kind: 'chart',
          label: text(b.label),
          rows: Array.isArray(b.rows)
            ? b.rows.map((r) => {
                const row = (r ?? {}) as Record<string, unknown>
                const value = Number(row.value)
                return { label: text(row.label), value: Number.isFinite(value) ? value : 0 }
              })
            : [],
        })
        break
      default:
      // A kind from a future build, or junk. Leaving it out is better than
      // rendering something nobody meant.
    }
  }

  return out
}

/** The tallest bar, used to scale a chart. Never zero, so nothing divides by it. */
export function chartMax(rows: NoteChartRow[]): number {
  return Math.max(1, ...rows.map((r) => (Number.isFinite(r.value) ? Math.abs(r.value) : 0)))
}

/** A one-line description for the planner list: "3 sections · a field · a chart". */
export function describeNote(blocks: NoteBlock[]): string {
  const counts = blocks.reduce<Record<string, number>>((acc, b) => {
    acc[b.kind] = (acc[b.kind] ?? 0) + 1
    return acc
  }, {})
  const parts: string[] = []
  const say = (n: number, one: string, many: string) => (n === 1 ? `1 ${one}` : `${n} ${many}`)
  if (counts.heading) parts.push(say(counts.heading, 'section', 'sections'))
  if (counts.board) parts.push(say(counts.board, 'field', 'fields'))
  if (counts.chart) parts.push(say(counts.chart, 'chart', 'charts'))
  if (counts.list) parts.push(say(counts.list, 'checklist', 'checklists'))
  return parts.join(' · ')
}
