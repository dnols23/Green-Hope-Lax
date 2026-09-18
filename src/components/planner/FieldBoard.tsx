'use client'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  FIELD,
  POSITION_TOKENS,
  TOKEN_KINDS,
  PATH_KINDS,
  tokenStyle,
  pathStyle,
  pathLook,
  fontStack,
  newId,
  type Board,
  type BoardToken,
  type PathKind,
  type TokenKind,
} from '@/lib/planner'
import {
  FORMATIONS,
  facingAt,
  goalNear,
  placeLook,
  placeSpots,
  type SavedLook,
} from '@/lib/formations'
import { BoardMenu, type Selection } from './BoardMenu'

/** A player who can be dropped onto the field. */
export interface BoardPlayer {
  id: string
  name: string
  number: string | null
}

const PAD = 4 // yards of grass drawn outside the lines

/** The id of one end shape, in one colour. Hex is not valid in an id, so drop the hash. */
const capId = (shape: string, end: 'start' | 'end', color: string) =>
  `cap-${shape}-${end}-${color.replace('#', '').toLowerCase()}`

/**
 * A lacrosse field you can move players around on.
 *
 * Everything is stored in yards, so a board drawn on a phone opens identically
 * on the projector — the SVG scales, the positions don't. Drag a disc to move
 * it; switch to a line tool and drag to draw a run, a pass, a shot or a pick.
 */
