// The Planner: practice plans, game plans and coaching notes.
//
// Pure — the editor is a client component and shares every one of these with the
// server. Nothing here reads cookies or the database.

import { readComp, type BlockComp } from './compete'

export type PlanKind = 'practice' | 'game' | 'note' | 'scout'

export const PLAN_KINDS: { key: PlanKind; label: string; plural: string; icon: string; blurb: string }[] = [
  { key: 'practice', label: 'Practice plan', plural: 'Practices', icon: '🥍', blurb: 'A session broken into timed blocks.' },
  { key: 'game', label: 'Game plan', plural: 'Games', icon: '🏟', blurb: 'Matchups, situations and what we run.' },
  { key: 'scout', label: 'Scout', plural: 'Scouts', icon: '🔭', blurb: 'Who we play next, and how they play.' },
  { key: 'note', label: 'Note', plural: 'Notes', icon: '📝', blurb: 'Anything that isn’t a plan yet.' },
]

/** What a block is for. Colours the block and totals the day by category. */
export interface BlockTag {
  key: string
  label: string
  color: string
}

export const BLOCK_TAGS: BlockTag[] = [
  { key: 'warmup',      label: 'Warm-up',       color: '#A9C6B4' },
  { key: 'individual',  label: 'Individual',    color: '#00693E' },
  { key: 'unit',        label: 'Unit',          color: '#0E7A50' },
  { key: 'team',        label: 'Team',          color: '#7A1F2B' },
  { key: 'specials',    label: 'Special teams', color: '#B4823A' },
  { key: 'conditioning',label: 'Conditioning',  color: '#3D6B52' },
  { key: 'install',     label: 'Install',       color: '#2F5D8C' },
  { key: 'water',       label: 'Water / reset', color: '#9AA39D' },
]

export function tagFor(key: string | undefined): BlockTag {
  return BLOCK_TAGS.find((t) => t.key === key) ?? BLOCK_TAGS[0]
}

// ── The field board ─────────────────────────────────────────────────────────

/** A men's field, in yards. Everything on a board is stored in these units. */
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

export type TokenKind = 'offense' | 'defense' | 'goalie' | 'cone' | 'ball' | 'coach'

export const TOKEN_KINDS: { key: TokenKind; label: string; fill: string; ink: string }[] = [
  { key: 'offense', label: 'Offense',  fill: '#00693E', ink: '#ffffff' },
  { key: 'defense', label: 'Defense',  fill: '#7A1F2B', ink: '#ffffff' },
  { key: 'goalie',  label: 'Goalie',   fill: '#B4823A', ink: '#ffffff' },
  { key: 'coach',   label: 'Coach',    fill: '#2F5D8C', ink: '#ffffff' },
  { key: 'cone',    label: 'Cone',     fill: '#E4863A', ink: '#3b1d05' },
  { key: 'ball',    label: 'Ball',     fill: '#f5f5f5', ink: '#17222e' },
]

export function tokenStyle(kind: TokenKind) {
  return TOKEN_KINDS.find((t) => t.key === kind) ?? TOKEN_KINDS[0]
}

export interface BoardToken {
  id: string
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
}

/** How a line ends. Both ends are set separately, like any drawing tool. */
export type EndCap = 'none' | 'arrow' | 'dot' | 'bar' | 'square'

