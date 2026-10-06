// The field board's data: what a drawn play is made of, and the one reader
// every stored board goes through.
//
// Kept apart from the rest of the planner, with no imports, so the same rules
// run in the browser, on the server and in a plain node check. planner.ts
// re-exports all of it, which is where the rest of the app imports it from.
//
// Boards live as JSON inside plans, drills, notes, library plays, playbook
// pages and recorded clips — there is no table to migrate. Everything added
// since the first version is therefore optional: a board saved before a field
// existed simply does not have it, and draws exactly as it always did.

export function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`
}

// ── The field ───────────────────────────────────────────────────────────────

/**
 * A men's lacrosse field, in yards, as the rule book has it.
 *
 * 110 by 60, goals 80 apart — so each goal stands 15 from its end line, with a
 * nine-foot crease around it. The restraining line is twenty yards from the
 * GOAL line, not the end line: that is the whole offensive end, fifteen yards
 * of it behind the cage. The box sides and the wing lines are the same ten
 * yards in from each sideline, which is why they line up.
 */
export const FIELD = {
  length: 110,
  width: 60,
  goalLineFromEnd: 15,
  /** 6 feet between the pipes. */
  goalWidth: 2,
  /** 9 feet. */
  creaseRadius: 3,
  /** Twenty yards in front of the cage. */
  restrainingFromGoalLine: 20,
  /** Ten yards in from each sideline, so the box is forty wide. */
  boxFromSideline: 10,
  wingHalfLength: 10,
  /** The substitution area, half either side of the centre line. */
  subBoxHalf: 5,
}

// ── Players and things ──────────────────────────────────────────────────────

/**
 * The discs a coach reaches for, by the position they actually play.
 *
 * "Offense" and "Defense" are colours, not positions — nobody runs a play for
 * an offense, they run it for the attackman at X with a short stick coming off
 * the wing. The letter on the disc is what a coach reads at a glance.
 */
export const POSITION_TOKENS: { label: string; title: string; kind: 'offense' | 'defense' | 'goalie' }[] = [
  { label: 'A', title: 'Attack', kind: 'offense' },
  { label: 'M', title: 'Midfield', kind: 'offense' },
  { label: 'FO', title: 'Face-off', kind: 'offense' },
  { label: 'D', title: 'Defense', kind: 'defense' },
  { label: 'LSM', title: 'LSM', kind: 'defense' },
  { label: 'SSDM', title: 'Short-stick d-mid', kind: 'defense' },
  { label: 'G', title: 'Goalie', kind: 'goalie' },
]

export type TokenKind = 'offense' | 'defense' | 'goalie' | 'cone' | 'ball' | 'coach' | 'goal' | 'ladder'

export const TOKEN_KINDS: { key: TokenKind; label: string; fill: string; ink: string }[] = [
  { key: 'offense', label: 'Offense',  fill: '#00693E', ink: '#ffffff' },
  { key: 'defense', label: 'Defense',  fill: '#7A1F2B', ink: '#ffffff' },
  { key: 'goalie',  label: 'Goalie',   fill: '#B4823A', ink: '#ffffff' },
  { key: 'coach',   label: 'Coach',    fill: '#2F5D8C', ink: '#ffffff' },
  { key: 'cone',    label: 'Cone',     fill: '#E4863A', ink: '#3b1d05' },
  { key: 'ball',    label: 'Ball',     fill: '#f5f5f5', ink: '#17222e' },
  // A pop-up or practice goal set down for a drill — the two game cages are
  // part of the field and are always there.
  { key: 'goal',    label: 'Goal',     fill: '#E4574B', ink: '#ffffff' },
  { key: 'ladder',  label: 'Ladder',   fill: '#FACC15', ink: '#17222e' },
]

export function tokenStyle(kind: TokenKind) {
  return TOKEN_KINDS.find((t) => t.key === kind) ?? TOKEN_KINDS[0]
}

/** Things rather than people: no letters on them, and smaller. */
export function isPlayerKind(kind: TokenKind): boolean {
  return kind === 'offense' || kind === 'defense' || kind === 'goalie' || kind === 'coach'
}

/**
 * How a player is drawn. A filled disc is the default; the whiteboard habit of
 * O for offense and X for defense is here for the coaches who draw that way.
 */
export type TokenMark = 'disc' | 'ring' | 'square' | 'x'

export const TOKEN_MARKS: { key: TokenMark; label: string }[] = [
  { key: 'disc', label: 'Disc' },
  { key: 'ring', label: 'Ring' },
  { key: 'square', label: 'Square' },
  { key: 'x', label: 'X' },
]

/**
 * What every item on a board may carry, whatever it is. All optional, so a
 * board from before any of it existed reads unchanged.
 */
export interface BoardItemBase {
  id: string
  /**
   * Stacking order across the whole board. Absent, an item sits in its own
   * layer — zones under lines, lines under words, words under players — and
   * stacks in the order it was drawn. Set once a coach arranges anything.
   */
  z?: number
  /** Locked: it can be picked, but not dragged, stretched or turned by accident. */
  locked?: boolean
  /** Items sharing a group id are picked, moved and copied together. */
  group?: string
}

export interface BoardToken extends BoardItemBase {
  kind: TokenKind
  /** Yards from the left end line / top sideline. */
  x: number
  y: number
  /** Jersey number or initials — whatever fits in a disc. */
  label: string
  /** The player this token stands for, when it came off a roster. */
  playerId?: string
  /** Overrides the colour its kind would give it. */
  color?: string
  mark?: TokenMark
  /** How much bigger than its kind's size. 1 when absent. */
  size?: number
  /** Degrees clockwise — a goal facing up the field, a ladder at an angle. */
  rot?: number
}

// ── Lines ───────────────────────────────────────────────────────────────────

/** How a line ends. Both ends are set separately, like any drawing tool. */
export type EndCap = 'none' | 'arrow' | 'open' | 'dot' | 'circle' | 'bar' | 'square'

export const END_CAPS: { key: EndCap; label: string }[] = [
  { key: 'none', label: 'Plain' },
  { key: 'arrow', label: 'Arrow' },
  { key: 'open', label: 'Open arrow' },
  { key: 'dot', label: 'Dot' },
  { key: 'circle', label: 'Ring' },
  { key: 'bar', label: 'Bar' },
  { key: 'square', label: 'Square' },
]

/** The named line styles, and the dash pattern each one draws. */
export const DASH_STYLES: { key: string; label: string; dash: string }[] = [
  { key: 'solid', label: 'Solid', dash: '' },
  { key: 'dashed', label: 'Dashed', dash: '3 2' },
  { key: 'dotted', label: 'Dotted', dash: '0.8 1.6' },
  { key: 'long', label: 'Long dash', dash: '6 2' },
]

/**
 * A line drawn as a wave or a zig-zag rather than straight along its path — a
 * ball carry, on most coaches' boards. The path itself stays the points the
 * coach put down; the wiggle is drawn on top of it.
 */
export type LinePattern = 'wavy' | 'zigzag'

/** The end of each stroke segment. Round is what a marker on a whiteboard does. */
export type LineCap = 'round' | 'butt' | 'square'

/** The colours on the picker — the program's, plus the ones a board needs. */
export const BOARD_COLORS: { key: string; label: string }[] = [
  { key: '#00693E', label: 'Green' },
  { key: '#004D2E', label: 'Dark green' },
  { key: '#7A1F2B', label: 'Maroon' },
  { key: '#B4823A', label: 'Gold' },
  { key: '#FACC15', label: 'Yellow' },
  { key: '#E4863A', label: 'Orange' },
  { key: '#DC2626', label: 'Red' },
  { key: '#2F5D8C', label: 'Blue' },
  { key: '#38BDF8', label: 'Sky' },
  { key: '#6B21A8', label: 'Purple' },
  { key: '#17222e', label: 'Ink' },
  { key: '#000000', label: 'Black' },
  { key: '#9CA3AF', label: 'Grey' },
  { key: '#ffffff', label: 'White' },
]

export type PathKind = 'run' | 'pass' | 'shot' | 'screen'

export const PATH_KINDS: { key: PathKind; label: string; dash: string; color: string }[] = [
  { key: 'run',    label: 'Run',    dash: '',      color: '#17222e' },
  { key: 'pass',   label: 'Pass',   dash: '3 2',   color: '#2F5D8C' },
  { key: 'shot',   label: 'Shot',   dash: '6 2',   color: '#7A1F2B' },
  { key: 'screen', label: 'Pick',   dash: '1 2',   color: '#B4823A' },
]

export function pathStyle(kind: PathKind) {
  return PATH_KINDS.find((p) => p.key === kind) ?? PATH_KINDS[0]
}

export interface BoardPath extends BoardItemBase {
  kind: PathKind
  /** At least two points, in field yards. */
  points: { x: number; y: number }[]
  /** Everything below overrides what the kind would give it. */
  color?: string
  /** Stroke width in yards. */
  width?: number
  dash?: string
  startCap?: EndCap
  endCap?: EndCap
  /** A smooth curve through the points rather than straight lines between them. */
  curve?: boolean
  pattern?: LinePattern
  /** 0–1. Fully drawn when absent. */
  opacity?: number
  /** Round when absent. */
  lineCap?: LineCap
}

/**
 * The lines a coach draws, by what they mean on a lacrosse field. Each sets the
 * whole look of the pen; any of it can be changed on the line afterwards.
 */
export interface LinePreset {
  key: string
  label: string
  kind: PathKind
  color: string
  dash: string
  width: number
  endCap: EndCap
  pattern?: LinePattern
}

export const LINE_PRESETS: LinePreset[] = [
  { key: 'cut', label: 'Cut', kind: 'run', color: '#17222e', dash: '', width: 0.7, endCap: 'arrow' },
  { key: 'dodge', label: 'Dodge', kind: 'run', color: '#ffffff', dash: '', width: 0.8, endCap: 'arrow' },
  { key: 'carry', label: 'Carry', kind: 'run', color: '#17222e', dash: '', width: 0.6, endCap: 'arrow', pattern: 'wavy' },
  { key: 'zigzag', label: 'Zig-zag', kind: 'run', color: '#17222e', dash: '', width: 0.6, endCap: 'arrow', pattern: 'zigzag' },
  // Movement away from the ball — a player getting open, clearing space, a back-side cut.
  { key: 'offball', label: 'Off ball', kind: 'run', color: '#6E4BA3', dash: '', width: 0.6, endCap: 'arrow' },
  { key: 'pass', label: 'Pass', kind: 'pass', color: '#2F5D8C', dash: '3 2', width: 0.7, endCap: 'arrow' },
  { key: 'shot', label: 'Shot', kind: 'shot', color: '#7A1F2B', dash: '6 2', width: 0.8, endCap: 'arrow' },
  // A pick: from the screener to the man being picked, ending in a bold flat bar where the screen lands.
  { key: 'pick', label: 'Pick', kind: 'screen', color: '#B4823A', dash: '', width: 0.7, endCap: 'bar' },
]

// ── Words ───────────────────────────────────────────────────────────────────

/**
 * The typefaces a word on the field can be set in.
 *
 * Every stack ends in a family every phone and laptop already has: a board
 * drawn on the sideline cannot wait for a font to download, and a play that
 * reflows because one did is worse than a plain one.
 */
export const BOARD_FONTS: { key: string; label: string; stack: string }[] = [
  { key: 'sans',      label: 'Sans',      stack: 'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' },
  { key: 'serif',     label: 'Serif',     stack: 'Georgia, "Times New Roman", Times, serif' },
  { key: 'mono',      label: 'Mono',      stack: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' },
  { key: 'condensed', label: 'Condensed', stack: '"Arial Narrow", "Helvetica Neue", Impact, sans-serif' },
]

export function fontStack(key: string | undefined): string {
  return (BOARD_FONTS.find((f) => f.key === key) ?? BOARD_FONTS[0]).stack
}

/** Where a word sits relative to the spot it was dropped on. */
export type TextAlign = 'start' | 'middle' | 'end'

/** A word on the field: a call, a coaching point, a label for a spot. */
export interface BoardText extends BoardItemBase {
  x: number
  y: number
  text: string
  /** Cap height in yards, so it scales with the field like everything else. */
  size: number
  color: string
  bold?: boolean
  italic?: boolean
  underline?: boolean
  /** A key from BOARD_FONTS. Anything else falls back to the first one. */
  font?: string
  align?: TextAlign
  /** A highlight behind the words, so a call reads over grass and lines. */
  bg?: string
  /** 0–1 for the highlight. Solid when absent. */
  bgOpacity?: number
  /** Degrees clockwise. */
  rot?: number
}

// ── Shapes ──────────────────────────────────────────────────────────────────

export type ShapeKind = 'rect' | 'roundrect' | 'ellipse' | 'triangle' | 'diamond' | 'polygon'

export const SHAPE_KINDS: { key: ShapeKind; label: string }[] = [
  { key: 'rect', label: 'Rectangle' },
  { key: 'roundrect', label: 'Rounded' },
  { key: 'ellipse', label: 'Circle' },
  { key: 'triangle', label: 'Triangle' },
  { key: 'diamond', label: 'Diamond' },
  { key: 'polygon', label: 'Polygon' },
]

/**
 * A zone, a lane, "the box": a shape laid on the field.
 *
 * Kept as a box plus a turn, so stretching it is changing four numbers and a
 * polygon's corners are fractions of that box rather than field points — it
 * resizes the way the rectangle round it does.
 */
export interface BoardShape extends BoardItemBase {
  kind: ShapeKind
  /** The top-left corner and size of the box, in yards, before it is turned. */
  x: number
  y: number
  w: number
  h: number
  /** Degrees clockwise, about the middle of the box. */
  rot?: number
  /** A polygon's corners, each 0–1 across and down the box. */
  pts?: { x: number; y: number }[]
  /** Absent is no fill. */
  fill?: string
  fillOpacity?: number
  /** White when absent. */
  stroke?: string
  /** Yards. 0 is no outline. */
  strokeWidth?: number
  dash?: string
  /** A rounded rectangle's corner, in yards. */
  radius?: number
}

/** What a shape actually draws with. */
export function shapeLook(s: BoardShape) {
  return {
    fill: s.fill ?? 'none',
    fillOpacity: s.fillOpacity ?? 1,
    stroke: s.stroke ?? '#ffffff',
    strokeWidth: s.strokeWidth ?? 0.35,
    dash: s.dash ?? '',
    radius: s.kind === 'roundrect' ? (s.radius ?? Math.min(s.w, s.h) * 0.18) : 0,
  }
}

// ── The board ───────────────────────────────────────────────────────────────

/**
 * How a board is looked at: the whole field or one end, and which way up.
 *
 * Saved with the board, so the play reads the same on the page, in the Library,
 * on a player's phone and in the editor it was drawn in — a play drawn on the
 * right end, turned for a phone, is shown that way everywhere, not reset to the
 * whole field the moment it leaves the editor.
 */
export type BoardHalf = 'off' | 'right' | 'left'
export type BoardTurn = 0 | 90 | 180 | 270
export interface BoardView {
  half?: BoardHalf
  turn?: BoardTurn
}

export interface Board {
  tokens: BoardToken[]
  paths: BoardPath[]
  texts?: BoardText[]
  /** Zones and outlines. Absent on every board drawn before there were shapes. */
  shapes?: BoardShape[]
  view?: BoardView
}

export const EMPTY_BOARD: Board = { tokens: [], paths: [], texts: [] }

/** How many things are drawn on it — players, lines, words and shapes. */
export function boardItemCount(b: Board): number {
  return b.tokens.length + b.paths.length + (b.texts?.length ?? 0) + (b.shapes?.length ?? 0)
}

/** Nothing drawn and nothing about the view chosen: no diagram at all. */
export function boardIsBlank(b: Board | null | undefined): boolean {
  return !b || (boardItemCount(b) === 0 && !b.view)
}

/** What a line actually draws with, once its own settings have their say. */
export function pathLook(path: BoardPath) {
  const base = pathStyle(path.kind)
  return {
    color: path.color ?? base.color,
    dash: path.dash ?? base.dash,
    width: path.width ?? 0.7,
    startCap: path.startCap ?? 'none',
    endCap: path.endCap ?? (path.kind === 'screen' ? 'bar' : 'arrow'),
    opacity: path.opacity ?? 1,
    lineCap: path.lineCap ?? 'round',
    pattern: path.pattern,
    curve: path.curve === true,
  }
}

// ── Reading a stored board ──────────────────────────────────────────────────

/**
 * The most a board may hold. Far past anything a coach draws — a busy play is
 * twenty things — and low enough that a pasted or forged board cannot swell a
 * plan's row, or a clip of six hundred frames of it, into megabytes.
 */
export const BOARD_LIMITS = {
  tokens: 300,
  paths: 300,
  texts: 150,
  shapes: 150,
  /** A long scribble is a point every half yard; this is five hundred yards of it. */
  pointsPerPath: 1000,
  polygonPoints: 100,
  label: 16,
  text: 1000,
  id: 64,
}

const HEX = /^#[0-9a-f]{3,8}$/i
const hex = (v: unknown): string | undefined => (typeof v === 'string' && HEX.test(v) ? v : undefined)

/** A number inside a range, to a thousandth of a yard, or the fallback. */
function num(v: unknown, min: number, max: number, fallback: number): number {
  const n = Number(v)
  if (!Number.isFinite(n)) return fallback
  return Math.round(Math.min(max, Math.max(min, n)) * 1000) / 1000
}

/** An optional number: absent unless it is a real one, then kept in range. */
function optNum(v: unknown, min: number, max: number): number | undefined {
  if (v === undefined || v === null || v === '') return undefined
  const n = Number(v)
  return Number.isFinite(n) ? num(n, min, max, min) : undefined
}

/** Degrees, as 0–360. Absent for none. */
function turnOf(v: unknown): number | undefined {
  const n = Number(v)
  if (!Number.isFinite(n)) return undefined
  const d = Math.round((((n % 360) + 360) % 360) * 10) / 10
  return d === 0 || d === 360 ? undefined : d
}

/* Coordinates may sit a little off the field — a coach standing on the
   sideline — but not a mile off it. */
const X = (v: unknown) => num(v, -30, FIELD.length + 30, 0)
const Y = (v: unknown) => num(v, -30, FIELD.width + 30, 0)

/** Dash patterns are numbers and spaces. Anything else is not a dash pattern. */
const dashOf = (v: unknown): string | undefined =>
  typeof v === 'string' && v.length <= 32 && /^[0-9.,\s]*$/.test(v) ? v : undefined

const oneOf = <T extends string>(v: unknown, keys: readonly T[]): T | undefined =>
  keys.includes(v as T) ? (v as T) : undefined

/** Drop the keys that came out undefined, so a stored board carries only what it says. */
function tidy<T extends object>(o: T): T {
  for (const k of Object.keys(o) as (keyof T)[]) if (o[k] === undefined) delete o[k]
  return o
}

export function readBoard(raw: unknown): Board | null {
  if (!raw || typeof raw !== 'object') return null
  const b = raw as Partial<Board>

  // Two things with one id would move, delete and select as one. First wins.
  const seen = new Set<string>()
  const idOf = (v: unknown, prefix: string) => {
    let id = typeof v === 'string' && v.length > 0 && v.length <= BOARD_LIMITS.id ? v : newId(prefix)
    while (seen.has(id)) id = newId(prefix)
    seen.add(id)
    return id
  }
  const base = (o: Partial<BoardItemBase>) => ({
    z: optNum(o.z, -1_000_000, 1_000_000),
    locked: o.locked === true ? true : undefined,
    group: typeof o.group === 'string' && o.group && o.group.length <= 40 ? o.group : undefined,
  })
  const capKeys = END_CAPS.map((c) => c.key)
  const list = (v: unknown, max: number): unknown[] => (Array.isArray(v) ? v.slice(0, max) : [])

  const tokens: BoardToken[] = list(b.tokens, BOARD_LIMITS.tokens).map((t) => {
    const tok = (t ?? {}) as Partial<BoardToken>
    const size = optNum(tok.size, 0.3, 5)
    return tidy({
      id: idOf(tok.id, 't'),
      kind: (TOKEN_KINDS.some((k) => k.key === tok.kind) ? tok.kind : 'offense') as TokenKind,
      x: X(tok.x),
      y: Y(tok.y),
      label: typeof tok.label === 'string' ? tok.label.slice(0, BOARD_LIMITS.label) : '',
      playerId: typeof tok.playerId === 'string' ? tok.playerId.slice(0, BOARD_LIMITS.id) : undefined,
      color: hex(tok.color),
      mark: oneOf(tok.mark, TOKEN_MARKS.map((m) => m.key)),
      size: size === 1 ? undefined : size,
      rot: turnOf(tok.rot),
      ...base(tok),
    })
  })

  const paths: BoardPath[] = list(b.paths, BOARD_LIMITS.paths)
    .map((p) => {
      const path = (p ?? {}) as Partial<BoardPath>
      const points = list(path.points, BOARD_LIMITS.pointsPerPath).map((pt) => {
        const q = (pt ?? {}) as { x?: unknown; y?: unknown }
        return { x: X(q.x), y: Y(q.y) }
      })
      const width = Number(path.width)
      return tidy({
        id: idOf(path.id, 'p'),
        kind: (PATH_KINDS.some((k) => k.key === path.kind) ? path.kind : 'run') as PathKind,
        points,
        color: hex(path.color),
        // A stroke of nothing or of a mile is somebody's bad data, not a choice.
        width: Number.isFinite(width) && width > 0 ? Math.min(width, 4) : undefined,
        dash: dashOf(path.dash),
        startCap: oneOf(path.startCap, capKeys),
        endCap: oneOf(path.endCap, capKeys),
        curve: path.curve === true ? true : undefined,
        pattern: oneOf(path.pattern, ['wavy', 'zigzag'] as const),
        opacity: optNum(path.opacity, 0.05, 1),
        lineCap: oneOf(path.lineCap, ['round', 'butt', 'square'] as const),
        ...base(path),
      })
    })
    .filter((p) => p.points.length >= 2)

  const texts: BoardText[] = list(b.texts, BOARD_LIMITS.texts)
    .map((t) => {
      const text = (t ?? {}) as Partial<BoardText>
      const size = Number(text.size)
      return tidy({
        id: idOf(text.id, 'x'),
        x: X(text.x),
        y: Y(text.y),
        text: typeof text.text === 'string' ? text.text.slice(0, BOARD_LIMITS.text) : '',
        size: Number.isFinite(size) && size > 0 ? Math.min(size, 12) : 3,
        color: hex(text.color) ?? '#17222e',
        bold: text.bold === true,
        italic: text.italic === true,
        underline: text.underline === true,
        font: BOARD_FONTS.some((f) => f.key === text.font) ? text.font : undefined,
        align: oneOf(text.align, ['start', 'middle', 'end'] as const),
        bg: hex(text.bg),
        bgOpacity: optNum(text.bgOpacity, 0, 1),
        rot: turnOf(text.rot),
        ...base(text),
      })
    })
    .filter((t) => t.text.trim().length > 0)

  const shapes: BoardShape[] = list(b.shapes, BOARD_LIMITS.shapes)
    .map((s) => {
      const shape = (s ?? {}) as Partial<BoardShape>
      const kind = oneOf(shape.kind, SHAPE_KINDS.map((k) => k.key))
      const pts =
        kind === 'polygon'
          ? list(shape.pts, BOARD_LIMITS.polygonPoints).map((pt) => {
              const q = (pt ?? {}) as { x?: unknown; y?: unknown }
              return { x: num(q.x, 0, 1, 0), y: num(q.y, 0, 1, 0) }
            })
          : undefined
      return tidy({
        id: idOf(shape.id, 's'),
        kind: kind ?? 'rect',
        x: X(shape.x),
        y: Y(shape.y),
        w: num(shape.w, 0.2, 200, 0),
        h: num(shape.h, 0.2, 200, 0),
        rot: turnOf(shape.rot),
        pts,
        fill: hex(shape.fill),
        fillOpacity: optNum(shape.fillOpacity, 0, 1),
        stroke: hex(shape.stroke),
        strokeWidth: optNum(shape.strokeWidth, 0, 4),
        dash: dashOf(shape.dash),
        radius: optNum(shape.radius, 0, 50),
        ...base(shape),
        // An unknown kind is nobody's shape — dropped below rather than guessed at.
        bad:
          !kind ||
          !Number.isFinite(Number(shape.w)) ||
          !Number.isFinite(Number(shape.h)) ||
          (kind === 'polygon' && (pts?.length ?? 0) < 3),
      })
    })
    .filter((s) => !s.bad)
    .map(({ bad: _bad, ...s }) => s)

  const rawView = (b.view ?? {}) as Partial<BoardView>
  const half: BoardHalf | undefined =
    rawView.half === 'right' || rawView.half === 'left' ? rawView.half : undefined
  const turn: BoardTurn | undefined =
    rawView.turn === 90 || rawView.turn === 180 || rawView.turn === 270 ? rawView.turn : undefined
  const view: BoardView | undefined = half || turn ? { ...(half ? { half } : {}), ...(turn ? { turn } : {}) } : undefined

  if (!tokens.length && !paths.length && !texts.length && !shapes.length && !view) return null
  const out: Board = { tokens, paths, texts }
  if (shapes.length) out.shapes = shapes
  if (view) out.view = view
  return out
}

// ── Recording a play ────────────────────────────────────────────────────────

/**
 * A play, recorded as it was drawn.
 *
 * Every time the board changes while recording, the whole board is kept along
 * with how long into the take it happened. Playing it back is therefore exactly
 * what the coach did, in order, at the speed it was done — and because each
 * frame is a complete board, a clip opens on the field as a still at any point
 * in it.
 *
 * Whole boards rather than a diff: a play is thirty seconds of a dozen discs,
 * so the saving is not worth a format that a half-written frame can corrupt.
 */
export interface BoardFrame {
  /** Milliseconds from the start of the take. */
  at: number
  board: Board
}

export interface BoardClip {
  frames: BoardFrame[]
}

/** The playback speeds on offer — slow enough to talk over, quick enough to skim. */
export const CLIP_SPEEDS = [0.25, 0.5, 1, 1.5, 2, 4] as const

/** How long the clip runs, in milliseconds. */
export function clipLength(clip: BoardClip): number {
  return clip.frames.length ? clip.frames[clip.frames.length - 1].at : 0
}

/** The board as it stood at a moment in the clip. */
export function frameAt(clip: BoardClip, ms: number): Board {
  let board = EMPTY_BOARD
  for (const f of clip.frames) {
    if (f.at > ms) break
    board = f.board
  }
  return board
}

/**
 * How much drawing a whole clip may carry, counted in things and line points
 * across every frame. Six hundred frames of a busy play is well inside it; six
 * hundred frames of a board at its limits is not, and stops growing here.
 */
const CLIP_BUDGET = 200_000

function weight(b: Board): number {
  let n = b.tokens.length + (b.texts?.length ?? 0) + (b.shapes?.length ?? 0)
  for (const p of b.paths) n += p.points.length
  return n
}

/**
 * Read a stored clip. A clip of one still frame is a drawing, not a recording,
 * so it reads back as nothing — the board itself already holds that.
 */
/**
 * One step of a play progression: the field at that moment, and a few words on
 * what happens in it ("M sets the pick").
 */
export interface PlayStep {
  board: Board
  note: string
}

/** The most steps a progression keeps. */
export const MAX_PLAY_STEPS = 20

/** A progression as stored, cleaned. Fewer than two steps is not a progression. */
export function readSteps(raw: unknown): PlayStep[] | null {
  if (!Array.isArray(raw)) return null
  const steps: PlayStep[] = []
  for (const s of raw.slice(0, MAX_PLAY_STEPS)) {
    const row = (s ?? {}) as { board?: unknown; note?: unknown }
    const board = readBoard(row.board)
    if (!board) continue
    steps.push({ board, note: typeof row.note === 'string' ? row.note.trim().slice(0, 140) : '' })
  }
  return steps.length >= 2 ? steps : null
}

export function readClip(raw: unknown): BoardClip | null {
  if (!raw || typeof raw !== 'object') return null
  const frames = (raw as { frames?: unknown }).frames
  if (!Array.isArray(frames)) return null

  let last = -1
  let spent = 0
  const clean: BoardFrame[] = []
  for (const f of frames) {
    if (clean.length >= 600) break
    const row = (f ?? {}) as { at?: unknown; board?: unknown }
    const at = Number(row.at)
    // Time only runs forwards, and a take longer than an hour is bad data.
    if (!Number.isFinite(at) || at < 0 || at <= last || at > 3_600_000) continue
    const board = readBoard(row.board) ?? EMPTY_BOARD
    spent += weight(board)
    if (spent > CLIP_BUDGET) break
    clean.push({ at, board })
    last = at
  }
  if (clean.length < 2) return null
  return { frames: clean }
}
