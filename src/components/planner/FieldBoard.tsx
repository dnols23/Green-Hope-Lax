'use client'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import {
  FIELD,
  newId,
  readBoard,
  type Board,
  type BoardHalf,
  type BoardPath,
  type BoardShape,
  type BoardText,
  type BoardToken,
  type BoardTurn,
  type TokenKind,
} from '@/lib/planner'
import { FORMATIONS, facingAt, goalNear, placeLook, placeSpots, type SavedLook } from '@/lib/formations'
import { BoardViewer, useDoubleTap } from './BoardViewer'
import {
  addBundle,
  align as alignItems,
  allIds,
  bundleIds,
  bundleOf,
  clean,
  cloneBundle,
  deleteItems,
  distribute as distributeItems,
  emptyBundle,
  findItem,
  frameOf,
  itemBox,
  mapItems,
  moveItems,
  patchAll,
  reorder,
  resizeShape,
  scaleItems,
  selectionBox,
  snapBox,
  stack,
  withGroups,
  type Bundle,
  type Guide,
  type Item,
  type Mappers,
} from './board/items'
import { boxInside, dist, rotatePt, simplify, type Box, type Pt } from './board/geometry'
import { BoardItems, CapMarkers, capColors, FieldLines, PathView, ShapeView, TokenView, type ItemHandlers } from './board/Render'
import { useHistory } from './board/useHistory'
import { Toolbar } from './board/Toolbar'
import { PropsBar } from './board/PropsBar'
import { ContextMenu } from './board/ContextMenu'
import { SelectionOverlay, type HandleHit } from './board/Overlay'
import { TextEditor } from './board/TextEditor'
import {
  DEFAULT_LINE_PEN,
  DEFAULT_SHAPE_PEN,
  DEFAULT_TEXT_PEN,
  type BoardPlayer,
  type BoardPrefs,
  type Editor,
  type LinePen,
  type ShapePen,
  type TextPen,
  type Tool,
} from './board/types'

export type { BoardPlayer }

const PAD = 4 // yards of grass drawn outside the lines
const GRASS = '#4a7f52'
/** Copy on one board, paste on another — the plan's block and the playbook page. */
const CLIPBOARD = 'gh-board-clipboard-v1'
/** How far a finger may wander before a press is a drag. A mouse is steadier. */
const SLOP = { touch: 8, mouse: 3 }
const LONG_PRESS_MS = 480

/** A whole field on a phone held upright is a ribbon; full screen turns it. */
function wantsAutoTurn(half: BoardHalf, turn: BoardTurn): boolean {
  if (typeof window === 'undefined') return false
  return half === 'off' && (turn === 0 || turn === 180) && window.innerHeight > window.innerWidth
}

type Zoom = { s: number; cx: number; cy: number }

/** The part of the drawing on the glass when zoomed in: a smaller box inside the whole, kept inside it. */
function zoomBox(vb: Box, z: Zoom | null): Box {
  if (!z || z.s <= 1) return vb
  const w = vb.w / z.s
  const h = vb.h / z.s
  return {
    x: Math.max(vb.x, Math.min(vb.x + vb.w - w, z.cx - w / 2)),
    y: Math.max(vb.y, Math.min(vb.y + vb.h - h, z.cy - h / 2)),
    w,
    h,
  }
}

/** What the pointer is in the middle of. One at a time, the way a hand works. */
type Gesture =
  | { g: 'move'; id: number; key: string; sx: number; sy: number; from: Pt; ids: string[]; base: Board; moved: boolean; toggleOff: string[] | null; touch: boolean; double: Item | null }
  | { g: 'marquee'; id: number; sx: number; sy: number; from: Pt; additive: boolean; before: string[]; touch: boolean; double: boolean }
  | { g: 'handle'; id: number; key: string; hit: HandleHit; from: Pt; base: Board; moved: boolean; double: boolean }
  | { g: 'draw'; id: number; sx: number; sy: number; from: Pt; points: Pt[]; moved: boolean; touch: boolean }
  | { g: 'stamp'; id: number; at: Pt }
  | { g: 'pinch'; a: number; b: number; d0: number; s0: number; u0: Pt; last: Pt }

/**
 * A lacrosse field you can draw plays on.
 *
 * Everything is stored in yards, so a board drawn on a phone opens identically
 * on the projector — the SVG scales, the positions don't. The tools work the
 * way a drawing program's do: pick one from the bar (players, lines, shapes,
 * words), draw with it, and the Select arrow picks things up to move,
 * stretch, turn, restyle, copy and arrange. Every change can be undone.
 */
