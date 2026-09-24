// The Playbook: what we are actually running, in order, with the words round it.
//
// The Library is a shelf — everything anybody kept, in case. This is the deck:
// a page per play, a title, the reads, the coaching points, and the pages that
// are only words. Varsity and JV keep their own, and the head coach is the only
// one who writes either.
//
// Pure — the editor and the viewer both import it.

import { DEFAULT_TEAM, isTeam, type Team } from './teams'
import { EMPTY_BOARD, readBoard, type Board } from './planner'

export const PLAYBOOK_KEY = 'playbook'

/**
 * The slide's own coordinate space.
 *
 * Everything on a free page is positioned in these units, and the page is drawn
 * by scaling the whole stage to whatever width it has been given. So a slide
 * laid out on a laptop is the same slide on the projector and on a phone —
 * nothing reflows, nothing moves, the type does not creep.
 *
 * 16:9, because that is what a projector and a phone held sideways both are.
 */
export const SLIDE_W = 1000
export const SLIDE_H = 562

/** Where a block sits on the stage, in slide units. */
export interface Frame {
  x: number
  y: number
  w: number
  h: number
}

export function clampFrame(f: Frame): Frame {
  const w = Math.max(24, Math.min(SLIDE_W, Math.round(f.w)))
  const h = Math.max(24, Math.min(SLIDE_H, Math.round(f.h)))
  return {
    w,
    h,
    x: Math.max(0, Math.min(SLIDE_W - w, Math.round(f.x))),
    y: Math.max(0, Math.min(SLIDE_H - h, Math.round(f.y))),
  }
}

export function readFrame(raw: unknown): Frame | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const o = raw as Record<string, unknown>
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null)
  const x = n(o.x), y = n(o.y), w = n(o.w), h = n(o.h)
  if (x === null || y === null || w === null || h === null) return undefined
  return clampFrame({ x, y, w, h })
}

/**
 * What a page is.
 *
 * Three kinds a playbook is made of:
 *
 *   field    the page is the field — full field or one end, turned or not,
 *            grass edge to edge. The words, arrows and players are drawn on
 *            the field itself.
 *   words    a title and what you want to say: a section divider, the
 *            install plan, the calls.
 *   picture  a photo or a screenshot, the whole page.
 *
 * The older arranged layouts (free, side by side, stacked, full bleed) still
 * read and still edit, for the pages made before these.
 */
export type PageKind = 'field' | 'words' | 'picture'
export type PageLayout = PageKind | 'split' | 'stack' | 'full' | 'free'

export const PAGE_KINDS: { key: PageKind; label: string; icon: string; hint: string }[] = [
  { key: 'field', label: 'Field', icon: '🥍', hint: 'The page is the field. Draw on it full screen — players, runs, words.' },
  { key: 'words', label: 'Words', icon: '✍️', hint: 'A title and what you want to say.' },
  { key: 'picture', label: 'Picture', icon: '🖼', hint: 'A photo or screenshot, the whole page.' },
]

export const PAGE_LAYOUTS: { key: PageLayout; label: string; hint: string }[] = [
  { key: 'free', label: 'Free', hint: 'Put everything exactly where you want it. Drag to move, pull a corner to resize.' },
  { key: 'split', label: 'Side by side', hint: 'The play on the left, the words on the right — laid out for you.' },
  { key: 'stack', label: 'Stacked', hint: 'The words under the play — better on a phone.' },
  { key: 'full', label: 'Full bleed', hint: 'The play as big as the page allows.' },
]

export function isPageKind(v: unknown): v is PageKind {
  return v === 'field' || v === 'words' || v === 'picture'
}

export function isLayout(v: unknown): v is PageLayout {
  return isPageKind(v) || v === 'split' || v === 'stack' || v === 'full' || v === 'free'
}

/** The first block of a kind on a page — a field page's field, a picture page's picture. */
export function firstOf<K extends SlideBlock['kind']>(blocks: SlideBlock[], kind: K): Extract<SlideBlock, { kind: K }> | null {
  return (blocks.find((b) => b.kind === kind) as Extract<SlideBlock, { kind: K }> | undefined) ?? null
}

/** A new page's blocks, by kind. A field page starts as a blank field of its own. */
export function startingBlocks(kind: PageKind, opts: { half?: boolean; playId?: string } = {}): SlideBlock[] {
  if (kind === 'field') {
    if (opts.playId) return [{ kind: 'play', id: 'b1', playId: opts.playId }]
    return [{ kind: 'play', id: 'b1', playId: '', board: opts.half ? { ...EMPTY_BOARD, view: { half: 'right' } } : EMPTY_BOARD }]
  }
  if (kind === 'words') return [{ kind: 'text', id: 'b1', body: '', size: 'body' }]
  return []
}