export const END_CAPS: { key: EndCap; label: string }[] = [
  { key: 'none', label: 'Plain' },
  { key: 'arrow', label: 'Arrow' },
  { key: 'dot', label: 'Dot' },
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

/** The colours on the picker — the program's, plus the ones a board needs. */
export const BOARD_COLORS: { key: string; label: string }[] = [
  { key: '#17222e', label: 'Ink' },
  { key: '#00693E', label: 'Green' },
  { key: '#7A1F2B', label: 'Maroon' },
  { key: '#2F5D8C', label: 'Blue' },
  { key: '#B4823A', label: 'Gold' },
  { key: '#E4863A', label: 'Orange' },
  { key: '#6B21A8', label: 'Purple' },
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

export interface BoardPath {
  id: string
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
}

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
export interface BoardText {
  id: string
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
}

export interface Board {
  tokens: BoardToken[]
  paths: BoardPath[]
  texts?: BoardText[]
}

export const EMPTY_BOARD: Board = { tokens: [], paths: [], texts: [] }

/** What a line actually draws with, once its own settings have their say. */
export function pathLook(path: BoardPath) {
  const base = pathStyle(path.kind)
  return {
    color: path.color ?? base.color,
    dash: path.dash ?? base.dash,
    width: path.width ?? 0.7,
    startCap: path.startCap ?? 'none',
    endCap: path.endCap ?? (path.kind === 'screen' ? 'bar' : 'arrow'),
  }
}

/** Who is in this block, and what they are doing in it. */
export interface BlockAssignment {
  playerId: string
  /** Free text — "1st middie", "crease", "wing" — whatever the block needs. */
  role: string
}

export interface PlanBlock {
  id: string
  title: string
  minutes: number
  tag: string
  notes: string
  board?: Board | null
  /** The take, when the play on this block came out of the Library recorded. */
  clip?: BoardClip | null
  /** A screenshot pulled in from the Library, shown instead of a field. */
  shotUrl?: string | null
  /**
   * Runs at the same time as the block above it.
   *
   * A split block is two halves of one slot: the defense at one end with one
   * coach, the offense at the other with another. The clock does not advance
   * between them — the session moves on when the longer half is done.
   */
  parallel?: boolean
  /** The drill from the bank this block is running, if any. */
  drillId?: string | null
  /** A link carried over from that drill, so the block stands on its own. */
  link?: string | null
  /** The coach running it. */
  coach?: string | null
  /** Players in this block. Empty means the whole squad. */
  players?: BlockAssignment[]
  /** How this block is being won, and the score. See lib/compete. */
  comp?: BlockComp | null
}

export interface Plan {
  id: string
  kind: PlanKind
  title: string
  plan_date: string | null
  season: string | null
  summary: string | null
  blocks: PlanBlock[]
  /** A note's page: sections, checklists, charts and fields. Empty for plans. */
  content: unknown[]
  roster_id: string | null
  is_template: boolean
  /** Varsity or JV — which staff's week this belongs to. */
  team: 'varsity' | 'jv'
  /** The squads this practice is split into, for keeping the score. */
  sides: string[]
  /** 24-hour "HH:MM". The whole plan's clock runs from here. */
  start_time: string | null
  /** On the players' page in the Team Hub. */
  publish_players: boolean
  /** In the coaches' War Room. A plan starts as the author's working document. */
  publish_coaches: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`
}

export function emptyBlock(): PlanBlock {
  return {
    id: newId('b'),
    title: '',
    minutes: 10,
    tag: 'individual',
    notes: '',
    board: null,
    drillId: null,
    link: null,
    coach: null,
    players: [],
  }
}

/** Minutes from the start of the session to the start of each block. */
export function runningClock(blocks: PlanBlock[]): number[] {
  const out: number[] = []
  let total = 0
  let group = 0 // the longest half of the split that is open

  for (const [i, b] of blocks.entries()) {
    const mins = Math.max(0, Number(b.minutes) || 0)
    // A parallel block is the other half of the slot above it, so it starts
    // when that one did. The first block has nothing to run beside.
    if (b.parallel && i > 0) {
      out.push(out[i - 1])
      group = Math.max(group, mins)
      continue
    }
    total += group
    out.push(total)
    group = mins
  }
  return out
}

export function totalMinutes(blocks: PlanBlock[]): number {
  const clock = runningClock(blocks)
  let end = 0
  for (const [i, b] of blocks.entries()) {
    end = Math.max(end, clock[i] + Math.max(0, Number(b.minutes) || 0))
  }
  return end
}

/**
 * The same practice, made to fit the time you actually have.
 *
 * Everything scales by the same factor, so the shape of the session survives —
 * a plan that was half team work is still half team work at seventy minutes.
 * Rounding leaves a minute or two either way; that lands on the longest blocks,
 * because a minute off a twenty is invisible and a minute off a five is the
 * water break.
 *
 * Nothing falls below a minute. A plan with more blocks than there are minutes
 * cannot be made to fit, and comes back as close as it goes rather than as a
 * row of zeroes.
 */
export function fitBlocks(blocks: PlanBlock[], target: number): PlanBlock[] {
  const current = totalMinutes(blocks)
  if (!Number.isFinite(target) || target <= 0 || current <= 0) return blocks

  const factor = target / current
  const out = blocks.map((b) => ({
    ...b,
    minutes: Math.max(1, Math.round((Number(b.minutes) || 0) * factor)),
  }))

  // A block inside a split only moves the clock when it is the longer half, so
  // every adjustment is checked against the total rather than assumed.
  for (let guard = 0; guard < 600; guard++) {
    const now = totalMinutes(out)
    if (now === target) break
    const step = now > target ? -1 : 1
    const longestFirst = out.map((_, i) => i).sort((a, b) => out[b].minutes - out[a].minutes)

    let moved = false
    for (const i of longestFirst) {
      if (step < 0 && out[i].minutes <= 1) continue
      out[i].minutes += step
      if (totalMinutes(out) !== now) {
        moved = true
        break
      }
      out[i].minutes -= step
    }
    if (!moved) break
  }

  return out
}

/** The blocks sharing a slot with this one, this one included. */
export function splitGroup(blocks: PlanBlock[], index: number): number[] {
  let first = index
  while (first > 0 && blocks[first]?.parallel) first--
  const group = [first]
  for (let i = first + 1; i < blocks.length && blocks[i].parallel; i++) group.push(i)
  return group
}

/** Minutes per tag, biggest first — how the session was actually spent. */
export function minutesByTag(blocks: PlanBlock[]): { tag: BlockTag; minutes: number }[] {
  const totals = new Map<string, number>()
  for (const b of blocks) {
    const mins = Math.max(0, Number(b.minutes) || 0)
    if (!mins) continue
    totals.set(b.tag, (totals.get(b.tag) ?? 0) + mins)
  }
  return [...totals.entries()]
    .map(([key, minutes]) => ({ tag: tagFor(key), minutes }))
    .sort((a, b) => b.minutes - a.minutes)
}

/** "1h 45m", or "45m". Blank for nothing. */
export function formatMinutes(mins: number): string {
  if (!mins) return '—'
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h ? (m ? `${h}h ${m}m` : `${h}h`) : `${m}m`
}

/** The hour a plan runs from when nobody has said otherwise. */
export const DEFAULT_START = '16:00'

/** A start time we are willing to run a clock off. */
export function readStart(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const m = raw.trim().match(/^(\d{1,2}):(\d{2})/)
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) return null
  return `${String(h).padStart(2, '0')}:${m[2]}`
}

/** Minutes between two times of day, the second being the later one. */
export function minutesBetween(start: string, end: string): number | null {
  const a = readStart(start)
  const b = readStart(end)
  if (!a || !b) return null
  const [ah, am] = a.split(':').map(Number)
  const [bh, bm] = b.split(':').map(Number)
  const mins = bh * 60 + bm - (ah * 60 + am)
  // A session that ends before it starts ran past midnight.
  return mins > 0 ? mins : mins + 24 * 60
}

/** Clock time for a block, given a start like "16:00". */
export function clockAt(start: string | null, offsetMins: number): string | null {
  if (!start || !/^\d{1,2}:\d{2}$/.test(start)) return null
  const [h, m] = start.split(':').map(Number)
  const total = h * 60 + m + offsetMins
  const hh = Math.floor(total / 60) % 24
  const mm = total % 60
  const ampm = hh >= 12 ? 'PM' : 'AM'
  const h12 = hh % 12 === 0 ? 12 : hh % 12
  return `${h12}:${String(mm).padStart(2, '0')} ${ampm}`
}

/** Parse whatever came out of the jsonb column into blocks we can trust. */
export function readBlocks(raw: unknown): PlanBlock[] {
  if (!Array.isArray(raw)) return []
  return raw.map((r) => {
    const b = (r ?? {}) as Partial<PlanBlock>
    return {
      id: typeof b.id === 'string' ? b.id : newId('b'),
      title: typeof b.title === 'string' ? b.title : '',
      minutes: Number(b.minutes) || 0,
      tag: typeof b.tag === 'string' ? b.tag : 'individual',
      notes: typeof b.notes === 'string' ? b.notes : '',
      board: readBoard(b.board),
      parallel: b.parallel === true,
      clip: readClip(b.clip),
      shotUrl: readShotUrl(b.shotUrl),
      drillId: typeof b.drillId === 'string' ? b.drillId : null,
      // Four is the most sides a practice can be split into; extra scores go.
      comp: readComp(b.comp, 4),
      link: typeof b.link === 'string' && b.link.trim() ? b.link.trim() : null,
      coach: typeof b.coach === 'string' && b.coach.trim() ? b.coach.trim() : null,
      players: Array.isArray(b.players)
        ? b.players
            .map((a) => {
              const row = (a ?? {}) as Partial<BlockAssignment>
              return {
                playerId: typeof row.playerId === 'string' ? row.playerId : '',
                role: typeof row.role === 'string' ? row.role : '',
              }
            })
            .filter((a) => a.playerId)
        : [],
    }
  })
}

/**
 * A picture pulled in from the Library. Only our own kind of address: a note is
 * rendered on a public-facing page for the team, and a stored javascript: or
 * data: URL is somebody's idea of a joke.
 */
export function readShotUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const url = raw.trim()
  return /^https?:\/\//i.test(url) ? url : null
}

export function readBoard(raw: unknown): Board | null {
  if (!raw || typeof raw !== 'object') return null
  const b = raw as Partial<Board>

  const hex = (v: unknown): string | undefined =>
    typeof v === 'string' && /^#[0-9a-f]{3,8}$/i.test(v) ? v : undefined
  const cap = (v: unknown): EndCap | undefined =>
    END_CAPS.some((c) => c.key === v) ? (v as EndCap) : undefined

  const tokens = Array.isArray(b.tokens)
    ? b.tokens.map((t) => {
        const tok = (t ?? {}) as Partial<BoardToken>
        return {
          id: typeof tok.id === 'string' ? tok.id : newId('t'),
          kind: (TOKEN_KINDS.some((k) => k.key === tok.kind) ? tok.kind : 'offense') as TokenKind,
          x: Number(tok.x) || 0,
          y: Number(tok.y) || 0,
          label: typeof tok.label === 'string' ? tok.label : '',
          playerId: typeof tok.playerId === 'string' ? tok.playerId : undefined,
          color: hex(tok.color),
        }
      })
    : []

  const paths = Array.isArray(b.paths)
    ? b.paths
        .map((p) => {
          const path = (p ?? {}) as Partial<BoardPath>
          const points = Array.isArray(path.points)
            ? path.points.map((pt) => ({ x: Number(pt?.x) || 0, y: Number(pt?.y) || 0 }))
            : []
          const width = Number(path.width)
          return {
            id: typeof path.id === 'string' ? path.id : newId('p'),
            kind: (PATH_KINDS.some((k) => k.key === path.kind) ? path.kind : 'run') as PathKind,
            points,
            color: hex(path.color),
            // A stroke of nothing or of a mile is somebody's bad data, not a choice.
            width: Number.isFinite(width) && width > 0 ? Math.min(width, 4) : undefined,
            dash: typeof path.dash === 'string' ? path.dash : undefined,
            startCap: cap(path.startCap),
            endCap: cap(path.endCap),
          }
        })
        .filter((p) => p.points.length >= 2)
    : []

  const texts = Array.isArray(b.texts)
    ? b.texts
        .map((t) => {
          const text = (t ?? {}) as Partial<BoardText>
          const size = Number(text.size)
          return {
            id: typeof text.id === 'string' ? text.id : newId('x'),
            x: Number(text.x) || 0,
            y: Number(text.y) || 0,
            text: typeof text.text === 'string' ? text.text : '',
            size: Number.isFinite(size) && size > 0 ? Math.min(size, 12) : 3,
            color: hex(text.color) ?? '#17222e',
            bold: text.bold === true,
            italic: text.italic === true,
            underline: text.underline === true,
            font: BOARD_FONTS.some((f) => f.key === text.font) ? text.font : undefined,
            align: (['start', 'middle', 'end'] as const).includes(text.align as TextAlign)
              ? (text.align as TextAlign)
              : undefined,
          }
        })
        .filter((t) => t.text.trim().length > 0)
    : []

  if (!tokens.length && !paths.length && !texts.length) return null
  return { tokens, paths, texts }
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
 * Read a stored clip. A clip of one still frame is a drawing, not a recording,
 * so it reads back as nothing — the board itself already holds that.
 */
export function readClip(raw: unknown): BoardClip | null {
  if (!raw || typeof raw !== 'object') return null
  const frames = (raw as { frames?: unknown }).frames
  if (!Array.isArray(frames)) return null

  let last = -1
  const clean: BoardFrame[] = []
  for (const f of frames) {
    const row = (f ?? {}) as { at?: unknown; board?: unknown }
    const at = Number(row.at)
    // Time only runs forwards, and a take longer than an hour is bad data.
    if (!Number.isFinite(at) || at < 0 || at <= last || at > 3_600_000) continue
    clean.push({ at, board: readBoard(row.board) ?? EMPTY_BOARD })
    last = at
  }
  if (clean.length < 2) return null
  return { frames: clean.slice(0, 600) }
}