export function FieldBoard({
  board,
  onChange,
  players = [],
  readOnly = false,
  onShot,
  extraTools,
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
}) {
  /* Every colour in use on the board, so each one gets its own set of end
     shapes below. */
  const capColors = Array.from(new Set(board.paths.map((p) => pathLook(p).color)))
  const [shooting, setShooting] = useState(false)
  const [half, setHalf] = useState<'off' | 'right' | 'left'>('off')
  const [turn, setTurn] = useState(0)
  const svgRef = useRef<SVGSVGElement>(null)
  /* The group everything is drawn in, in field yards. Every screen point is
     turned into yards through this one element's matrix. */
  const fieldRef = useRef<SVGGElement>(null)

  /* A set waiting to be put down. Tap a formation, then tap the field: the tap
     is where the cage is, and near a cage it snaps to it exactly. */
  const [placing, setPlacing] = useState<{ kind: 'formation' | 'look'; key: string } | null>(null)
  /* The staff's own saved groups. Fetched by the board rather than handed down,
     so a note with four fields in it does not load the shelf four times. */
  const [looks, setLooks] = useState<SavedLook[]>([])
  /* Boxing a group: the rubber band while it is being drawn, then what it
     caught. */
  const [marquee, setMarquee] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null)
  const [picked, setPicked] = useState<string[]>([])
  const groupFrom = useRef<{ x: number; y: number } | null>(null)
  /** The board before a group drag started — the one undo should come back to. */
  const groupBefore = useRef<Board | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [full, setFull] = useState(false)
  const [tool, setTool] = useState<'move' | 'select' | PathKind>('move')
  const [dragId, setDragId] = useState<string | null>(null)
  const [draft, setDraft] = useState<{ x: number; y: number }[] | null>(null)
  const [nextKind, setNextKind] = useState<TokenKind>('offense')
  /* Undo and redo, kept here rather than in the page: a coach rubbing out the
     last line is undoing a stroke, not a save, and the two should not be the
     same button. Every change goes through emit(), so this is the whole
     history of the board. */
  const [past, setPast] = useState<Board[]>([])
  const [future, setFuture] = useState<Board[]>([])
  /* What is selected — a tap picks something and rings it in white, so you can
     see what you are about to work on. */
  const [selected, setSelected] = useState<Selection>(null)
  /* Where the format menu is open, in viewport pixels. Right-click on a laptop
     or a long press on a phone opens it, over the field, where the finger
     already is — the way a format menu works everywhere else. */
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)

  /* A long press is a right-click for a finger. One timer for the whole board:
     whatever was pressed is captured when it starts, and a finger that slides
     more than a few pixels was dragging, not pressing. */
  const press = useRef<{ timer: ReturnType<typeof setTimeout>; x: number; y: number } | null>(null)

  function cancelPress() {
    if (press.current) clearTimeout(press.current.timer)
    press.current = null
  }

  function openMenu(sel: Selection, at: { x: number; y: number }) {
    cancelPress()
    setSelected(sel)
    setMenu(at)
  }

  function armPress(sel: Selection, e: React.PointerEvent) {
    if (readOnly) return
    cancelPress()
    const x = e.clientX
    const y = e.clientY
    press.current = { timer: setTimeout(() => openMenu(sel, { x, y }), 450), x, y }
  }

  function pressMoved(e: React.PointerEvent) {
    const p = press.current
    if (!p) return
    if (Math.abs(e.clientX - p.x) > 10 || Math.abs(e.clientY - p.y) > 10) cancelPress()
  }

  /** Right-click, on anything. */
  function onMenu(sel: Selection, e: React.MouseEvent) {
    if (readOnly) return
    e.preventDefault()
    e.stopPropagation()
    openMenu(sel, { x: e.clientX, y: e.clientY })
  }

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

  /* Which part of the field is on the glass, and which way up.
     A play is drawn in one end, and a 110-yard field shrunk to fit a phone is a
     ribbon — so the half field is the useful view, and the turn is for a phone
     held upright, where the cage wants to be at the top. */
  const win =
    half === 'off'
      ? { x: 0, y: 0, w: FIELD.length + PAD * 2, h: FIELD.width + PAD * 2 }
      : half === 'right'
        ? { x: FIELD.length / 2 + PAD, y: 0, w: FIELD.length / 2 + PAD, h: FIELD.width + PAD * 2 }
        : { x: 0, y: 0, w: FIELD.length / 2 + PAD, h: FIELD.width + PAD * 2 }

  const turned = turn === 90 || turn === 270
  const viewBox = turned
    ? `0 0 ${win.h} ${win.w}`
    : `${win.x} ${win.y} ${win.w} ${win.h}`
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

  /**
   * Screen point → field yards.
   *
   * Asked of the browser rather than worked out from the bounding box: with the
   * board turned, or letterboxed inside a full-screen panel, the arithmetic
   * version puts a disc somewhere the finger was not.
   */
  function toField(e: { clientX: number; clientY: number }) {
    const g = fieldRef.current
    const m = g?.getScreenCTM()
    if (!g || !m) return { x: 0, y: 0 }
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse())
    return {
      x: Math.max(0, Math.min(FIELD.length, Math.round(p.x * 10) / 10)),
      y: Math.max(0, Math.min(FIELD.width, Math.round(p.y * 10) / 10)),
    }
  }

  const emit = (next: Board) => {
    setPast((p) => [...p.slice(-49), board])
    setFuture([])
    onChange?.(next)
  }

  function undo() {
    setPast((p) => {
      if (p.length === 0) return p
      const previous = p[p.length - 1]
      setFuture((f) => [board, ...f].slice(0, 50))
      onChange?.(previous)
      return p.slice(0, -1)
    })
  }

  function redo() {
    setFuture((f) => {
      if (f.length === 0) return f
      const next = f[0]
      setPast((p) => [...p, board])
      onChange?.(next)
      return f.slice(1)
    })
  }

  function addToken(kind: TokenKind, label: string, playerId?: string) {
    // New discs land in the middle, out of the way of the goals.
    const spread = board.tokens.length * 1.5
    emit({
      ...board,
      tokens: [
        ...board.tokens,
        {
          id: newId('t'),
          kind,
          x: FIELD.length / 2 - 6 + (spread % 12),
          y: 8 + ((board.tokens.length * 5) % (FIELD.width - 16)),
          label,
          playerId,
        },
      ],
    })
  }

  function addText() {
    const id = newId('x')
    emit({
      ...board,
      texts: [
        ...(board.texts ?? []),
        { id, x: FIELD.length / 2, y: FIELD.width / 2 - 6, text: 'Call it', size: 4, color: '#17222e' },
      ],
    })
    setSelected({ type: 'text', id })
  }

  /** Put the waiting set down, with the cage at the tap. */
  function dropPlacing(at: { x: number; y: number }) {
    if (!placing) return
    // Within a dozen yards of a cage, it is that cage — a coach aiming at the
    // goal should not have to hit it to the yard.
    const goal = goalNear(at.x)
    const near = Math.hypot(at.x - goal.x, at.y - goal.y) < 12 ? goal : at

    const made =
      placing.kind === 'formation'
        ? (() => {
            const f = FORMATIONS.find((x) => x.key === placing.key)
            return f ? placeSpots(f.spots, near, facingAt(near.x)) : []
          })()
        : (() => {
            const l = looks.find((x) => x.id === placing.key)
            return l ? placeLook(l, near) : []
          })()

    setPlacing(null)
    if (made.length) emit({ ...board, tokens: [...board.tokens, ...made] })
  }

  // ── Boxing a group ────────────────────────────────────────────────────────

  const inBox = (
    box: { x0: number; y0: number; x1: number; y1: number },
    p: { x: number; y: number }
  ) =>
    p.x >= Math.min(box.x0, box.x1) &&
    p.x <= Math.max(box.x0, box.x1) &&
    p.y >= Math.min(box.y0, box.y1) &&
    p.y <= Math.max(box.y0, box.y1)

  /** What the box caught. A line counts only if the whole of it is inside. */
  function caughtBy(box: { x0: number; y0: number; x1: number; y1: number }): string[] {
    return [
      ...board.tokens.filter((t) => inBox(box, t)).map((t) => t.id),
      ...(board.texts ?? []).filter((t) => inBox(box, t)).map((t) => t.id),
      ...board.paths.filter((p) => p.points.every((pt) => inBox(box, pt))).map((p) => p.id),
    ]
  }

  /** The rectangle round everything picked, with a little air. */
  function pickedBox() {
    const xs: number[] = []
    const ys: number[] = []
    for (const t of board.tokens) if (picked.includes(t.id)) { xs.push(t.x); ys.push(t.y) }
    for (const t of board.texts ?? []) if (picked.includes(t.id)) { xs.push(t.x); ys.push(t.y) }
    for (const p of board.paths) {
      if (!picked.includes(p.id)) continue
      for (const pt of p.points) { xs.push(pt.x); ys.push(pt.y) }
    }
    if (!xs.length) return null
    const pad = 2.5
    return {
      x: Math.min(...xs) - pad,
      y: Math.min(...ys) - pad,
      w: Math.max(...xs) - Math.min(...xs) + pad * 2,
      h: Math.max(...ys) - Math.min(...ys) + pad * 2,
    }
  }

  /** Shift everything picked by the same amount. */
  function nudgeGroup(dx: number, dy: number) {
    onChange?.({
      ...board,
      tokens: board.tokens.map((t) => (picked.includes(t.id) ? { ...t, x: t.x + dx, y: t.y + dy } : t)),
      texts: (board.texts ?? []).map((t) =>
        picked.includes(t.id) ? { ...t, x: t.x + dx, y: t.y + dy } : t
      ),
      paths: board.paths.map((p) =>
        picked.includes(p.id)
          ? { ...p, points: p.points.map((pt) => ({ x: pt.x + dx, y: pt.y + dy })) }
          : p
      ),
    })
  }

  function deleteGroup() {
    emit({
      ...board,
      tokens: board.tokens.filter((t) => !picked.includes(t.id)),
      texts: (board.texts ?? []).filter((t) => !picked.includes(t.id)),
      paths: board.paths.filter((p) => !picked.includes(p.id)),
    })
    setPicked([])
    setMenu(null)
  }

  function colorGroup(c: string) {
    emit({
      ...board,
      tokens: board.tokens.map((t) => (picked.includes(t.id) ? { ...t, color: c } : t)),
      texts: (board.texts ?? []).map((t) => (picked.includes(t.id) ? { ...t, color: c } : t)),
      paths: board.paths.map((p) => (picked.includes(p.id) ? { ...p, color: c } : p)),
    })
  }

  /** Keep the discs in the box as a look, on the shelf for every coach. */
  async function saveLook(name: string) {
    const tokens = board.tokens.filter((t) => picked.includes(t.id))
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

  /**
   * A picture of the field as it stands. The selection halo and the draft line
   * are working marks, not part of the play, so they come off first — otherwise
   * whatever happened to be tapped shows up in the Library with a white outline
   * round it.
   */
  async function takeShot() {
    const svg = svgRef.current
    if (!svg || !onShot || shooting) return
    setSelected(null)
    setShooting(true)
    try {
      // One frame for the halo to come off the glass before the copy is taken.
      await new Promise((r) => requestAnimationFrame(() => r(null)))
      const { boardToPng } = await import('@/lib/boardImage')
      await onShot(await boardToPng(svg))
    } finally {
      setShooting(false)
    }
  }

  function onPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    if (readOnly) return

    // A set waiting to be put down goes down wherever you tap.
    if (placing) {
      dropPlacing(toField(e))
      return
    }

    if (tool === 'select') {
      const at = toField(e)
      setPicked([])
      setSelected(null)
      setMarquee({ x0: at.x, y0: at.y, x1: at.x, y1: at.y })
      return
    }

    if (tool === 'move') {
      // A tap on the grass is "never mind".
      if (e.target === svgRef.current) {
        setSelected(null)
        setPicked([])
      }
      return
    }
    try {
      // Capture keeps the line following a finger that slides off the svg. A
      // pointer the browser doesn't know about throws here, which must not
      // take the stroke down with it.
      ;(e.target as Element).setPointerCapture?.(e.pointerId)
    } catch {
      // Drawing works without capture; it just stops at the edge.
    }
    setDraft([toField(e)])
  }

  function onPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (readOnly) return
    pressMoved(e)

    if (marquee) {
      const at = toField(e)
      setMarquee({ ...marquee, x1: at.x, y1: at.y })
      return
    }
    if (groupFrom.current) {
      const at = toField(e)
      nudgeGroup(at.x - groupFrom.current.x, at.y - groupFrom.current.y)
      groupFrom.current = at
      return
    }
    if (dragId) {
      const { x, y } = toField(e)
      // Discs and words both drag; whichever one this id belongs to moves.
      emit({
        ...board,
        tokens: board.tokens.map((t) => (t.id === dragId ? { ...t, x, y } : t)),
        texts: (board.texts ?? []).map((t) => (t.id === dragId ? { ...t, x, y } : t)),
      })
      return
    }
    if (draft) {
      const p = toField(e)
      // One point every half yard keeps the line smooth without a thousand of them.
      const last = draft[draft.length - 1]
      if (Math.hypot(p.x - last.x, p.y - last.y) > 0.5) setDraft([...draft, p])
    }
  }

  function onPointerUp() {
    cancelPress()
    if (marquee) {
      const caught = caughtBy(marquee)
      setMarquee(null)
      setPicked(caught)
      // Boxed, and now you want to move it — so hand the move tool back.
      if (caught.length) setTool('move')
      return
    }
    if (groupFrom.current) {
      groupFrom.current = null
      // One entry in the history for the whole drag, not one per pixel — and it
      // is where the group started, not where it ended up.
      const before = groupBefore.current
      groupBefore.current = null
      if (before) {
        setPast((p) => [...p.slice(-49), before])
        setFuture([])
      }
      return
    }
    if (dragId) { setDragId(null); return }
    if (draft && tool !== 'move' && tool !== 'select') {
      if (draft.length >= 2) {
        emit({ ...board, paths: [...board.paths, { id: newId('p'), kind: tool, points: draft }] })
      }
      setDraft(null)
    }
  }

  function removeToken(id: string) {
    emit({ ...board, tokens: board.tokens.filter((t) => t.id !== id) })
  }

  /* Full screen is how this gets used on a phone: turn it sideways and the field
     fills the glass. The board is an SVG in yards, so it simply scales. */
  async function toggleFullscreen() {
    const el = wrapRef.current
    if (!el) return
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen()
        setFull(false)
      } else {
        await el.requestFullscreen()
        setFull(true)
      }
    } catch {
      // Some browsers refuse without a gesture they recognise; the board still
      // works at its normal size.
    }
  }

  /** Press inside the box to take the whole group with you. */
  function startGroupDrag(e: React.PointerEvent) {
    if (tool !== 'move') return
    e.stopPropagation()
    groupFrom.current = toField(e)
    groupBefore.current = board
    armPress({ type: 'group', id: 'group' }, e)
  }

  const groupBox = picked.length > 0 ? pickedBox() : null

  const toolBtn = (active: boolean) =>
    `px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
      active ? 'text-white' : 'text-gray-600 bg-white hover:bg-gray-50'
    }`

  return (
    <div ref={wrapRef} className={full ? 'p-3 bg-white flex flex-col h-full' : ''}>
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-1.5 mb-2">
          <button
            type="button"
            onClick={() => setTool('move')}
            className={toolBtn(tool === 'move')}
            style={{
              background: tool === 'move' ? 'var(--gh-green)' : undefined,
              borderColor: tool === 'move' ? 'var(--gh-green)' : '#e5e7eb',
            }}
          >
            Move
          </button>
          <button
            type="button"
            onClick={() => {
              setTool('select')
              setPicked([])
            }}
            className={toolBtn(tool === 'select')}
            style={{
              background: tool === 'select' ? 'var(--gh-green)' : undefined,
              borderColor: tool === 'select' ? 'var(--gh-green)' : '#e5e7eb',
            }}
            title="Draw a box round a group to move it, delete it or keep it"
          >
            Select
          </button>
          {PATH_KINDS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setTool(p.key)}
              className={toolBtn(tool === p.key)}
              style={{
                background: tool === p.key ? p.color : undefined,
                borderColor: tool === p.key ? p.color : '#e5e7eb',
              }}
            >
              {p.label}
            </button>
          ))}

          <span className="w-px h-5 bg-gray-200 mx-1" />

          {/* Positions first — a coach puts an attackman on the field, not an
              "offense". The rest are the things that aren't people. */}
          {POSITION_TOKENS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => addToken(p.kind, p.label)}
              className="px-2 py-1.5 rounded-lg text-xs font-black border border-gray-200 bg-white hover:bg-gray-50"
              title={`Add ${p.title}`}
            >
              <span
                className="inline-block w-2.5 h-2.5 rounded-full mr-1.5 align-middle"
                style={{ background: tokenStyle(p.kind).fill, border: '1px solid rgba(0,0,0,.15)' }}
              />
              {p.label}
            </button>
          ))}

          <span className="w-px h-5 bg-gray-200 mx-1" />

          {TOKEN_KINDS.filter((k) => k.key === 'coach' || k.key === 'cone' || k.key === 'ball').map((k) => (
            <button
              key={k.key}
              type="button"
              onClick={() => addToken(k.key, '')}
              className="px-2.5 py-1.5 rounded-lg text-xs font-bold border border-gray-200 bg-white hover:bg-gray-50"
              title={`Add a ${k.label.toLowerCase()}`}
            >
              <span
                className="inline-block w-2.5 h-2.5 rounded-full mr-1.5 align-middle"
                style={{ background: k.fill, border: '1px solid rgba(0,0,0,.15)' }}
              />
              {k.label}
            </button>
          ))}

          <button
            type="button"
            onClick={addText}
            className="px-2.5 py-1.5 rounded-lg text-xs font-bold border border-gray-200 bg-white hover:bg-gray-50"
            title="Put a word on the field"
          >
            Text
          </button>

          {onShot && (
            <button
              type="button"
              onClick={takeShot}
              disabled={shooting}
              className="px-2.5 py-1.5 rounded-lg text-xs font-bold border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-50"
              title="Save a picture of the field to the Library"
            >
              {shooting ? 'Saving…' : 'Screenshot'}
            </button>
          )}

          {extraTools}

          <span className="w-px h-5 bg-gray-200 mx-1" />

          <button
            type="button"
            onClick={() => setHalf(half === 'off' ? 'right' : half === 'right' ? 'left' : 'off')}
            className={toolBtn(half !== 'off')}
            style={{
              background: half !== 'off' ? 'var(--gh-green)' : undefined,
              borderColor: half !== 'off' ? 'var(--gh-green)' : '#e5e7eb',
            }}
            title="Show one end, big — press again for the other end, and again for the whole field"
          >
            {half === 'off' ? 'Half field' : half === 'right' ? 'Right end' : 'Left end'}
          </button>
          <button
            type="button"
            onClick={() => setTurn((t) => (t + 90) % 360)}
            className={toolBtn(turn !== 0)}
            style={{
              background: turn !== 0 ? 'var(--gh-green)' : undefined,
              borderColor: turn !== 0 ? 'var(--gh-green)' : '#e5e7eb',
            }}
            title="Turn the board a quarter turn"
          >
            Rotate
          </button>

          <span className="w-px h-5 bg-gray-200 mx-1" />

          <button
            type="button"
            onClick={toggleFullscreen}
            className="px-2.5 py-1.5 rounded-lg text-xs font-bold border border-gray-200 bg-white hover:bg-gray-50"
            title="Fill the screen — turn a phone sideways"
          >
            {full ? '⤡ Exit full screen' : '⤢ Full screen'}
          </button>
          <button
            type="button"
            onClick={undo}
            disabled={past.length === 0}
            title="Undo"
            className="px-2.5 py-1.5 rounded-lg text-xs font-bold border border-gray-200 text-gray-600 bg-white hover:bg-gray-50 disabled:opacity-40"
          >
            ↶ Undo
          </button>
          <button
            type="button"
            onClick={redo}
            disabled={future.length === 0}
            title="Redo"
            className="px-2.5 py-1.5 rounded-lg text-xs font-bold border border-gray-200 text-gray-600 bg-white hover:bg-gray-50 disabled:opacity-40"
          >
            ↷ Redo
          </button>
          <button
            type="button"
            onClick={() => emit({ tokens: [], paths: [] })}
            className="px-2.5 py-1.5 rounded-lg text-xs font-bold border border-gray-200 text-gray-500 bg-white hover:bg-gray-50"
          >
            Clear
          </button>
        </div>
      )}

      {!readOnly && (
        <div className="flex flex-wrap items-center gap-1.5 mb-2">
          <span className="text-[0.65rem] font-black tracking-wider uppercase text-gray-400 mr-0.5">
            Sets
          </span>
          {FORMATIONS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() =>
                setPlacing(placing?.key === f.key ? null : { kind: 'formation', key: f.key })
              }
              title={f.blurb}
              className={toolBtn(placing?.key === f.key)}
              style={{
                background: placing?.key === f.key ? 'var(--gh-green)' : undefined,
                borderColor: placing?.key === f.key ? 'var(--gh-green)' : '#e5e7eb',
              }}
            >
              {f.name}
            </button>
          ))}

          {looks.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => setPlacing(placing?.key === l.id ? null : { kind: 'look', key: l.id })}
              title={`${l.spots.length} discs, saved by the staff`}
              className={toolBtn(placing?.key === l.id)}
              style={{
                background: placing?.key === l.id ? 'var(--gh-maroon)' : undefined,
                borderColor: placing?.key === l.id ? 'var(--gh-maroon)' : '#e5e7eb',
              }}
            >
              {l.name}
            </button>
          ))}

          {placing && (
            <span className="text-xs font-semibold" style={{ color: 'var(--gh-green)' }}>
              Tap the cage you&rsquo;re attacking — or anywhere you want it
            </span>
          )}
        </div>
      )}

      {!readOnly && players.length > 0 && (
        <div className="mb-2">
          <div className="text-[0.65rem] font-black tracking-wider uppercase text-gray-400 mb-1">
            In this block — tap to put on the field
          </div>
          <div className="flex flex-wrap gap-1">
            {players.map((p) => {
              const on = board.tokens.some((t) => t.playerId === p.id)
              return (
                <button
                  key={p.id}
                  type="button"
                  disabled={on}
                  onClick={() => addToken(nextKind, p.number || p.name.slice(0, 2).toUpperCase(), p.id)}
                  className="px-2 py-1 rounded text-xs font-semibold border disabled:opacity-40"
                  style={{ borderColor: '#e5e7eb', background: on ? '#f3f4f6' : '#fff' }}
                  title={on ? `${p.name} is already on the board` : `Add ${p.name}`}
                >
                  {p.number ? `#${p.number} ` : ''}{p.name}
                </button>
              )
            })}
          </div>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-[0.7rem] text-gray-500">Add roster players as</span>
            {(['offense', 'defense', 'goalie'] as TokenKind[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setNextKind(k)}
                className="text-[0.7rem] font-bold px-2 py-0.5 rounded-full border"
                style={{
                  borderColor: nextKind === k ? tokenStyle(k).fill : '#e5e7eb',
                  background: nextKind === k ? tokenStyle(k).fill : '#fff',
                  color: nextKind === k ? '#fff' : '#6b7280',
                }}
              >
                {tokenStyle(k).label}
              </button>
            ))}
          </div>
        </div>
      )}

      <svg
        ref={svgRef}
        viewBox={viewBox}
        className={`w-full rounded-xl select-none touch-none ${full ? 'flex-1 min-h-0' : ''}`}
        style={{
          cursor: placing ? 'copy' : tool === 'move' ? 'default' : 'crosshair',
          /* A half field, or a turned one, is nearly square — left to fill the
             width it would be taller than the screen and the coach would be
             scrolling to see his own play. */
          maxHeight: full ? undefined : '72vh',
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        {/* The grass is drawn rather than set as a background colour, so a board
            that has to letterbox — a half field on a wide laptop — shows a field
            with the page either side of it, not a slab of green. It also means a
            screenshot has grass in it without anything being added. */}
        <rect width="100%" height="100%" fill="#4a7f52" rx={1.5} />

        <g transform={spin}>
        <g ref={fieldRef} transform={`translate(${PAD} ${PAD})`}>
          <FieldLines />

          {board.paths.map((p) => {
            const look = pathLook(p)
            const picked = selected?.type === 'path' && selected.id === p.id
            const points = p.points.map((pt) => `${pt.x},${pt.y}`).join(' ')
            return (
              <g key={p.id}>
                {/* A line is a couple of pixels wide and a finger is not, so a
                    fat invisible twin underneath is what you actually tap. */}
                <polyline
                  points={points}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={Math.max(2.4, look.width * 3)}
                  strokeLinecap="round"
                  style={{ cursor: readOnly ? 'default' : 'pointer' }}
                  onPointerDown={(e) => {
                    if (readOnly || tool !== 'move') return
                    e.stopPropagation()
                    setSelected({ type: 'path', id: p.id })
                    armPress({ type: 'path', id: p.id }, e)
                  }}
                  onContextMenu={(e) => onMenu({ type: 'path', id: p.id }, e)}
                />
                {picked && (
                  <polyline
                    points={points}
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth={look.width + 0.6}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={0.9}
                  />
                )}
                <polyline
                  points={points}
                  fill="none"
                  stroke={look.color}
                  strokeWidth={look.width}
                  strokeDasharray={look.dash}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  markerStart={look.startCap === 'none' ? undefined : `url(#${capId(look.startCap, 'start', look.color)})`}
                  markerEnd={look.endCap === 'none' ? undefined : `url(#${capId(look.endCap, 'end', look.color)})`}
                  style={{ pointerEvents: 'none' }}
                />
              </g>
            )
          })}

          {(board.texts ?? []).map((t) => (
            <text
              key={t.id}
              x={t.x}
              y={t.y}
              fontSize={t.size}
              fill={t.color}
              fontWeight={t.bold ? 900 : 600}
              fontStyle={t.italic ? 'italic' : undefined}
              textDecoration={t.underline ? 'underline' : undefined}
              textAnchor={t.align ?? 'middle'}
              /* Turning the board must not turn the reading. A word written on
                 the field reads the same way up whichever way the field is. */
              transform={turn ? `rotate(${-turn} ${t.x} ${t.y})` : undefined}
              style={{
                cursor: readOnly ? 'default' : 'grab',
                userSelect: 'none',
                fontFamily: fontStack(t.font),
              }}
              onPointerDown={(e) => {
                if (readOnly) return
                e.stopPropagation()
                setSelected({ type: 'text', id: t.id })
                armPress({ type: 'text', id: t.id }, e)
                if (tool === 'move') setDragId(t.id)
              }}
              onContextMenu={(e) => onMenu({ type: 'text', id: t.id }, e)}
            >
              {t.text}
            </text>
          ))}

          {draft && draft.length > 1 && tool !== 'move' && tool !== 'select' && (
            <polyline
              points={draft.map((pt) => `${pt.x},${pt.y}`).join(' ')}
              fill="none"
              stroke={pathStyle(tool as PathKind).color}
              strokeWidth={0.7}
              strokeDasharray={pathStyle(tool as PathKind).dash}
              opacity={0.7}
            />
          )}

          {board.tokens.map((t) => (
            <Token
              key={t.id}
              token={t}
              readOnly={readOnly}
              selected={selected?.type === 'token' && selected.id === t.id}
              turn={turn}
              onGrab={(e) => {
                setSelected({ type: 'token', id: t.id })
                armPress({ type: 'token', id: t.id }, e)
                if (tool === 'move') setDragId(t.id)
              }}
              onInspect={(e) => onMenu({ type: 'token', id: t.id }, e)}
              onRemove={() => removeToken(t.id)}
            />
          ))}

          {/* The rubber band, while a box is being drawn round a group. */}
          {marquee && (
            <rect
              x={Math.min(marquee.x0, marquee.x1)}
              y={Math.min(marquee.y0, marquee.y1)}
              width={Math.abs(marquee.x1 - marquee.x0)}
              height={Math.abs(marquee.y1 - marquee.y0)}
              fill="rgba(255,255,255,0.12)"
              stroke="#ffffff"
              strokeWidth={0.35}
              strokeDasharray="1.2 1"
              pointerEvents="none"
            />
          )}

          {/* What the box caught. Drag anywhere inside it to move the lot;
              right-click it for delete and for keeping it as a look. */}
          {!readOnly && groupBox && (
            <rect
              x={groupBox.x}
              y={groupBox.y}
              width={groupBox.w}
              height={groupBox.h}
              fill="rgba(255,255,255,0.10)"
              stroke="#ffffff"
              strokeWidth={0.3}
              strokeDasharray="1.6 1.2"
              style={{ cursor: 'move' }}
              onPointerDown={startGroupDrag}
              onContextMenu={(e) => onMenu({ type: 'group', id: 'group' }, e)}
            />
          )}
        </g>
        </g>

        <defs>
          {/* An end shape has to be the colour of its own line, and a marker
              does not inherit the referencing line's colour — currentColor in
              here resolves against the defs block, which is how every cap came
              out black. So: one set per colour actually on the board. */}
          {capColors.map((color) =>
            (['start', 'end'] as const).map((end) => (
              <g key={`${color}-${end}`}>
                <marker id={capId('arrow', end, color)} viewBox="0 0 10 10" refX={end === 'end' ? 8 : 2} refY="5"
                  markerWidth="3" markerHeight="3" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill={color} />
                </marker>
                <marker id={capId('dot', end, color)} viewBox="0 0 10 10" refX="5" refY="5"
                  markerWidth="2" markerHeight="2" orient="auto">
                  <circle cx="5" cy="5" r="4" fill={color} />
                </marker>
                <marker id={capId('bar', end, color)} viewBox="0 0 10 10" refX="5" refY="5"
                  markerWidth="2.4" markerHeight="2.4" orient="auto">
                  <rect x="4" y="0" width="2.5" height="10" fill={color} />
                </marker>
                <marker id={capId('square', end, color)} viewBox="0 0 10 10" refX="5" refY="5"
                  markerWidth="2" markerHeight="2" orient="auto">
                  <rect x="1" y="1" width="8" height="8" fill={color} />
                </marker>
              </g>
            )),
          )}
        </defs>
      </svg>

      {!readOnly && menu && selected && (
        <BoardMenu
          board={board}
          selection={selected}
          at={menu}
          group={{
            count: picked.length,
            onDelete: deleteGroup,
            onColor: colorGroup,
            onSaveLook: saveLook,
          }}
          onChange={emit}
          onClose={() => setMenu(null)}
        />
      )}

      {!readOnly && (
        <p className="text-[0.7rem] text-gray-400 mt-1.5">
          Drag a disc to move it · right-click, or press and hold on a phone, for everything you can
          change about it · Select draws a box round a group to move it, delete it or keep it as a
          look · double-click a disc to take it off
        </p>
      )}
    </div>
  )
}

