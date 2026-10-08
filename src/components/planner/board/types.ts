import type { Board, BoardHalf, EndCap, LinePattern, PathKind, ShapeKind, TextAlign, TokenKind, TokenMark } from '@/lib/planner'
import type { SavedLook } from '@/lib/formations'
import type { Align, Item, Mappers, Reorder } from './items'

/**
 * How a new line is laid down: one straight drag, a point per tap, a smooth
 * curve through the taps, or a scribble. Line, arrow and double arrow are all
 * the straight drag — they differ only in the ends on the pen.
 */
export type LineGeo = 'straight' | 'poly' | 'curve' | 'free'

/** What a tap or a drag on the field does. */
export type Tool =
  | { t: 'select' }
  | { t: 'line'; geo: LineGeo }
  | { t: 'shape'; kind: ShapeKind }
  | { t: 'text' }
  /** Every tap puts one down — cones, a row of attackmen, a roster player. */
  | { t: 'stamp'; kind: TokenKind; label: string; mark?: TokenMark; numbered?: boolean; playerId?: string; title: string }
  /** A formation or a saved look waiting to go down on a cage. */
  | { t: 'place'; from: 'formation' | 'look'; key: string; title: string }

/** The pen new lines are drawn with. */
export interface LinePen {
  preset: string
  kind: PathKind
  color: string
  width: number
  dash: string
  pattern?: LinePattern
  startCap: EndCap
  endCap: EndCap
}

/** What a new shape is filled and outlined with. */
export interface ShapePen {
  fill?: string
  fillOpacity: number
  stroke: string
  strokeWidth: number
  dash: string
}

/** How a new word looks. */
export interface TextPen {
  color: string
  size: number
  bold: boolean
  italic: boolean
  bg?: string
  align: TextAlign
  /** A key from BOARD_FONTS; absent is the plain sans. */
  font?: string
}

export const DEFAULT_LINE_PEN: LinePen = {
  preset: 'cut',
  kind: 'run',
  color: '#17222e',
  width: 0.7,
  dash: '',
  startCap: 'none',
  endCap: 'arrow',
}

/* A chalk-white zone, faintly filled, reads on grass without hiding the
   players standing in it. */
export const DEFAULT_SHAPE_PEN: ShapePen = {
  fill: '#ffffff',
  fillOpacity: 0.18,
  stroke: '#ffffff',
  strokeWidth: 0.4,
  dash: '',
}

export const DEFAULT_TEXT_PEN: TextPen = {
  color: '#17222e',
  size: 4,
  bold: false,
  italic: false,
  align: 'middle',
}

/** Editor preferences that are not part of the play. */
export interface BoardPrefs {
  grid: boolean
  snapGrid: boolean
  snapObjects: boolean
}

/** A player who can be dropped onto the field. */
export interface BoardPlayer {
  id: string
  name: string
  number: string | null
}

/**
 * Everything the menus can see and do. Built fresh by the board on every
 * render, so a menu always acts on the board as it stands.
 */
export interface Editor {
  board: Board
  /** How far the view is turned, full screen's own quarter turn included. */
  turn: number
  sel: string[]
  /** What is selected, bottom first. */
  items: Item[]
  tool: Tool
  setTool: (t: Tool) => void
  linePen: LinePen
  setLinePen: (p: Partial<LinePen>) => void
  shapePen: ShapePen
  setShapePen: (p: Partial<ShapePen>) => void
  textPen: TextPen
  setTextPen: (p: Partial<TextPen>) => void
  prefs: BoardPrefs
  setPrefs: (p: Partial<BoardPrefs>) => void

  /** Change what is selected. Steps with the same key close together are one undo. */
  patch: (m: Mappers, key?: string) => void
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
  remove: () => void
  duplicate: () => void
  copy: () => void
  cut: () => void
  paste: () => void
  hasClip: () => boolean
  selectAll: () => void
  arrange: (how: Reorder) => void
  align: (how: Align) => void
  distribute: (axis: 'x' | 'y') => void
  group: () => void
  ungroup: () => void
  lock: (on: boolean) => void
  editText: (id: string) => void
  clear: () => void

  half: BoardHalf
  setHalf: (h: BoardHalf) => void
  turnView: () => void
  zoomBy: (f: number) => void
  zoomReset: () => void
  zoomed: boolean
  full: boolean
  toggleFull: () => void
  shot?: () => void
  shooting: boolean

  looks: SavedLook[]
  saveLook: (name: string) => void
  players: BoardPlayer[]
  nextKind: TokenKind
  setNextKind: (k: TokenKind) => void

  /** A line or polygon being put down a tap at a time. */
  drafting: number
  finishDraft: () => void
  cancelDraft: () => void
}