export type TextSize = 'heading' | 'body' | 'small'

export const TEXT_SIZES: { key: TextSize; label: string }[] = [
  { key: 'heading', label: 'Heading' },
  { key: 'body', label: 'Body' },
  { key: 'small', label: 'Small print' },
]

/** What a named size means on the stage, when no exact size was set. */
export const SIZE_PT: Record<TextSize, number> = { heading: 40, body: 26, small: 18 }

export type TextAlign = 'left' | 'center' | 'right'

/** Everything a block has in common: where it sits and what is on top. */
interface Placed {
  id: string
  /** Absent on a page laid out for you. Present the moment anything is moved. */
  frame?: Frame
  /** Higher is nearer the front. */
  z?: number
}

/**
 * A field on the page.
 *
 * Two ways to get one, and the difference matters. `playId` points at a play in
 * the Library — the same play the whole staff uses, so fixing the spacing on it
 * fixes it everywhere it appears. `board` is this page's own: drawn here,
 * changed here, and changing it changes nothing else.
 *
 * A block with both is a copy that has been taken off the shelf and made the
 * page's own, so the page's board wins.
 */
export interface PlayBlock extends Placed {
  kind: 'play'
  playId: string
  /** This page's own field, when it isn't borrowing one from the Library. */
  board?: Board
  caption?: string
}
export interface ShotBlock extends Placed {
  kind: 'shot'
  url: string
  caption?: string
}
export interface TextBlock extends Placed {
  kind: 'text'
  body: string
  size: TextSize
  /** Exact size on the stage. Overrides `size` when set. */
  pt?: number
  color?: string
  bold?: boolean
  italic?: boolean
  align?: TextAlign
  /** A panel behind the words, so they read over a field. */
  fill?: string
}
export interface ListBlock extends Placed {
  kind: 'list'
  items: string[]
  /** "Reads", "Coaching points", "If they slide early" — whatever the list is. */
  heading?: string
  pt?: number
  color?: string
  fill?: string
}

/** The drawing tools: a circle round a player, an arrow, a block of colour. */
export type ShapeKind = 'rect' | 'ellipse' | 'arrow' | 'line'

export interface ShapeBlock extends Placed {
  kind: 'shape'
  shape: ShapeKind
  color?: string
  /** Filled, or an outline. Lines and arrows are always drawn, never filled. */
  filled?: boolean
  width?: number
}

export type SlideBlock = PlayBlock | ShotBlock | TextBlock | ListBlock | ShapeBlock

/**
 * What the Insert row offers.
 *
 * A blank board and a saved play are the same kind of block underneath — a
 * field on the page — but they are two different decisions, so they are two
 * buttons rather than a dropdown you have to find.
 */
export type InsertKind = SlideBlock['kind'] | 'blank'

export const BLOCK_KINDS: { kind: InsertKind; label: string; icon: string }[] = [
  { kind: 'blank', label: 'Blank board', icon: '⬚' },
  { kind: 'play', label: 'Saved play', icon: '🖍' },
  { kind: 'shot', label: 'Picture', icon: '🖼' },
  { kind: 'text', label: 'Text box', icon: '✍️' },
  { kind: 'list', label: 'List', icon: '•' },
  { kind: 'shape', label: 'Shape', icon: '◯' },
]

/** The colours anything on a slide can be — the program's, plus black and white. */
export const SLIDE_COLORS = [
  '#111111', '#ffffff', '#00693E', '#7A1F2B', '#2a78d6', '#eb6834', '#eda100', '#6b7280',
]

export const SHAPES: { key: ShapeKind; label: string }[] = [
  { key: 'rect', label: 'Rectangle' },
  { key: 'ellipse', label: 'Circle' },
  { key: 'arrow', label: 'Arrow' },
  { key: 'line', label: 'Line' },
]

export interface PlaybookPage {
  id: string
  team: Team
  sortOrder: number
  title: string
  blocks: SlideBlock[]
  layout: PageLayout
  notes: string | null
  createdBy: string | null
  updatedAt: string
}