/** The markings, drawn once in field yards. */
function FieldLines() {
  const {
    length: L,
    width: W,
    goalLineFromEnd: G,
    goalWidth: GW,
    creaseRadius: C,
    restrainingFromGoalLine: R,
    boxFromSideline: BS,
    wingHalfLength: WL,
    subBoxHalf: SB,
  } = FIELD

  const line = { stroke: '#ffffff', strokeWidth: 0.35, fill: 'none', opacity: 0.9 }
  const mid = L / 2
  const midY = W / 2
  // The box sides and the wing lines share a line: ten yards off each sideline.
  const boxTop = BS
  const boxBottom = W - BS

  return (
    <g>
      <rect x={0} y={0} width={L} height={W} fill="#4f8757" />
      {/* Mown bands, kept faint on purpose: at any real contrast they read as
          yard lines, and a lacrosse field has none. */}
      {Array.from({ length: 8 }).map((_, i) => (
        <rect key={i} x={(L / 8) * i} y={0} width={L / 8} height={W} fill={i % 2 ? '#4e8656' : '#518a59'} />
      ))}

      {/* Sidelines and end lines */}
      <rect x={0} y={0} width={L} height={W} {...line} />

      {/* Centre line, and the X the ball is placed on */}
      <line x1={mid} y1={0} x2={mid} y2={W} {...line} />
      <line x1={mid - 1} y1={midY - 1} x2={mid + 1} y2={midY + 1} {...line} />
      <line x1={mid - 1} y1={midY + 1} x2={mid + 1} y2={midY - 1} {...line} />

      {/* Wing lines: along the field, ten yards in from each sideline, ten
          yards either side of the centre. Where the wing middies start. */}
      <line x1={mid - WL} y1={boxTop} x2={mid + WL} y2={boxTop} {...line} />
      <line x1={mid - WL} y1={boxBottom} x2={mid + WL} y2={boxBottom} {...line} />

      {/* The substitution area sits off the field, on the bench side, five
          yards either side of the centre line — so it is drawn on the grass
          outside the sideline, where it actually is. */}
      <line x1={mid - SB} y1={0} x2={mid - SB} y2={-1.6} {...line} opacity={0.6} />
      <line x1={mid + SB} y1={0} x2={mid + SB} y2={-1.6} {...line} opacity={0.6} />
      <line x1={mid - SB} y1={-1.6} x2={mid + SB} y2={-1.6} {...line} opacity={0.6} />

      {/* Each end: the restraining box, the crease, the goal */}
      {[
        { end: 0, dir: 1 },
        { end: L, dir: -1 },
      ].map(({ end, dir }) => {
        const goalX = end + dir * G
        // Twenty yards in front of the cage — which puts it thirty-five from
        // the end line, not twenty.
        const restrainX = goalX + dir * R
        return (
          <g key={end}>
            {/* The box — 35 wide, 20 deep from the end line */}
            <line x1={restrainX} y1={boxTop} x2={restrainX} y2={boxBottom} {...line} />
            <line x1={end} y1={boxTop} x2={restrainX} y2={boxTop} {...line} />
            <line x1={end} y1={boxBottom} x2={restrainX} y2={boxBottom} {...line} />

            {/* Crease, 9-foot radius around the goal */}
            <circle cx={goalX} cy={midY} r={C} {...line} />

            {/* The goal, seen from above: six feet between the pipes on the
                goal line, and the net swept back towards the end line. Drawn
                as the shape it is, because a square in a circle read as
                anything but a goal. */}
            <path
              d={`M ${goalX} ${midY - GW / 2} L ${goalX - dir * GW} ${midY} L ${goalX} ${midY + GW / 2} Z`}
              fill="rgba(255,255,255,0.18)"
              stroke="#ffffff"
              strokeWidth={0.3}
            />
            <line
              x1={goalX}
              y1={midY - GW / 2}
              x2={goalX}
              y2={midY + GW / 2}
              stroke="#ffffff"
              strokeWidth={0.55}
            />
          </g>
        )
      })}
    </g>
  )
}

