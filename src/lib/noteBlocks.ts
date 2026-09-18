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

export interface NoteChart {
  id: string
  kind: 'chart'
  /** The title. It is what the chart is of, so a single series needs no legend. */
  label: string
  /** Which kind of chart to draw. Missing means columns, which is the old one. */
  type?: ChartType
  /** What the rows are — Opponent, Game, Player. Names the across axis. */
  axis?: string
  /** What the numbers are — Goals, Shots, Minutes. Names the value axis. */
  unit?: string
  /** One per column of numbers. Their names are the legend. */
  series?: { name: string }[]
  rows: NoteChartRow[]
}

export type NoteBlock = NoteHeading | NoteText | NoteList | NoteBoard | NoteChart

export const NOTE_BLOCK_KINDS: { key: NoteBlockKind; label: string }[] = [
  { key: 'heading', label: 'Section' },
  { key: 'text', label: 'Text' },
  { key: 'list', label: 'Checklist' },
  { key: 'board', label: 'Field' },
  { key: 'chart', label: 'Chart' },
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
        out.push({
          id,
          kind: 'board',
          label: text(b.label),
          board: readBoard(b.board) ?? EMPTY_BOARD,
          clip: readClip(b.clip),
          shotUrl: readShotUrl(b.shotUrl),
        })
        break
      case 'chart': {
        const series = Array.isArray(b.series)
          ? b.series
              .slice(0, MAX_SERIES)
              .map((x) => ({ name: text((x as Record<string, unknown>)?.name) }))
          : []
        const rows = Array.isArray(b.rows)
          ? b.rows.map((r) => {
              const row = (r ?? {}) as Record<string, unknown>
              // Charts written before there were columns kept one number called
              // `value`. That is the first column now.
              const values = Array.isArray(row.values)
                ? row.values.map((v) => (Number.isFinite(Number(v)) ? Number(v) : 0))
                : [Number.isFinite(Number(row.value)) ? Number(row.value) : 0]
              return { label: text(row.label), values: values.slice(0, MAX_SERIES) }
            })
          : []
        // However many numbers the widest row actually carries — the chart is
        // drawn from the data, not from a count that could disagree with it.
        const width = Math.max(1, series.length, ...rows.map((r) => r.values.length))
        out.push({
          id,
          kind: 'chart',
          label: text(b.label),
          type: CHART_KINDS.some((k) => k.key === b.type) ? (b.type as ChartType) : 'column',
          axis: text(b.axis),
          unit: text(b.unit),
          series: Array.from({ length: Math.min(width, MAX_SERIES) }, (_, i) => ({
            name: series[i]?.name ?? '',
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

  return out
}

/** The tallest bar, used to scale a chart. Never zero, so nothing divides by it. */
export function chartMax(rows: NoteChartRow[]): number {
  return Math.max(
    1,
    ...rows.flatMap((r) => r.values.map((v) => (Number.isFinite(v) ? Math.abs(v) : 0)))
  )
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