/** Playbook-level settings, kept in app_settings so they need no migration. */
export interface PlaybookSettings {
  title: string
  /** On the players' side of the Team Hub. */
  publishPlayers: boolean
  /** Readable by the rest of the coaching staff. */
  publishCoaches: boolean
}

export const DEFAULT_SETTINGS: PlaybookSettings = {
  title: 'Playbook',
  publishPlayers: false,
  publishCoaches: false,
}

export function settingsKey(team: Team): string {
  return `${PLAYBOOK_KEY}:${team}`
}

export function readSettings(raw: unknown): PlaybookSettings {
  if (typeof raw !== 'string' || !raw) return { ...DEFAULT_SETTINGS }
  try {
    const o = JSON.parse(raw) as Partial<PlaybookSettings>
    return {
      title: typeof o.title === 'string' && o.title.trim() ? o.title : DEFAULT_SETTINGS.title,
      publishPlayers: o.publishPlayers === true,
      publishCoaches: o.publishCoaches === true,
    }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

// ── Reading a page back out of the database ──────────────────────────────────

const str = (v: unknown, fallback = '') => (typeof v === 'string' ? v : fallback)

/**
 * One block, kept honest.
 *
 * Anything that doesn't read as a block it recognises is dropped rather than
 * rendered as a hole — a half-written page from a future version of this file
 * should lose that block, not take the page down with it.
 */
const num = (v: unknown): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) ? v : undefined
const color = (v: unknown): string | undefined =>
  typeof v === 'string' && /^#[0-9a-f]{3,8}$/i.test(v) ? v : undefined

export function readBlock(raw: unknown): SlideBlock | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const id = str(o.id) || Math.random().toString(36).slice(2)
  const placed = { id, frame: readFrame(o.frame), z: num(o.z) }
  switch (o.kind) {
    case 'play': {
      const playId = str(o.playId)
      /* Whether the page owns a board is the presence of the key, not whether
         anything has been drawn on it yet — readBoard says null for an empty
         one, and an empty one is exactly what a blank board starts as. */
      const owns = !!o.board && typeof o.board === 'object'
      const board = owns ? readBoard(o.board) ?? EMPTY_BOARD : undefined
      // One or the other, or it is a block pointing at nothing.
      if (!playId && !board) return null
      return { ...placed, kind: 'play', playId, board, caption: str(o.caption) || undefined }
    }
    case 'shot': {
      const url = str(o.url)
      return url ? { ...placed, kind: 'shot', url, caption: str(o.caption) || undefined } : null
    }
    case 'text': {
      const size = o.size === 'heading' || o.size === 'small' ? o.size : 'body'
      const align = o.align === 'center' || o.align === 'right' ? o.align : undefined
      return {
        ...placed,
        kind: 'text',
        body: str(o.body),
        size,
        pt: num(o.pt),
        color: color(o.color),
        fill: color(o.fill),
        bold: o.bold === true || undefined,
        italic: o.italic === true || undefined,
        align,
      }
    }
    case 'list': {
      const items = Array.isArray(o.items) ? o.items.map((i) => str(i)).filter(Boolean) : []
      return {
        ...placed,
        kind: 'list',
        items,
        heading: str(o.heading) || undefined,
        pt: num(o.pt),
        color: color(o.color),
        fill: color(o.fill),
      }
    }
    case 'shape': {
      const shape: ShapeKind =
        o.shape === 'ellipse' || o.shape === 'arrow' || o.shape === 'line' ? o.shape : 'rect'
      return {
        ...placed,
        kind: 'shape',
        shape,
        color: color(o.color),
        filled: o.filled === true || undefined,
        width: num(o.width),
      }
    }
    default:
      return null
  }
}

/** Blocks back to front, which is the order they are painted in. */
export function inZOrder(blocks: SlideBlock[]): SlideBlock[] {
  return blocks
    .map((b, i) => ({ b, i }))
    .sort((a, x) => (a.b.z ?? a.i) - (x.b.z ?? x.i) || a.i - x.i)
    .map(({ b }) => b)
}

/** Is this page positioned by hand? */
export function isFree(page: { layout: PageLayout; blocks: SlideBlock[] }): boolean {
  return page.layout === 'free' && page.blocks.every((b) => !!b.frame)
}

/**
 * Give every block a place, so a page laid out for you can be taken over by
 * hand without everything piling up in the top corner.
 *
 * Roughly where the old layout put things: the boards down the left, the words
 * down the right, the title's own space left clear at the top.
 */