export function FieldBoard({
  board,
  onChange,
  players = [],
  readOnly = false,
  onShot,
  extraTools,
  fit = false,
  fill = false,
  zoomable = true,
  title,
  startFull = false,
  onLeaveFull,
}: {
  board: Board
  onChange?: (next: Board) => void
  /** Players already picked for this block — the only ones offered for the field. */
  players?: BoardPlayer[]
  readOnly?: boolean
  /** Given, a Photo button appears and hands back a PNG of the field as it stands. */
  onShot?: (png: Blob) => void | Promise<void>
  /** Buttons that belong to whoever is using the board — recording, mostly. */
  extraTools?: ReactNode
  /** Fill the box it is given, both ways, rather than the width. The full-screen viewer uses it. */
  fit?: boolean
  /** A read-only board opens full screen on a double tap. Off where that makes no sense — a clip mid-play. */
  zoomable?: boolean
  /** Named in the full-screen view's header. */
  title?: string | null
  /** The field is the whole page: grass edge to edge, the field centred in it. */
  fill?: boolean
  /** Open straight into full-screen editing — a playbook page's field. */
  startFull?: boolean
  /** Told when full screen is left, so whoever opened it can close it. */
  onLeaveFull?: () => void
}) {
  const [shooting, setShooting] = useState(false)
  /* Which end and which way up are the board's own, saved with it (see
     BoardView), so the editor and every page that shows the play agree. Full
     screen on an upright phone adds a quarter turn of its own on top, which is
     never saved. */
  const half: BoardHalf = board.view?.half ?? 'off'
  const savedTurn: BoardTurn = board.view?.turn ?? 0
  const [autoTurn, setAutoTurn] = useState(() => startFull && wantsAutoTurn(half, savedTurn))
  const turn = autoTurn ? ((savedTurn + 90) % 360) as BoardTurn : savedTurn
  const clipId = `clip${useId().replace(/[^a-z0-9]/gi, '')}`
  const svgRef = useRef<SVGSVGElement>(null)
  /* The group everything is drawn in, in field yards. Every screen point is
     turned into yards through this one element's matrix. */
  const fieldRef = useRef<SVGGElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  /** The box the field sits in — the text editor is laid over it. */
  const boxRef = useRef<HTMLDivElement>(null)

  /* The staff's own saved groups. Fetched by the board rather than handed down,
     so a note with four fields in it does not load the shelf four times. */
  const [looks, setLooks] = useState<SavedLook[]>([])
  const [full, setFull] = useState(startFull)
  // The read-only board, blown up to the whole screen.
  const [viewing, setViewing] = useState(false)

  const [tool, setToolState] = useState<Tool>({ t: 'select' })
  const [sel, setSel] = useState<string[]>([])
  const [gesture, setGesture] = useState<Gesture | null>(null)
  /** What is being drawn, shown as it is drawn. */
  const [draft, setDraft] = useState<{ path?: BoardPath; shape?: BoardShape; token?: BoardToken } | null>(null)
  /** A line or polygon being put down a tap at a time, and where the mouse is. */
  const [multi, setMulti] = useState<Pt[] | null>(null)
  const [hover, setHover] = useState<Pt | null>(null)
  const [marquee, setMarquee] = useState<Box | null>(null)
  const [guides, setGuides] = useState<Guide[]>([])
  /* Where the context menu is open, in viewport pixels. Right-click on a laptop
     or a long press on a phone opens it, over the field, where the finger
     already is — the way a format menu works everywhere else. */
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)
  /** A word being typed into, and where its anchor sits on the glass. */
  const [editing, setEditing] = useState<{ id: string; left: number; top: number; key: string } | null>(null)
  const [linePen, setLinePenState] = useState<LinePen>(DEFAULT_LINE_PEN)
  const [shapePen, setShapePenState] = useState<ShapePen>(DEFAULT_SHAPE_PEN)
  const [textPen, setTextPenState] = useState<TextPen>(DEFAULT_TEXT_PEN)
  const [prefs, setPrefsState] = useState<BoardPrefs>({ grid: false, snapGrid: false, snapObjects: true })
  const [zoom, setZoom] = useState<Zoom | null>(null)
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)
  const [nextKind, setNextKind] = useState<TokenKind>('offense')
  const [pasteN, setPasteN] = useState(0)
  const history = useHistory(board, onChange)

  /* A long press is a right-click for a finger. One timer for the whole board;
     a finger that slides more than a few pixels was dragging, not pressing. */
  const press = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** Where every finger on the glass is — two of them is a pinch. */
  const fingers = useRef(new Map<number, Pt>())
  /** The last press on a thing, to tell a double tap on it from two taps. */
  const lastTap = useRef<{ key: string; t: number; x: number; y: number } | null>(null)

  useEffect(() => {
    if (readOnly) return
    let live = true
    fetch('/api/looks')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('no'))))
      .then((d: { looks?: SavedLook[] }) => live && setLooks(d.looks ?? []))
      .catch(() => {
        // No shelf is not an error — the preset sets are still there.
      })
    return () => {
      live = false
    }
  }, [readOnly])

  // The size of the field on the glass, for handles a finger can find at any zoom.
  useEffect(() => {
    const el = svgRef.current
    if (readOnly || !el) return
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [readOnly])

  /* Which part of the field is on the glass, and which way up.
     A play is drawn in one end, and a 110-yard field shrunk to fit a phone is a
     ribbon — so the half field is the useful view, and the turn is for a phone
     held upright, where the cage wants to be at the top. */
  const win =
    half === 'off'
      ? { x: 0, y: 0, w: FIELD.length + PAD * 2, h: FIELD.width + PAD * 2 }
      : half === 'right'
        ? { x: FIELD.length / 2, y: 0, w: FIELD.length / 2 + PAD * 2, h: FIELD.width + PAD * 2 }
        : { x: 0, y: 0, w: FIELD.length / 2 + PAD * 2, h: FIELD.width + PAD * 2 }

  const turned = turn === 90 || turn === 270
  // The part of the drawing that is on the glass, in the svg's own units.
  const vb = turned ? { x: 0, y: 0, w: win.h, h: win.w } : win
  const view = zoomBox(vb, zoom)
  const viewBox = `${view.x} ${view.y} ${view.w} ${view.h}`
  /* Turning the board is one transform on the group everything hangs off.
     Nothing else in here knows about it, because the pointer maths asks the
     browser where a point landed rather than working it out. */
  const spin =
    turn === 90
      ? `translate(${win.h},0) rotate(90) translate(${-win.x},${-win.y})`
      : turn === 180
        ? `translate(${win.w},${win.h}) rotate(180) translate(${-win.x},${-win.y})`
        : turn === 270
          ? `translate(0,${win.w}) rotate(270) translate(${-win.x},${-win.y})`
          : undefined

  /** Screen pixels per yard, as the field is shown right now. */
  const k = size ? Math.min(size.w / view.w, size.h / view.h) : 8
  /** A distance on the glass, in yards. */
  const px = (n: number) => n / k

  // Whatever was selected and has since gone (an undo, a clip frame) is not selected.
  const selIds = sel.filter((id) => findItem(board, id))
  const selItems = stack(board).filter((x) => selIds.includes(x.it.id))

  /**
   * Screen point → field yards.
   *
   * Asked of the browser rather than worked out from the bounding box: with the
   * board turned, or letterboxed inside a full-screen panel, the arithmetic
   * version puts a disc somewhere the finger was not.
   */
  function toField(e: { clientX: number; clientY: number }, clamp = true): Pt {
    const m = fieldRef.current?.getScreenCTM()
    if (!m) return { x: 0, y: 0 }
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse())
    const x = Math.round(p.x * 10) / 10
    const y = Math.round(p.y * 10) / 10
    return clamp ? { x: Math.max(0, Math.min(FIELD.length, x)), y: Math.max(0, Math.min(FIELD.width, y)) } : { x, y }
  }

  /** Field yards → pixels inside the box the field sits in. */
  function toBox(p: Pt): Pt {
    const m = fieldRef.current?.getScreenCTM()
    const box = boxRef.current?.getBoundingClientRect()
    if (!m || !box) return { x: 0, y: 0 }
    const s = new DOMPoint(p.x, p.y).matrixTransform(m)
    return { x: s.x - box.left, y: s.y - box.top }
  }

  const snap = (p: Pt): Pt => (prefs.snapGrid ? { x: Math.round(p.x), y: Math.round(p.y) } : p)

  // ── Changing the board ────────────────────────────────────────────────────

  const commit = (next: Board, key?: string, windowMs?: number) => history.commit(next, key, windowMs)

  /** Put new things on the board, and pick them. */
  function add(b: Bundle, select = true) {
    commit(addBundle(board, b))
    if (select) setSel(bundleIds(b))
  }

  function setTool(t: Tool) {
    setToolState(t)
    setMulti(null)
    setHover(null)
    setDraft(null)
    setMenu(null)
    if (t.t !== 'select') setSel([])
  }

  function patchSel(m: Mappers, key?: string) {
    if (!selIds.length) return
    commit(mapItems(board, selIds, m), key ? `${key}:${selIds.join(',')}` : undefined)
  }

  function remove() {
    if (!selIds.length) return
    commit(deleteItems(board, selIds))
    setSel([])
    setMenu(null)
  }

  function duplicate() {
    if (!selIds.length) return
    const copy = cloneBundle(bundleOf(board, selIds), 2, 2)
    add(copy)
    setMenu(null)
  }

  function copy() {
    if (!selIds.length) return
    try {
      localStorage.setItem(CLIPBOARD, JSON.stringify(bundleOf(board, selIds)))
    } catch {
      // A blocked store just means nothing to paste later.
    }
    setPasteN(0)
    setMenu(null)
  }

  function cut() {
    copy()
    remove()
  }

  function hasClip() {
    try {
      return !!localStorage.getItem(CLIPBOARD)
    } catch {
      return false
    }
  }

  function paste() {
    let raw: unknown = null
    try {
      raw = JSON.parse(localStorage.getItem(CLIPBOARD) ?? 'null')
    } catch {
      raw = null
    }
    // A clipboard is somebody else's JSON by the time it is read back — it
    // goes through the same reader as any stored board.
    const read = readBoard(raw)
    setMenu(null)
    if (!read) return
    const b: Bundle = { tokens: read.tokens, paths: read.paths, texts: read.texts ?? [], shapes: read.shapes ?? [] }
    const n = pasteN + 1
    // Pasted over its own original, it steps down and across so both show.
    const onTop = bundleIds(b).some((id) => findItem(board, id))
    const off = onTop ? 2 * n : 0
    add(cloneBundle(b, off, off))
    setPasteN(n)
  }

  function selectAll() {
    setTool({ t: 'select' })
    setSel(allIds(board))
    setMenu(null)
  }

  // ── Tokens ────────────────────────────────────────────────────────────────

  /** The next free number for a numbered player of this kind. */
  function nextNumber(kind: TokenKind): string {
    const used = board.tokens.filter((t) => t.kind === kind).map((t) => parseInt(t.label, 10)).filter((n) => Number.isFinite(n))
    return String(used.length ? Math.max(...used) + 1 : 1)
  }

  function stampAt(at: Pt) {
    if (tool.t !== 'stamp') return
    const p = snap(at)
    const token: BoardToken = clean({
      id: newId('t'),
      kind: tool.kind,
      x: p.x,
      y: p.y,
      label: tool.numbered ? nextNumber(tool.kind) : tool.label,
      mark: tool.mark,
      playerId: tool.playerId,
      // A practice goal faces into the field from whichever end it is put down in.
      rot: tool.kind === 'goal' && p.x > FIELD.length / 2 ? 180 : undefined,
    })
    add({ ...emptyBundle(), tokens: [token] }, false)
    // A roster player can only be on the field once.
    if (tool.playerId) setTool({ t: 'select' })
  }

  /** Put the waiting set down, with the cage at the tap. */
  function dropPlacing(at: Pt) {
    if (tool.t !== 'place') return
    // Within a dozen yards of a cage, it is that cage — a coach aiming at the
    // goal should not have to hit it to the yard.
    const goal = goalNear(at.x)
    const near = Math.hypot(at.x - goal.x, at.y - goal.y) < 12 ? goal : at
    let made: BoardToken[] = []
    if (tool.from === 'formation') {
      const f = FORMATIONS.find((x) => x.key === tool.key)
      made = f ? placeSpots(f.spots, near, facingAt(near.x)) : []
    } else {
      const l = looks.find((x) => x.id === tool.key)
      made = l ? placeLook(l, near) : []
    }
    setToolState({ t: 'select' })
    if (made.length) add({ ...emptyBundle(), tokens: made })
  }

  /** Keep the discs picked as a look, on the shelf for every coach. */
  async function saveLook(name: string) {
    const tokens = board.tokens.filter((t) => selIds.includes(t.id))
    if (!tokens.length) return
    setMenu(null)
    try {
      const res = await fetch('/api/looks', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, tokens }),
      })
      const body = (await res.json()) as { looks?: SavedLook[] }
      if (res.ok && body.looks) setLooks(body.looks)
    } catch {
      // Saving the shelf failing must not take the board down with it.
    }
  }

  // ── Lines and shapes ──────────────────────────────────────────────────────

  function newPath(points: Pt[], curve: boolean): BoardPath {
    const pen = linePen
    return clean({
      id: newId('p'),
      kind: pen.kind,
      points,
      color: pen.color,
      width: pen.width,
      dash: pen.dash,
      startCap: pen.startCap,
      endCap: pen.endCap,
      pattern: pen.pattern,
      curve: curve && points.length > 2 ? true : undefined,
    })
  }

  function newShape(kind: BoardShape['kind'], box: Box, pts?: Pt[]): BoardShape {
    const pen = shapePen
    return clean({
      id: newId('s'),
      kind,
      x: Math.round(box.x * 10) / 10,
      y: Math.round(box.y * 10) / 10,
      w: Math.max(0.5, Math.round(box.w * 10) / 10),
      h: Math.max(0.5, Math.round(box.h * 10) / 10),
      pts,
      fill: pen.fill,
      fillOpacity: pen.fill ? pen.fillOpacity : undefined,
      stroke: pen.stroke,
      strokeWidth: pen.strokeWidth,
      dash: pen.dash || undefined,
    })
  }

  /** Finish a line or polygon put down a tap at a time. */
  function finishMulti(points = multi) {
    setMulti(null)
    setHover(null)
    if (!points) return
    // Two taps on one spot is the double-tap that finished it, not a point.
    const pts = points.filter((p, i) => i === 0 || dist(p, points[i - 1]) > 0.2)
    if (tool.t === 'shape' && tool.kind === 'polygon') {
      if (pts.length < 3) return
      const b = { ...boxOfPts(pts) }
      const w = Math.max(b.w, 0.5)
      const h = Math.max(b.h, 0.5)
      const shape = newShape('polygon', { x: b.x, y: b.y, w, h }, pts.map((p) => ({ x: round3((p.x - b.x) / w), y: round3((p.y - b.y) / h) })))
      add({ ...emptyBundle(), shapes: [shape] })
      setToolState({ t: 'select' })
      return
    }
    if (tool.t === 'line' && pts.length >= 2) add({ ...emptyBundle(), paths: [newPath(pts, tool.geo === 'curve')] })
  }

  /** Shift held: the line snaps to every fifteen degrees, as it does everywhere else. */
  function angleSnap(from: Pt, to: Pt, on: boolean): Pt {
    if (!on) return to
    const d = dist(from, to)
    const a = Math.round(Math.atan2(to.y - from.y, to.x - from.x) / (Math.PI / 12)) * (Math.PI / 12)
    return { x: Math.round((from.x + Math.cos(a) * d) * 10) / 10, y: Math.round((from.y + Math.sin(a) * d) * 10) / 10 }
  }

  // ── Words ─────────────────────────────────────────────────────────────────

  function editText(id: string, at?: Pt) {
    const t = findItem(board, id)
    const anchor = at ?? (t?.type === 'text' ? { x: t.it.x, y: t.it.y } : null)
    if (!anchor) return
    const p = toBox(anchor)
    setMenu(null)
    setSel([id])
    setEditing({ id, left: p.x, top: p.y, key: newId('edit') })
  }

  function addTextAt(at: Pt) {
    const pen = textPen
    const text: BoardText = clean({
      id: newId('x'),
      x: at.x,
      // The tap is where the middle of the word goes, not its baseline.
      y: Math.round((at.y + pen.size * 0.35) * 10) / 10,
      text: '',
      size: pen.size,
      color: pen.color,
      bold: pen.bold,
      italic: pen.italic,
      align: pen.align === 'middle' ? undefined : pen.align,
      bg: pen.bg,
    })
    const key = newId('edit')
    history.commit(addBundle(board, { ...emptyBundle(), texts: [text] }), key, Infinity)
    setToolState({ t: 'select' })
    setSel([text.id])
    const p = toBox({ x: text.x, y: text.y })
    setEditing({ id: text.id, left: p.x, top: p.y, key })
  }

  function typeText(value: string) {
    if (!editing) return
    commit(
      mapItems(board, [editing.id], { text: (t) => ({ ...t, text: value.slice(0, 1000) }) }),
      editing.key,
      Infinity,
    )
  }

  function doneEditing() {
    if (!editing) return
    const t = findItem(board, editing.id)
    // A word with nothing in it is no word: it goes, in the same step it came in.
    if (t?.type === 'text' && !t.it.text.trim()) {
      commit(deleteItems(board, [editing.id]), editing.key, Infinity)
      setSel([])
    }
    history.seal()
    setEditing(null)
  }

  // ── The view ──────────────────────────────────────────────────────────────

  function setView(next: { half?: BoardHalf; turn?: BoardTurn }) {
    const v = { half: next.half ?? half, turn: next.turn ?? savedTurn }
    setZoom(null)
    commit({
      ...board,
      view: v.half === 'off' && v.turn === 0 ? undefined : {
        ...(v.half !== 'off' ? { half: v.half } : {}),
        ...(v.turn ? { turn: v.turn } : {}),
      },
    })
  }

  function zoomBy(f: number, about?: Pt) {
    const cur = zoom ?? { s: 1, cx: view.x + view.w / 2, cy: view.y + view.h / 2 }
    const s = Math.max(1, Math.min(8, cur.s * f))
    if (s <= 1.01) {
      setZoom(null)
      return
    }
    // Keep the point under the cursor where it is.
    const c = about ?? { x: view.x + view.w / 2, y: view.y + view.h / 2 }
    const nw = vb.w / s
    const nh = vb.h / s
    const fx = (c.x - view.x) / view.w
    const fy = (c.y - view.y) / view.h
    setZoom({ s, cx: c.x - fx * nw + nw / 2, cy: c.y - fy * nh + nh / 2 })
  }

  function leaveFull() {
    setFull(false)
    setAutoTurn(false)
    onLeaveFull?.()
  }

  function toggleFullscreen() {
    const el = wrapRef.current
    if (!el) return
    setMenu(null)
    if (full) {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
      leaveFull()
      return
    }
    if (wantsAutoTurn(half, savedTurn)) setAutoTurn(true)
    /* The board fills the screen on its own (fixed, over everything), which is
       all an iPhone allows — it won't put anything but a video full screen. Where
       the browser will, the real thing is asked for too. */
    setFull(true)
    el.requestFullscreen?.().catch(() => {})
  }

  // Full screen holds the page still behind it, so a drag on the field never scrolls it.
  useEffect(() => {
    if (!full) return
    const page = document.body
    const was = page.style.overflow
    page.style.overflow = 'hidden'
    return () => {
      page.style.overflow = was
    }
  }, [full])

  // Leaving the browser's full screen by its own means (Escape, a swipe) ends ours.
  const leaveRef = useRef(leaveFull)
  useEffect(() => {
    leaveRef.current = leaveFull
  })
  useEffect(() => {
    if (!full) return
    let was = !!document.fullscreenElement
    const onFs = () => {
      const now = !!document.fullscreenElement
      if (was && !now) leaveRef.current()
      was = now
    }
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [full])

  /* A pinch on a trackpad arrives as a wheel with ctrl held; zoomed in, the
     wheel pans. Otherwise the wheel is the page's, and scrolls it. Listened for
     by hand because React's wheel listener cannot stop the page zooming. */
  const zoomRef = useRef({ zoomBy, view, zoom })
  useEffect(() => {
    zoomRef.current = { zoomBy, view, zoom }
  })
  useEffect(() => {
    const el = svgRef.current
    if (readOnly || !el) return
    const onWheel = (e: WheelEvent) => {
      const z = zoomRef.current
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        const m = el.getScreenCTM()
        const at = m ? new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse()) : undefined
        z.zoomBy(Math.exp(-e.deltaY / 200), at ? { x: at.x, y: at.y } : undefined)
        return
      }
      if (!z.zoom) return
      e.preventDefault()
      const perPx = z.view.w / el.clientWidth
      setZoom({ ...z.zoom, cx: z.view.x + z.view.w / 2 + e.deltaX * perPx, cy: z.view.y + z.view.h / 2 + e.deltaY * perPx })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [readOnly])

  /**
   * A picture of the field as it stands. The selection frame, the grid and any
   * half-drawn line are working marks, not part of the play, so they come off
   * first — and the zoom goes back out, so the picture is the whole view.
   */
  async function takeShot() {
    const svg = svgRef.current
    if (!svg || !onShot || shooting) return
    setSel([])
    setZoom(null)
    setMenu(null)
    setEditing(null)
    setShooting(true)
    try {
      // A frame or two for the working marks to come off the glass before the copy is taken.
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null))))
      const { boardToPng } = await import('@/lib/boardImage')
      await onShot(await boardToPng(svg))
    } finally {
      setShooting(false)
    }
  }

  /* Double-tap a read-only field and it opens full screen to look at. (The
     board being drawn on does the same with secondTap below, which also knows
     when the first tap was on something else.) */
  const doubleTap = useDoubleTap(() => setViewing(true))

  // ── Pointers ──────────────────────────────────────────────────────────────

  function cancelPress() {
    if (press.current) clearTimeout(press.current)
    press.current = null
  }

  function armPress(e: React.PointerEvent, fire: () => void) {
    cancelPress()
    if (e.pointerType === 'mouse') return
    press.current = setTimeout(() => {
      press.current = null
      fire()
    }, LONG_PRESS_MS)
  }

  function openMenuAt(x: number, y: number) {
    cancelPress()
    setGesture(null)
    setMarquee(null)
    setGuides([])
    setMenu({ x, y })
  }

  /**
   * Was this press the second of a double tap on the same thing? Asked here
   * rather than left to the browser's dblclick, which a captured pointer
   * delivers to the field instead of the thing — and which a finger never
   * sends at all.
   */
  function secondTap(key: string, e: React.PointerEvent): boolean {
    const prev = lastTap.current
    const hit = !!prev && prev.key === key && e.timeStamp - prev.t < 350 && Math.hypot(e.clientX - prev.x, e.clientY - prev.y) < 24
    lastTap.current = hit ? null : { key, t: e.timeStamp, x: e.clientX, y: e.clientY }
    return hit
  }

  function capture(e: React.PointerEvent) {
    try {
      // Capture keeps the drag following a finger that slides off the field.
      // A pointer the browser doesn't know about throws here, which must not
      // take the drag down with it.
      svgRef.current?.setPointerCapture(e.pointerId)
    } catch {
      // It works without capture; it just stops at the edge.
    }
  }

  /** Whatever a press does first: the board takes the keyboard, and closes what was open. */
  function begin(e: React.PointerEvent) {
    // Taking the focus also ends any typing on the field: the word's box loses
    // it, and that is its cue to finish. The press's own mousedown is stopped,
    // or the browser would hand the focus on after the box has just taken it.
    e.preventDefault()
    wrapRef.current?.focus({ preventScroll: true })
    capture(e)
    setMenu(null)
    // A press that starts afresh ends whatever the last one left behind — a
    // lift the board never heard about must not leave it stuck mid-drag.
    setMarquee(null)
    setDraft(null)
    setGuides([])
  }

  /** A press while something is under way: a second finger belongs to that; a fresh press replaces it. */
  const busyWith = (e: React.PointerEvent) => !!gesture && !e.isPrimary

  const handlers: ItemHandlers | undefined = readOnly
    ? undefined
    : {
        onDown: (e, item) => {
          // Only the Select arrow picks things up; with a drawing tool, the press
          // goes on to the field underneath and draws there.
          if (tool.t !== 'select' || e.button === 2 || busyWith(e)) return
          e.stopPropagation()
          begin(e)
          const id = item.it.id
          // The second tap of a double tap still starts a drag; it only counts
          // as a double tap if the finger comes up where it went down.
          const double = secondTap(`item:${id}`, e) ? item : null
          const mine = withGroups(board, [id])
          const additive = e.shiftKey || e.metaKey || e.ctrlKey
          let next = selIds.includes(id) ? selIds : mine
          let toggleOff: string[] | null = null
          if (additive) {
            if (selIds.includes(id)) toggleOff = mine
            else next = [...selIds, ...mine.filter((x) => !selIds.includes(x))]
          }
          setSel(next)
          const from = toField(e, false)
          const touch = e.pointerType !== 'mouse'
          setGesture({ g: 'move', id: e.pointerId, key: newId('mv'), sx: e.clientX, sy: e.clientY, from, ids: next, base: board, moved: false, toggleOff, touch, double })
          armPress(e, () => openMenuAt(e.clientX, e.clientY))
        },
        onMenu: (e, item) => {
          e.preventDefault()
          e.stopPropagation()
          if (tool.t !== 'select') setToolState({ t: 'select' })
          if (!selIds.includes(item.it.id)) setSel(withGroups(board, [item.it.id]))
          openMenuAt(e.clientX, e.clientY)
        },
        // Double taps are told apart in onDown; the browser's own is swallowed.
        onDouble: (e) => e.stopPropagation(),
      }

  function onHandleDown(e: React.PointerEvent, hit: HandleHit) {
    if (e.button === 2) return
    e.stopPropagation()
    begin(e)
    const double = hit.kind === 'vertex' && secondTap(`v:${hit.id}:${hit.index}`, e)
    let base = board
    let h = hit
    // Pulling a midpoint puts a new corner in the line there, then drags it.
    if (hit.kind === 'mid') {
      const p = findItem(board, hit.id)
      if (p?.type !== 'path') return
      const pts = [...p.it.points]
      pts.splice(hit.index + 1, 0, toField(e))
      base = mapItems(board, [hit.id], { path: (x) => ({ ...x, points: pts }) })
      h = { kind: 'vertex', id: hit.id, index: hit.index + 1 }
    }
    setGesture({ g: 'handle', id: e.pointerId, key: newId('hd'), hit: h, from: toField(e, false), base, moved: false, double })
  }

  /** Double-click a corner of a line to take it out. */
  function onHandleDouble(hit: HandleHit) {
    if (hit.kind !== 'vertex') return
    const p = findItem(board, hit.id)
    if (p?.type !== 'path' || p.it.points.length <= 2) return
    commit(mapItems(board, [hit.id], { path: (x) => ({ ...x, points: x.points.filter((_, i) => i !== hit.index) }) }))
  }

  /** Every finger that lands, before anything else sees it — the second one makes a pinch. */
  function onDownCapture(e: React.PointerEvent<SVGSVGElement>) {
    if (readOnly || e.pointerType !== 'touch') return
    // The first finger of a new touch: anything left over from before was lost off the glass.
    if (e.isPrimary) fingers.current.clear()
    fingers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (fingers.current.size !== 2) return
    e.stopPropagation()
    cancelPress()
    // Whatever the first finger had started is undone: it was half a pinch.
    if (gesture && gesture.g === 'move' && gesture.moved) {
      onChange?.(gesture.base)
      history.unrecord(gesture.key)
    }
    if (gesture && gesture.g === 'handle' && gesture.moved) {
      onChange?.(gesture.base)
      history.unrecord(gesture.key)
    }
    setDraft(null)
    setMarquee(null)
    setGuides([])
    const [a, b] = [...fingers.current.entries()]
    const mid = { x: (a[1].x + b[1].x) / 2, y: (a[1].y + b[1].y) / 2 }
    capture(e)
    setGesture({ g: 'pinch', a: a[0], b: b[0], d0: Math.max(10, dist(a[1], b[1])), s0: zoom?.s ?? 1, u0: toView(mid), last: mid })
  }

  /** A screen point in the svg's own units (not field yards: the turn is not undone). */
  function toView(c: Pt): Pt {
    const m = svgRef.current?.getScreenCTM()
    if (!m) return { x: 0, y: 0 }
    const p = new DOMPoint(c.x, c.y).matrixTransform(m.inverse())
    return { x: p.x, y: p.y }
  }

  function onPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    if (readOnly) {
      if (zoomable) doubleTap(e)
      return
    }
    if (e.button === 2 || busyWith(e)) return
    begin(e)
    const at = toField(e)
    const touch = e.pointerType !== 'mouse'

    if (tool.t === 'place') {
      dropPlacing(at)
      return
    }
    if (tool.t === 'select') {
      // Double-tap the grass: full screen to keep drawing — or back. Told on
      // the way up, so a quick tap and then a box drawn is still a box.
      const double = !e.shiftKey && secondTap('grass', e)
      setGesture({ g: 'marquee', id: e.pointerId, sx: e.clientX, sy: e.clientY, from: toField(e, false), additive: e.shiftKey || e.metaKey || e.ctrlKey, before: selIds, touch, double })
      armPress(e, () => {
        setSel([])
        openMenuAt(e.clientX, e.clientY)
      })
      return
    }
    if (tool.t === 'text') {
      addTextAt(snap(at))
      return
    }
    if (tool.t === 'stamp') {
      setGesture({ g: 'stamp', id: e.pointerId, at })
      setDraft({ token: { id: 'draft', kind: tool.kind, x: at.x, y: at.y, label: tool.numbered ? nextNumber(tool.kind) : tool.label, mark: tool.mark } })
      return
    }
    const p = snap(at)
    const tapping = (tool.t === 'line' && (tool.geo === 'poly' || tool.geo === 'curve')) || (tool.t === 'shape' && tool.kind === 'polygon')
    if (tapping && multi) {
      // A tap on the last point, or a double tap, finishes it; a tap on the
      // first point closes a polygon.
      const last = multi[multi.length - 1]
      if (secondTap('draft', e) || dist(p, last) < px(14) || (tool.t === 'shape' && multi.length >= 3 && dist(p, multi[0]) < px(14))) {
        finishMulti()
        return
      }
      setMulti([...multi, p])
      return
    }
    secondTap('draft', e)
    setGesture({ g: 'draw', id: e.pointerId, sx: e.clientX, sy: e.clientY, from: p, points: [p], moved: false, touch })
  }

  function onPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (readOnly) return
    if (e.pointerType === 'touch' && fingers.current.has(e.pointerId)) fingers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (press.current && gesture && 'sx' in gesture && Math.hypot(e.clientX - gesture.sx, e.clientY - gesture.sy) > SLOP.touch) cancelPress()

    if (!gesture) {
      // The line still to be put down follows the mouse.
      if (multi && e.pointerType === 'mouse') setHover(snap(toField(e)))
      return
    }
    const g = gesture

    if (g.g === 'pinch') {
      if (e.pointerId !== g.a && e.pointerId !== g.b) return
      const a = fingers.current.get(g.a)
      const b = fingers.current.get(g.b)
      const svg = svgRef.current
      if (!a || !b || !svg) return
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
      const s = Math.max(1, Math.min(8, (g.s0 * dist(a, b)) / g.d0))
      if (s <= 1.03) {
        // Not zooming in: two fingers moving together scroll the page, as they would anywhere.
        setZoom(null)
        const dy = mid.y - g.last.y
        scrollParent(svg)?.scrollBy(0, -dy)
      } else {
        // Keep the spot between the fingers under the fingers.
        const r = svg.getBoundingClientRect()
        const k1 = Math.min(r.width / vb.w, r.height / vb.h)
        const ox = (r.width - vb.w * k1) / 2
        const oy = (r.height - vb.h * k1) / 2
        const vx = g.u0.x - (mid.x - r.left - ox) / (k1 * s)
        const vy = g.u0.y - (mid.y - r.top - oy) / (k1 * s)
        setZoom({ s, cx: vx + vb.w / (2 * s), cy: vy + vb.h / (2 * s) })
      }
      setGesture({ ...g, last: mid })
      return
    }
    if ('id' in g && g.id !== e.pointerId) return

    if (g.g === 'move') {
      if (!g.moved && Math.hypot(e.clientX - g.sx, e.clientY - g.sy) < (g.touch ? SLOP.touch : SLOP.mouse)) return
      cancelPress()
      const movable = g.ids.filter((id) => !findItem(g.base, id)?.it.locked)
      if (!movable.length) return
      const p = toField(e, false)
      let dx = p.x - g.from.x
      let dy = p.y - g.from.y
      const box = selectionBox(g.base, movable, turn)
      if (box) {
        // Nothing is dragged off the grass.
        dx = Math.max(-PAD - box.x, Math.min(FIELD.length + PAD - box.x - box.w, dx))
        dy = Math.max(-PAD - box.y, Math.min(FIELD.width + PAD - box.y - box.h, dy))
        const moved = { ...box, x: box.x + dx, y: box.y + dy }
        let gs: Guide[] = []
        if (prefs.snapGrid) {
          // A single player snaps by its spot; anything bigger by its corner.
          const one = movable.length === 1 ? findItem(g.base, movable[0]) : null
          const ref = one?.type === 'token' ? { x: one.it.x + dx, y: one.it.y + dy } : { x: moved.x, y: moved.y }
          dx += Math.round(ref.x) - ref.x
          dy += Math.round(ref.y) - ref.y
        } else if (prefs.snapObjects && !e.altKey) {
          const others = stack(g.base).filter((x) => !movable.includes(x.it.id)).map((x) => itemBox(x, turn))
          const s = snapBox(moved, others, px(7))
          dx += s.dx
          dy += s.dy
          gs = s.guides
        }
        setGuides(gs)
      }
      if (!g.moved) setGesture({ ...g, moved: true })
      history.record(g.base, g.key)
      onChange?.(moveItems(g.base, movable, dx, dy))
      return
    }

    if (g.g === 'marquee') {
      if (Math.hypot(e.clientX - g.sx, e.clientY - g.sy) < (g.touch ? SLOP.touch : SLOP.mouse)) return
      cancelPress()
      const p = toField(e, false)
      setMarquee({ x: Math.min(g.from.x, p.x), y: Math.min(g.from.y, p.y), w: Math.abs(p.x - g.from.x), h: Math.abs(p.y - g.from.y) })
      return
    }

    if (g.g === 'handle') {
      const p = toField(e, false)
      const next = dragHandle(g, p, e.shiftKey)
      if (!next) return
      if (!g.moved) setGesture({ ...g, moved: true })
      history.record(g.base, g.key)
      onChange?.(next)
      return
    }

    if (g.g === 'stamp') {
      const at = toField(e)
      setGesture({ ...g, at })
      setDraft((d) => (d?.token ? { token: { ...d.token, ...snap(at) } } : d))
      return
    }

    if (g.g === 'draw') {
      if (!g.moved && Math.hypot(e.clientX - g.sx, e.clientY - g.sy) < (g.touch ? SLOP.touch : SLOP.mouse)) return
      const p = snap(toField(e))
      if (tool.t === 'line' && tool.geo === 'free') {
        // One point every half yard keeps the line smooth without a thousand of them.
        const last = g.points[g.points.length - 1]
        if (dist(p, last) < 0.4) return
        const points = [...g.points, p]
        setGesture({ ...g, points, moved: true })
        setDraft({ path: newPath(points, false) })
        return
      }
      if (tool.t === 'shape') {
        let w = p.x - g.from.x
        let h = p.y - g.from.y
        if (e.shiftKey) {
          const m = Math.max(Math.abs(w), Math.abs(h))
          w = Math.sign(w || 1) * m
          h = Math.sign(h || 1) * m
        }
        const box = { x: Math.min(g.from.x, g.from.x + w), y: Math.min(g.from.y, g.from.y + h), w: Math.abs(w), h: Math.abs(h) }
        setGesture({ ...g, points: [g.from, p], moved: true })
        setDraft({ shape: newShape(tool.kind, box) })
        return
      }
      const end = angleSnap(g.from, p, e.shiftKey)
      setGesture({ ...g, points: [g.from, end], moved: true })
      setDraft({ path: newPath([g.from, end], false) })
    }
  }

  /** Where a handle being dragged takes the board. */
  function dragHandle(g: Extract<Gesture, { g: 'handle' }>, p: Pt, shift: boolean): Board | null {
    const hit = g.hit
    const base = g.base
    if (hit.kind === 'vertex') {
      const q = snap(p)
      return mapItems(base, [hit.id], { path: (x) => ({ ...x, points: x.points.map((pt, i) => (i === hit.index ? q : pt)) }) })
    }
    if (hit.kind === 'scale') {
      const from = hit.box
      const c = hit.corner
      // The corner opposite the one in hand stays put.
      const ax = c.includes('w') ? from.x + from.w : from.x
      const ay = c.includes('n') ? from.y + from.h : from.y
      let w = Math.max(0.5, Math.abs(p.x - ax))
      let h = Math.max(0.5, Math.abs(p.y - ay))
      if (shift) {
        // Shift keeps its proportions.
        const f = Math.max(w / Math.max(from.w, 0.01), h / Math.max(from.h, 0.01))
        w = from.w * f
        h = from.h * f
      }
      const to = { x: c.includes('w') ? ax - w : ax, y: c.includes('n') ? ay - h : ay, w, h }
      return scaleItems(base, hit.ids, from, to)
    }
    const item = findItem(base, hit.id)
    if (!item || item.it.locked) return null
    if (hit.kind === 'rotate') {
      const f = frameOf(item, turn)
      const pivot = item.type === 'shape' ? { x: item.it.x + item.it.w / 2, y: item.it.y + item.it.h / 2 } : f.pivot
      let deg = (Math.atan2(p.y - pivot.y, p.x - pivot.x) * 180) / Math.PI + 90
      // Near a square angle it sits on it; Shift steps by fifteen.
      const step = shift ? 15 : 45
      const near = Math.round(deg / step) * step
      if (shift || Math.abs(deg - near) < 4) deg = near
      if (item.type === 'text') deg += turn
      const rot = Math.round(((deg % 360) + 360) % 360)
      const set = <T extends { rot?: number }>(x: T): T => clean({ ...x, rot: rot === 0 || rot === 360 ? undefined : rot })
      return mapItems(base, [hit.id], { shape: set, token: set, text: set })
    }
    if (hit.kind === 'resize') {
      if (item.type === 'shape') return mapItems(base, [hit.id], { shape: (s) => resizeShape(s, hit.handle, p, shift) })
      const f = frameOf(item, turn)
      const pivot = item.type === 'text' ? { x: f.box.x + (item.it.align === 'start' ? 0 : item.it.align === 'end' ? f.box.w : f.box.w / 2), y: f.box.y + f.box.h / 2 } : f.pivot
      const d0 = Math.max(0.3, dist(g.from, pivot))
      const ratio = dist(p, pivot) / d0
      if (item.type === 'token') {
        const s = Math.round(Math.max(0.3, Math.min(5, (item.it.size ?? 1) * ratio)) * 100) / 100
        return mapItems(base, [hit.id], { token: (t) => clean({ ...t, size: s === 1 ? undefined : s }) })
      }
      if (item.type === 'text') {
        const s = Math.round(Math.max(1, Math.min(12, item.it.size * ratio)) * 10) / 10
        return mapItems(base, [hit.id], { text: (t) => ({ ...t, size: s }) })
      }
    }
    return null
  }

  function onPointerUp(e: React.PointerEvent<SVGSVGElement>) {
    fingers.current.delete(e.pointerId)
    cancelPress()
    if (readOnly || !gesture) return
    const g = gesture
    if (g.g === 'pinch') {
      if (e.pointerId === g.a || e.pointerId === g.b) setGesture(null)
      return
    }
    if (g.id !== e.pointerId) return
    setGesture(null)
    setGuides([])
    const cancelled = e.type === 'pointercancel'

    if (g.g === 'move') {
      if (g.moved || cancelled) return
      if (g.double) {
        // Double tap: words open for typing; anything else, its menu.
        if (g.double.type === 'text' && !g.double.it.locked) editText(g.double.it.id)
        else openMenuAt(e.clientX, e.clientY)
        return
      }
      if (g.toggleOff) setSel(selIds.filter((id) => !g.toggleOff!.includes(id)))
      return
    }
    if (g.g === 'handle') {
      if (!g.moved && g.double && !cancelled) onHandleDouble(g.hit)
      return
    }
    if (g.g === 'marquee') {
      const m = marquee
      setMarquee(null)
      if (!m) {
        // A tap on the grass is "never mind"; two of them, full screen.
        if (!g.additive) setSel([])
        if (g.double && !cancelled) toggleFullscreen()
        return
      }
      const caught = stack(board)
        .filter((x) => {
          if (x.type === 'token') return inBox(m, x.it)
          if (x.type === 'text') return inBox(m, { x: x.it.x, y: x.it.y })
          return boxInside(itemBox(x, turn), m)
        })
        .map((x) => x.it.id)
      const got = withGroups(board, caught)
      setSel(g.additive ? [...new Set([...g.before, ...got])] : got)
      return
    }
    if (g.g === 'stamp') {
      setDraft(null)
      if (!cancelled) stampAt(g.at)
      return
    }
    if (g.g === 'draw') {
      setDraft(null)
      if (cancelled) return
      if (tool.t === 'line') {
        if (tool.geo === 'free') {
          if (g.points.length < 2) return
          // Smoothed: fewer points, and a curve through them rather than the wobble.
          const pts = simplify(g.points, 0.35)
          add({ ...emptyBundle(), paths: [newPath(pts, pts.length > 2)] })
          return
        }
        if (g.moved && g.points.length === 2 && dist(g.points[0], g.points[1]) >= 0.8) {
          const [a, b] = g.points
          // A curve drawn as one drag starts straight with a bend in the middle to pull.
          const pts = tool.geo === 'curve' ? [a, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, b] : [a, b]
          add({ ...emptyBundle(), paths: [newPath(pts, tool.geo === 'curve')] })
          return
        }
        if (tool.geo === 'poly' || tool.geo === 'curve') setMulti([g.from])
        return
      }
      if (tool.t === 'shape') {
        if (tool.kind === 'polygon') {
          setMulti([g.from])
          return
        }
        let box: Box
        if (g.moved && g.points.length === 2 && dist(g.points[0], g.points[1]) >= 1) {
          const [a, b] = g.points
          box = { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y) }
          if (e.shiftKey) box.w = box.h = Math.max(box.w, box.h)
        } else {
          // A tap puts down a shape of a sensible size, centred on the tap.
          const w = tool.kind === 'ellipse' ? 8 : 10
          const h = tool.kind === 'ellipse' ? 8 : 7
          box = { x: g.from.x - w / 2, y: g.from.y - h / 2, w, h }
        }
        add({ ...emptyBundle(), shapes: [newShape(tool.kind, box)] })
        setToolState({ t: 'select' })
      }
    }
  }

  function onContextMenu(e: React.MouseEvent) {
    if (readOnly) return
    e.preventDefault()
    // A finger held still mid-drag is not asking for a menu.
    if (gesture) return
    if (tool.t !== 'select') {
      // A right-click while drawing is "stop drawing".
      if (multi) finishMulti()
      setTool({ t: 'select' })
      return
    }
    setSel([])
    openMenuAt(e.clientX, e.clientY)
  }

  // ── Keys ──────────────────────────────────────────────────────────────────

  function onKeyDown(e: KeyboardEvent) {
    if (readOnly || e.defaultPrevented) return
    const el = e.target as HTMLElement | null
    // Typing in a box is typing, not a shortcut.
    if (el?.closest?.('input, textarea, select, [contenteditable="true"]')) return
    const mod = e.metaKey || e.ctrlKey
    const key = e.key.toLowerCase()
    const done = () => {
      e.preventDefault()
      e.stopPropagation()
    }
    if (mod && key === 'z') return done(), e.shiftKey ? history.redo() : history.undo()
    if (mod && key === 'y') return done(), history.redo()
    if (mod && key === 'a') return done(), selectAll()
    if (mod && key === 'c') return done(), copy()
    if (mod && key === 'x') return done(), cut()
    if (mod && key === 'v') return done(), paste()
    if (mod && key === 'd') return done(), duplicate()
    if (mod && key === 'g') return done(), e.shiftKey ? ungroup() : group()
    if (mod && (e.key === ']' || e.key === '}')) return done(), arrange(e.shiftKey ? 'front' : 'forward')
    if (mod && (e.key === '[' || e.key === '{')) return done(), arrange(e.shiftKey ? 'back' : 'backward')
    if (e.key === 'Escape') {
      done()
      if (multi) return finishMulti()
      if (tool.t !== 'select') return setTool({ t: 'select' })
      return setSel([])
    }
    if (e.key === 'Enter') {
      if (multi) return done(), finishMulti()
      const only = selItems.length === 1 ? selItems[0] : null
      if (only?.type === 'text') return done(), editText(only.it.id)
      return
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      done()
      if (multi) return setMulti(multi.length > 1 ? multi.slice(0, -1) : null)
      return remove()
    }
    if (e.key.startsWith('Arrow') && selIds.length) {
      done()
      const step = e.shiftKey ? 5 : 0.5
      const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0
      const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0
      // Arrow keys move along the glass, whichever way the field is turned.
      const d = rotatePt({ x: dx, y: dy }, { x: 0, y: 0 }, -turn)
      commit(moveItems(board, selIds, Math.round(d.x * 10) / 10, Math.round(d.y * 10) / 10), `nudge:${selIds.join(',')}`)
      return
    }
    if (mod || e.altKey) return
    const tools: Record<string, Tool> = {
      v: { t: 'select' },
      l: { t: 'line', geo: 'straight' },
      p: { t: 'line', geo: 'poly' },
      c: { t: 'line', geo: 'curve' },
      s: { t: 'line', geo: 'free' },
      r: { t: 'shape', kind: 'rect' },
      o: { t: 'shape', kind: 'ellipse' },
      t: { t: 'text' },
      k: { t: 'stamp', kind: 'cone', label: '', title: 'cones' },
    }
    if (tools[key]) {
      done()
      if (key === 'l') setLinePenState((p) => ({ ...p, startCap: 'none', endCap: 'arrow' }))
      setTool(tools[key])
    }
  }

  /* The keys belong to the board last touched — not to whatever has the focus,
     which after a menu closes is often nothing at all. A page with four boards
     on it sends Ctrl+Z to the one being worked on. */
  const [active, setActive] = useState(false)
  const keyRef = useRef(onKeyDown)
  useEffect(() => {
    keyRef.current = onKeyDown
  })
  useEffect(() => {
    if (readOnly || !active) return
    const away = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setActive(false)
    }
    const key = (e: KeyboardEvent) => keyRef.current(e)
    document.addEventListener('pointerdown', away, true)
    window.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('pointerdown', away, true)
      window.removeEventListener('keydown', key)
    }
  }, [active, readOnly])

  // ── Arranging ─────────────────────────────────────────────────────────────

  function arrange(how: Parameters<typeof reorder>[2]) {
    if (!selIds.length) return
    commit(reorder(board, selIds, how))
  }
  function group() {
    if (selIds.length < 2) return
    commit(patchAll(board, selIds, { group: newId('g') }))
    setMenu(null)
  }
  function ungroup() {
    if (!selItems.some((x) => x.it.group)) return
    commit(patchAll(board, selIds, { group: undefined }))
    setMenu(null)
  }

  const ed: Editor = {
    board,
    turn,
    sel: selIds,
    items: selItems,
    tool,
    setTool,
    linePen,
    setLinePen: (p) => setLinePenState((x) => ({ ...x, ...p })),
    shapePen,
    setShapePen: (p) => setShapePenState((x) => ({ ...x, ...p })),
    textPen,
    setTextPen: (p) => setTextPenState((x) => ({ ...x, ...p })),
    prefs,
    setPrefs: (p) => setPrefsState((x) => ({ ...x, ...p })),
    patch: patchSel,
    undo: history.undo,
    redo: history.redo,
    canUndo: history.canUndo,
    canRedo: history.canRedo,
    remove,
    duplicate,
    copy,
    cut,
    paste,
    hasClip,
    selectAll,
    arrange,
    align: (how) => commit(alignItems(board, selIds, how, turn)),
    distribute: (axis) => commit(distributeItems(board, selIds, axis, turn)),
    group,
    ungroup,
    lock: (on) => {
      commit(patchAll(board, selIds, { locked: on ? true : undefined }))
      setMenu(null)
    },
    editText: (id) => editText(id),
    clear: () => {
      const { shapes: _shapes, ...rest } = board
      commit({ ...rest, tokens: [], paths: [], texts: [] })
      setSel([])
    },
    half,
    setHalf: (h) => setView({ half: h }),
    turnView: () => {
      // Turned by hand, it is saved the way the coach left it.
      setAutoTurn(false)
      setView({ turn: ((turn + 90) % 360) as BoardTurn })
    },
    zoomBy: (f) => zoomBy(f),
    zoomReset: () => setZoom(null),
    zoomed: !!zoom,
    full,
    toggleFull: toggleFullscreen,
    shot: onShot ? takeShot : undefined,
    shooting,
    looks,
    saveLook,
    players,
    nextKind,
    setNextKind,
    drafting: multi?.length ?? 0,
    finishDraft: () => finishMulti(),
    cancelDraft: () => {
      setMulti(null)
      setHover(null)
    },
  }

  const editingText = editing ? findItem(board, editing.id) : undefined
  const drawingCursor = tool.t === 'select' ? 'default' : tool.t === 'place' || tool.t === 'stamp' ? 'copy' : tool.t === 'text' ? 'text' : 'crosshair'

  // What is being put down a tap at a time, with the mouse's next point on the end.
  const multiPts = multi ? (hover ? [...multi, hover] : multi) : null

  return (
    <div
      ref={wrapRef}
      tabIndex={readOnly ? undefined : -1}
      onPointerDownCapture={readOnly || active ? undefined : () => setActive(true)}
      onFocusCapture={readOnly || active ? undefined : () => setActive(true)}
      className={`outline-none ${
        full
          ? 'fixed inset-0 z-[90] px-3 pb-3 bg-white flex flex-col overflow-hidden'
          : readOnly && zoomable && !fit && !fill
            ? 'relative group/board'
            : fit || fill
              ? 'relative h-full'
              : 'relative'
      }`}
    >
      {/* Full screen keeps the field as big as it can be: one bar across the
          top with Done at the end of it. */}
      {full && !readOnly && (
        <div className="flex items-center gap-2 py-2 shrink-0" style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top))' }}>
          <span className="text-xs font-black uppercase tracking-wider text-gray-400 truncate flex-1">
            {title || 'Editing the field'}
          </span>
          <button type="button" onClick={toggleFullscreen} className="btn btn-primary !py-1.5 !px-4 text-sm shrink-0">
            Done
          </button>
        </div>
      )}

      {!readOnly && (
        <>
          <Toolbar ed={ed} extraTools={extraTools} />
          <PropsBar ed={ed} />
        </>
      )}

      <div ref={boxRef} className={`relative ${full ? 'flex-1 min-h-0 flex' : fit || fill ? 'h-full' : ''}`}>
        <svg
          ref={svgRef}
          viewBox={viewBox}
          className={`w-full select-none ${fill ? '' : 'rounded-xl'} ${readOnly ? 'touch-manipulation' : 'touch-none'} ${full ? 'flex-1 min-h-0 h-full' : ''} ${fit || fill ? 'h-full' : ''}`}
          style={{
            cursor: drawingCursor,
            /* A half field, or a turned one, is nearly square — left to fill the
               width it would be taller than the screen and the coach would be
               scrolling to see his own play. */
            maxHeight: full || fit || fill ? undefined : '72vh',
            // A page that is the field is grass to its edges, however the field sits in it.
            background: fill ? GRASS : undefined,
            WebkitTouchCallout: 'none',
          }}
          onPointerDownCapture={onDownCapture}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onPointerLeave={() => setHover(null)}
          onContextMenu={onContextMenu}
        >
          {/* The grass is drawn rather than set as a background colour, so a board
              that has to letterbox — a half field on a wide laptop — shows a field
              with the page either side of it, not a slab of green. It also means a
              screenshot has grass in it without anything being added. */}
          <rect x={vb.x} y={vb.y} width={vb.w} height={vb.h} fill={GRASS} rx={fill ? 0 : 1.5} />
          {/* Only what is in the window is drawn. A half field on a screen wider
              than it letterboxes, and without this the other half of the field
              would show in the margin beside it. */}
          <clipPath id={clipId}>
            <rect x={vb.x} y={vb.y} width={vb.w} height={vb.h} />
          </clipPath>

          <g clipPath={`url(#${clipId})`}>
            <g transform={spin}>
              <g ref={fieldRef} transform={`translate(${PAD} ${PAD})`}>
                <FieldLines />
                {prefs.grid && !shooting && <Grid />}

                <BoardItems board={board} turn={turn} handlers={handlers} hitWidth={px(26)} editingText={editing?.id} />

                {/* What is being drawn, as it is drawn. */}
                {draft?.path && <PathView path={draft.path} faint />}
                {draft?.shape && <ShapeView shape={draft.shape} />}
                {draft?.token && (
                  <g opacity={0.65}>
                    <TokenView token={draft.token} turn={turn} />
                  </g>
                )}
                {multiPts && multiPts.length >= 1 && tool.t !== 'select' && (
                  <g pointerEvents="none">
                    {tool.t === 'shape' ? (
                      <polygon
                        points={multiPts.map((p) => `${p.x},${p.y}`).join(' ')}
                        fill={shapePen.fill ?? 'none'}
                        fillOpacity={shapePen.fillOpacity}
                        stroke={shapePen.stroke}
                        strokeWidth={shapePen.strokeWidth || 0.3}
                        strokeDasharray="1 0.8"
                      />
                    ) : (
                      multiPts.length >= 2 && <PathView path={newPath(multiPts, tool.t === 'line' && tool.geo === 'curve')} faint />
                    )}
                    {multi!.map((p, i) => (
                      <circle key={i} cx={p.x} cy={p.y} r={px(i === 0 ? 6 : 4)} fill="#ffffff" stroke="#00693E" strokeWidth={px(2)} />
                    ))}
                  </g>
                )}

                {!readOnly && !shooting && (
                  <SelectionOverlay
                    items={tool.t === 'select' || selItems.length ? selItems : []}
                    turn={turn}
                    px={px}
                    marquee={marquee}
                    guides={guides}
                    busy={!!gesture && gesture.g !== 'handle'}
                    onHandleDown={onHandleDown}
                  />
                )}
              </g>
            </g>
          </g>

          <CapMarkers colors={[...new Set([...capColors(board.paths), ...(readOnly ? [] : [linePen.color])])]} />
        </svg>

        {!readOnly && editing && editingText?.type === 'text' && (
          <TextEditor
            text={editingText.it}
            anchor={{ x: editing.left, y: editing.top }}
            k={k}
            onText={typeText}
            onDone={doneEditing}
          />
        )}

        {!readOnly && zoom && (
          <button
            type="button"
            onClick={() => setZoom(null)}
            className="absolute top-2 left-2 h-9 px-3 rounded-full bg-black/55 text-white text-xs font-bold shadow"
            title="Back to the whole view"
          >
            {Math.round(zoom.s * 100)}% · Fit
          </button>
        )}

        {/* The way in for a mouse, and a hint for a thumb that double-tapping works. */}
        {readOnly && zoomable && !fit && (
          <button
            type="button"
            onClick={() => setViewing(true)}
            aria-label="See this board full screen"
            title="Full screen (or double-tap the field)"
            className="absolute top-1.5 right-1.5 w-7 h-7 inline-flex items-center justify-center rounded-md bg-black/35 text-white text-sm opacity-70 hover:opacity-100 group-hover/board:opacity-100"
          >
            ⤢
          </button>
        )}
      </div>
      {viewing && <BoardViewer board={board} title={title} onClose={() => setViewing(false)} />}

      {!readOnly && menu && <ContextMenu ed={ed} at={menu} onClose={() => setMenu(null)} />}

      {!readOnly && !full && (
        <p className="text-[0.7rem] text-gray-400 mt-1.5">
          Pick a tool and draw · the arrow picks things up to move, stretch and turn · right-click, or press and hold on a
          phone, for everything else · double-tap the grass for full screen · pinch to zoom
        </p>
      )}
    </div>
  )
}

const round3 = (n: number) => Math.round(n * 1000) / 1000

function boxOfPts(pts: Pt[]): Box {
  const xs = pts.map((p) => p.x)
  const ys = pts.map((p) => p.y)
  return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) }
}

const inBox = (b: Box, p: Pt) => p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h

function scrollParent(el: Element): Element | null {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const s = getComputedStyle(p)
    if (/(auto|scroll)/.test(s.overflowY) && p.scrollHeight > p.clientHeight) return p
  }
  return document.scrollingElement
}

/** Five-yard squares, faint, for lining things up by eye. */
function Grid() {
  const xs = Array.from({ length: Math.floor(FIELD.length / 5) + 1 }, (_, i) => i * 5)
  const ys = Array.from({ length: Math.floor(FIELD.width / 5) + 1 }, (_, i) => i * 5)
  return (
    <g pointerEvents="none" stroke="#ffffff" strokeOpacity={0.22} strokeWidth={0.12}>
      {xs.map((x) => <line key={`x${x}`} x1={x} y1={0} x2={x} y2={FIELD.width} />)}
      {ys.map((y) => <line key={`y${y}`} x1={0} y1={y} x2={FIELD.length} y2={y} />)}
    </g>
  )
}
