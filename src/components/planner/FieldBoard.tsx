'use client'
import { useRef, useState } from 'react'
import {
  FIELD,
  TOKEN_KINDS,
  PATH_KINDS,
  tokenStyle,
  pathStyle,
  newId,
  type Board,
  type BoardToken,
  type PathKind,
  type TokenKind,
} from '@/lib/planner'

/** A player who can be dropped onto the field. */
export interface BoardPlayer {
  id: string
  name: string
  number: string | null
}

const PAD = 4 // yards of grass drawn outside the lines

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
  players?: BoardPlayer[]
  readOnly?: boolean
}) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [tool, setTool] = useState<'move' | PathKind>('move')
  const [dragId, setDragId] = useState<string | null>(null)
  const [draft, setDraft] = useState<{ x: number; y: number }[] | null>(null)
  const [nextKind, setNextKind] = useState<TokenKind>('offense')

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

  const emit = (next: Board) => onChange?.(next)

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

  function onPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    if (readOnly) return
    if (tool === 'move') return
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    setDraft([toField(e)])
  }

  function onPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (readOnly) return
    if (dragId) {
      const { x, y } = toField(e)
      emit({ ...board, tokens: board.tokens.map((t) => (t.id === dragId ? { ...t, x, y } : t)) })
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

  const toolBtn = (active: boolean) =>
    `px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
      active ? 'text-white' : 'text-gray-600 bg-white hover:bg-gray-50'
    }`

  return (
    <div>
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
            ✋ Move
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

          {TOKEN_KINDS.map((k) => (
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

          <span className="w-px h-5 bg-gray-200 mx-1" />

          <button
            type="button"
            onClick={() => emit({ tokens: [], paths: [] })}
            className="px-2.5 py-1.5 rounded-lg text-xs font-bold border border-gray-200 text-gray-500 bg-white hover:bg-gray-50"
          >
            Clear
          </button>
          {board.paths.length > 0 && (
            <button
              type="button"
              onClick={() => emit({ ...board, paths: board.paths.slice(0, -1) })}
              className="px-2.5 py-1.5 rounded-lg text-xs font-bold border border-gray-200 text-gray-500 bg-white hover:bg-gray-50"
            >
              Undo line
            </button>
          )}
        </div>
      )}

      {!readOnly && players.length > 0 && (
        <div className="mb-2">
          <div className="text-[0.65rem] font-black tracking-wider uppercase text-gray-400 mb-1">
            Roster — tap to put on the field
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
        className="w-full rounded-xl select-none touch-none"
        style={{ background: '#4a7f52', cursor: tool === 'move' ? 'default' : 'crosshair' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        <g transform={`translate(${PAD} ${PAD})`}>
          <FieldLines />

          {board.paths.map((p) => {
            const style = pathStyle(p.kind)
            return (
              <polyline
                key={p.id}
                points={p.points.map((pt) => `${pt.x},${pt.y}`).join(' ')}
                fill="none"
                stroke={style.color}
                strokeWidth={0.7}
                strokeDasharray={style.dash}
                strokeLinecap="round"
                strokeLinejoin="round"
                markerEnd="url(#gh-arrow)"
              />
            )
          })}

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
              onGrab={() => tool === 'move' && setDragId(t.id)}
              onRemove={() => removeToken(t.id)}
            />
          ))}
        </g>

        <defs>
          <marker id="gh-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
          </marker>
        </defs>
      </svg>

      {!readOnly && (
        <p className="text-[0.7rem] text-gray-400 mt-1.5">
          Drag a disc to move it · double-click one to take it off · pick a line tool and drag to draw
        </p>
      )}
    </div>
  )
}

/** The markings, drawn once in field yards. */
function FieldLines() {
  const { length: L, width: W, goalLineFromEnd: G, creaseRadius: C, restrainingFromGoalLine: R, wingFromCenter: WG } = FIELD
  const line = { stroke: '#ffffff', strokeWidth: 0.35, fill: 'none', opacity: 0.85 }
  const mid = L / 2
  return (
    <g>
      <rect x={0} y={0} width={L} height={W} fill="#4f8757" />
      {/* mown stripes, so the field reads as grass rather than a diagram */}
      {Array.from({ length: 11 }).map((_, i) => (
        <rect key={i} x={(L / 11) * i} y={0} width={L / 11} height={W} fill={i % 2 ? '#4a8052' : '#538b5a'} />
      ))}
      <rect x={0} y={0} width={L} height={W} {...line} />
      <line x1={mid} y1={0} x2={mid} y2={W} {...line} />
      {/* wing lines */}
      <line x1={mid - WG} y1={0} x2={mid - WG} y2={W * 0.28} {...line} />
      <line x1={mid - WG} y1={W * 0.72} x2={mid - WG} y2={W} {...line} />
      <line x1={mid + WG} y1={0} x2={mid + WG} y2={W * 0.28} {...line} />
      <line x1={mid + WG} y1={W * 0.72} x2={mid + WG} y2={W} {...line} />
      {/* face-off X */}
      <line x1={mid - 1} y1={W / 2 - 1} x2={mid + 1} y2={W / 2 + 1} {...line} />
      <line x1={mid - 1} y1={W / 2 + 1} x2={mid + 1} y2={W / 2 - 1} {...line} />

      {[G, L - G].map((gx) => (
        <g key={gx}>
          <line x1={gx} y1={0} x2={gx} y2={W} {...line} opacity={0.5} />
          <circle cx={gx} cy={W / 2} r={C} {...line} />
          <rect x={gx - 1} y={W / 2 - 3} width={2} height={6} fill="none" stroke="#ffffff" strokeWidth={0.45} />
        </g>
      ))}
      {/* restraining lines */}
      <line x1={G + R} y1={0} x2={G + R} y2={W} {...line} />
      <line x1={L - G - R} y1={0} x2={L - G - R} y2={W} {...line} />
      {/* goal areas (the box) */}
      <rect x={G - 12} y={W / 2 - 17} width={24} height={34} {...line} opacity={0.55} />
      <rect x={L - G - 12} y={W / 2 - 17} width={24} height={34} {...line} opacity={0.55} />
    </g>
  )
}

function Token({
  token,
  readOnly,
  onGrab,
  onRemove,
}: {
  token: BoardToken
  readOnly: boolean
  onGrab: () => void
  onRemove: () => void
}) {
  const style = tokenStyle(token.kind)
  const r = token.kind === 'ball' ? 0.9 : token.kind === 'cone' ? 1.1 : 1.9
  return (
    <g
      transform={`translate(${token.x} ${token.y})`}
      style={{ cursor: readOnly ? 'default' : 'grab' }}
      onPointerDown={(e) => { if (!readOnly) { e.stopPropagation(); onGrab() } }}
      onDoubleClick={() => !readOnly && onRemove()}
    >
      {token.kind === 'cone' ? (
        <polygon points={`0,${-r * 1.6} ${r},${r} ${-r},${r}`} fill={style.fill} stroke="rgba(0,0,0,.25)" strokeWidth={0.15} />
      ) : (
        <circle r={r} fill={style.fill} stroke="rgba(0,0,0,.3)" strokeWidth={0.18} />
      )}
      {token.label && token.kind !== 'ball' && token.kind !== 'cone' && (
        <text
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={r * 1.1}
          fontWeight={800}
          fill={style.ink}
        >
          {token.label.slice(0, 3)}
        </text>
      )}
    </g>
  )
}