export function autoFrames(blocks: SlideBlock[], layout: PageLayout): SlideBlock[] {
  const boards = blocks.filter((b) => b.kind === 'play' || b.kind === 'shot')
  const words = blocks.filter((b) => b.kind !== 'play' && b.kind !== 'shot')
  const top = 96
  const out = new Map<string, Frame>()

  if (layout === 'stack' || boards.length === 0 || words.length === 0) {
    const all = [...boards, ...words]
    const h = Math.max(60, Math.floor((SLIDE_H - top - 24) / Math.max(1, all.length)))
    all.forEach((b, i) => out.set(b.id, { x: 48, y: top + i * h, w: SLIDE_W - 96, h: h - 12 }))
  } else {
    const colW = layout === 'full' ? SLIDE_W - 96 : Math.round((SLIDE_W - 120) * 0.56)
    const bh = Math.max(80, Math.floor((SLIDE_H - top - 24) / boards.length))
    boards.forEach((b, i) => out.set(b.id, { x: 48, y: top + i * bh, w: colW, h: bh - 12 }))
    const wx = 48 + colW + 24
    const ww = SLIDE_W - wx - 48
    const wh = Math.max(50, Math.floor((SLIDE_H - top - 24) / words.length))
    words.forEach((b, i) => out.set(b.id, { x: wx, y: top + i * wh, w: ww, h: wh - 12 }))
  }

  return blocks.map((b, i) => ({ ...b, z: b.z ?? i, frame: b.frame ?? clampFrame(out.get(b.id) ?? { x: 48, y: top, w: 320, h: 120 }) }))
}

export function readBlocks(raw: unknown): SlideBlock[] {
  if (!Array.isArray(raw)) return []
  return raw.map(readBlock).filter((b): b is SlideBlock => b !== null)
}

export function readPage(row: Record<string, unknown>): PlaybookPage {
  return {
    id: String(row.id),
    team: isTeam(row.team) ? row.team : DEFAULT_TEAM,
    sortOrder: Number(row.sort_order) || 0,
    title: str(row.title),
    blocks: readBlocks(row.blocks),
    layout: isLayout(row.layout) ? row.layout : 'split',
    notes: (row.notes as string) ?? null,
    createdBy: (row.created_by as string) ?? null,
    updatedAt: String(row.updated_at ?? ''),
  }
}

// ── Making one ───────────────────────────────────────────────────────────────

let seq = 0
/** Ids only have to be unique inside one page. */
export function blockId(): string {
  seq += 1
  return `b${seq}-${Math.random().toString(36).slice(2, 8)}`
}

export function emptyBlock(kind: InsertKind, frame?: Frame): SlideBlock {
  const id = blockId()
  // Something you can see and grab the moment it lands, near the middle.
  const at = (w: number, h: number): Frame =>
    frame ?? clampFrame({ x: Math.round((SLIDE_W - w) / 2), y: Math.round((SLIDE_H - h) / 2), w, h })
  switch (kind) {
    case 'blank':
      // An empty field, this page's own, ready to be drawn on.
      return { kind: 'play', id, playId: '', board: EMPTY_BOARD, frame: at(600, 400) }
    case 'play':
      return { kind: 'play', id, playId: '', frame: at(540, 360) }
    case 'shot':
      return { kind: 'shot', id, url: '', frame: at(460, 300) }
    case 'list':
      return { kind: 'list', id, items: [''], frame: at(380, 200) }
    case 'shape':
      return { kind: 'shape', id, shape: 'ellipse', color: '#7A1F2B', frame: at(160, 160) }
    default:
      return { kind: 'text', id, body: '', size: 'body', frame: at(420, 110) }
  }
}

/** The play a page leads with, for the thumbnail on the deck screen. */
export function leadPlayId(page: PlaybookPage): string | null {
  const found = page.blocks.find((b) => b.kind === 'play') as PlayBlock | undefined
  return found?.playId || null
}

/** Is this field the page's own, rather than one borrowed from the Library? */
export function ownsBoard(block: PlayBlock): boolean {
  return !!block.board
}

/** A page with nothing on it reads as a section divider, not a mistake. */
export function isDivider(page: PlaybookPage): boolean {
  return page.blocks.length === 0
}

/** Move a page within the deck, returning the new order of ids. */
export function reorder(ids: string[], from: number, to: number): string[] {
  if (from === to || from < 0 || to < 0 || from >= ids.length || to >= ids.length) return ids
  const next = [...ids]
  next.splice(to, 0, next.splice(from, 1)[0])
  return next
}
