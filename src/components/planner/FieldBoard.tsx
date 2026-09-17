'use client'
import { useRef, useState } from 'react'
import {
  FIELD,
  POSITION_TOKENS,
  TOKEN_KINDS,
  PATH_KINDS,
  tokenStyle,
  pathStyle,
  pathLook,
  newId,
  type Board,
  type BoardToken,
  type PathKind,
  type TokenKind,
} from '@/lib/planner'
import { BoardInspector, type Selection } from './BoardInspector'

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
}: {
  board: Board
  onChange?: (next: Board) => void
  /** Players already picked for this block — the only ones offered for the field. */
  players?: BoardPlayer[]
  readOnly?: boolean
}) {
  /* Every colour in use on the board, so each one gets its own set of end
     shapes below. */
  const capColors = Array.from(new Set(board.paths.map((p) => pathLook(p).color)))
  const svgRef = useRef<SVGSVGElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [full, setFull] = useState(false)
  const [tool, setTool] = useState<'move' | PathKind>('move')
  const [dragId, setDragId] = useState<string | null>(null)
  const [draft, setDraft] = useState<{ x: number; y: number }[] | null>(null)
  const [nextKind, setNextKind] = useState<TokenKind>('offense')
  /* Undo and redo, kept here rather than in the page: a coach rubbing out the
     last line is undoing a stroke, not a save, and the two should not be the
     same button. Every change goes through emit(), so this is the whole
     history of the board. */
  const [past, setPast] = useState<Board[]>([])
  const [future, setFuture] = useState<Board[]>([])
  /* What is selected, and therefore what the inspector is editing. Tapping a
     disc or a line picks it; a right-click or a long press does the same on the
     way to the same panel, because that is where people reach for it. */
  const [selected, setSelected] = useState<Selection>(null)

  const viewW = FIELD.length + PAD * 2
  const viewH = FIELD.width + PAD * 2

  /** Screen point → field yards. */
  function toField(e: { clientX: number; clientY: number }) {
    const svg = svgRef.current
    if (!svg) return { x: 0, y: 0 }
    const r = svg.getBoundingClientRect()
    const x = ((e.clientX - r.left) / r.width) * viewW - PAD
    const y = ((e.clientY - r.top) / r.height) * viewH - PAD
    return {
      x: Math.max(0, Math.min(FIELD.length, Math.round(x * 10) / 10)),
      y: Math.max(0, Math.min(FIELD.width, Math.round(y * 10) / 10)),
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

  function onPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    if (readOnly) return
    if (tool === 'move') {
      // A tap on the grass is "never mind".
      if (e.target === svgRef.current) setSelected(null)
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
    if (dragId) { setDragId(null); return }
    if (draft && tool !== 'move') {
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
        viewBox={`0 0 ${viewW} ${viewH}`}
        className={`w-full rounded-xl select-none touch-none ${full ? 'flex-1 min-h-0' : ''}`}
        style={{ background: '#4a7f52', cursor: tool === 'move' ? 'default' : 'crosshair' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        <g transform={`translate(${PAD} ${PAD})`}>
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
                  }}
                  onContextMenu={(e) => {
                    if (readOnly) return
                    e.preventDefault()
                    setSelected({ type: 'path', id: p.id })
                  }}
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
              textAnchor="middle"
              style={{ cursor: readOnly ? 'default' : 'grab', userSelect: 'none' }}
              onPointerDown={(e) => {
                if (readOnly) return
                e.stopPropagation()
                setSelected({ type: 'text', id: t.id })
                if (tool === 'move') setDragId(t.id)
              }}
              onContextMenu={(e) => {
                if (readOnly) return
                e.preventDefault()
                setSelected({ type: 'text', id: t.id })
              }}
            >
              {t.text}
            </text>
          ))}

          {draft && draft.length > 1 && tool !== 'move' && (
            <polyline
              points={draft.map((pt) => `${pt.x},${pt.y}`).join(' ')}
              fill="none"
              stroke={pathStyle(tool).color}
              strokeWidth={0.7}
              strokeDasharray={pathStyle(tool).dash}
              opacity={0.7}
            />
          )}

          {board.tokens.map((t) => (
            <Token
              key={t.id}
              token={t}
              readOnly={readOnly}
              selected={selected?.type === 'token' && selected.id === t.id}
              onGrab={() => {
                setSelected({ type: 'token', id: t.id })
                if (tool === 'move') setDragId(t.id)
              }}
              onInspect={() => setSelected({ type: 'token', id: t.id })}
              onRemove={() => removeToken(t.id)}
            />
          ))}
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

      {!readOnly && selected && (
        <div className="mt-2">
          <BoardInspector
            board={board}
            selection={selected}
            onChange={emit}
            onClose={() => setSelected(null)}
          />
        </div>
      )}

      {!readOnly && !selected && (
        <p className="text-[0.7rem] text-gray-400 mt-1.5">
          Drag a disc to move it · tap a disc, a line or a word to change how it looks · long-press
          or right-click does the same · double-click a disc to take it off
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
  onGrab,
  onInspect,
  onRemove,
}: {
  token: BoardToken
  readOnly: boolean
  selected: boolean
  onGrab: () => void
  /** Right-click or a long press: the way people ask "what can I change?" */
  onInspect: () => void
  onRemove: () => void
}) {
  const style = tokenStyle(token.kind)
  const fill = token.color ?? style.fill
  const r = token.kind === 'ball' ? 0.9 : token.kind === 'cone' ? 1.1 : 1.9
  const press = useRef<ReturnType<typeof setTimeout> | null>(null)

  const startPress = () => {
    press.current = setTimeout(onInspect, 450)
  }
  const endPress = () => {
    if (press.current) clearTimeout(press.current)
    press.current = null
  }

  return (
    <g
      transform={`translate(${token.x} ${token.y})`}
      style={{ cursor: readOnly ? 'default' : 'grab' }}
      onPointerDown={(e) => {
        if (readOnly) return
        e.stopPropagation()
        onGrab()
        startPress()
      }}
      onPointerUp={endPress}
      onPointerLeave={endPress}
      onContextMenu={(e) => {
        if (readOnly) return
        e.preventDefault()
        onInspect()
      }}
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
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          {token.label.slice(0, 4)}
        </text>
      )}
    </g>
  )
}