function Token({
  token,
  readOnly,
  selected,
  turn,
  onGrab,
  onInspect,
  onRemove,
}: {
  token: BoardToken
  readOnly: boolean
  selected: boolean
  /** How far the board is turned, so the letter on the disc stays upright. */
  turn: number
  onGrab: (e: React.PointerEvent) => void
  /** Right-click: the way people ask "what can I change?" */
  onInspect: (e: React.MouseEvent) => void
  onRemove: () => void
}) {
  const style = tokenStyle(token.kind)
  const fill = token.color ?? style.fill
  const r = token.kind === 'ball' ? 0.9 : token.kind === 'cone' ? 1.1 : 1.9

  return (
    <g
      transform={`translate(${token.x} ${token.y})`}
      style={{ cursor: readOnly ? 'default' : 'grab' }}
      onPointerDown={(e) => {
        if (readOnly) return
        e.stopPropagation()
        onGrab(e)
      }}
      onContextMenu={onInspect}
      onDoubleClick={() => !readOnly && onRemove()}
    >
      {selected && <circle r={r + 0.7} fill="none" stroke="#ffffff" strokeWidth={0.35} opacity={0.95} />}
      {token.kind === 'cone' ? (
        <polygon points={`0,${-r * 1.6} ${r},${r} ${-r},${r}`} fill={fill} stroke="rgba(0,0,0,.25)" strokeWidth={0.15} />
      ) : (
        <circle r={r} fill={fill} stroke="rgba(0,0,0,.3)" strokeWidth={0.18} />
      )}
      {token.label && token.kind !== 'ball' && token.kind !== 'cone' && (
        <text
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={r * 1.1}
          fontWeight={800}
          fill={style.ink}
          /* The disc turns with the board; the letter on it does not. */
          transform={turn ? `rotate(${-turn})` : undefined}
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          {token.label.slice(0, 4)}
        </text>
      )}
    </g>
  )
}
