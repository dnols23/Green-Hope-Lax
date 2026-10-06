'use client'
import type { PointerEvent as ReactPointerEvent, MouseEvent as ReactMouseEvent } from 'react'
import {
  FIELD,
  fontStack,
  pathLook,
  shapeLook,
  tokenStyle,
  type Board,
  type BoardPath,
  type BoardShape,
  type BoardText,
  type BoardToken,
  type EndCap,
} from '@/lib/planner'
import { LINE_HEIGHT, pathD, polyD, smoothD, textBox, textLines } from './geometry'
import { stack, tokenRadius, type Item } from './items'

/*
 * How the things on a board are drawn. One set of pictures for the editor,
 * every read-only view and the PNG export: the export serialises whatever is
 * on the glass, so anything drawn here ends up in the picture, and nothing may
 * lean on a stylesheet or a fetched file to look right.
 */

/** The id of one end shape, in one colour. Hex is not valid in an id, so drop the hash. */
export const capId = (shape: string, end: 'start' | 'end', color: string) =>
  `cap-${shape}-${end}-${color.replace('#', '').toLowerCase()}`

const capUrl = (shape: EndCap, end: 'start' | 'end', color: string) =>
  shape === 'none' ? undefined : `url(#${capId(shape, end, color)})`

/**
 * An end shape has to be the colour of its own line, and a marker does not
 * inherit the referencing line's colour — currentColor in here resolves
 * against the defs block, which is how every cap once came out black. So: one
 * set per colour actually on the board.
 */
export function CapMarkers({ colors }: { colors: string[] }) {
  return (
    <defs>
      {colors.map((color) =>
        (['start', 'end'] as const).map((end) => (
          <g key={`${color}-${end}`}>
            <marker id={capId('arrow', end, color)} viewBox="0 0 10 10" refX={end === 'end' ? 8 : 2} refY="5"
              markerWidth="3" markerHeight="3" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill={color} />
            </marker>
            <marker id={capId('open', end, color)} viewBox="0 0 10 10" refX={end === 'end' ? 8.5 : 1.5} refY="5"
              markerWidth="3.2" markerHeight="3.2" orient="auto-start-reverse">
              <path d="M 1 1 L 9 5 L 1 9" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </marker>
            <marker id={capId('dot', end, color)} viewBox="0 0 10 10" refX="5" refY="5"
              markerWidth="2" markerHeight="2" orient="auto">
              <circle cx="5" cy="5" r="4" fill={color} />
            </marker>
            <marker id={capId('circle', end, color)} viewBox="0 0 10 10" refX="5" refY="5"
              markerWidth="2.6" markerHeight="2.6" orient="auto">
              <circle cx="5" cy="5" r="3.6" fill="none" stroke={color} strokeWidth="1.5" />
            </marker>
            {/* The screen: a bold flat bar square across the line where the pick lands. */}
            <marker id={capId('bar', end, color)} viewBox="0 0 10 10" refX="5" refY="5"
              markerWidth="4.2" markerHeight="4.2" orient="auto">
              <rect x="3.6" y="0" width="2.8" height="10" rx="0.6" fill={color} />
            </marker>
            <marker id={capId('square', end, color)} viewBox="0 0 10 10" refX="5" refY="5"
              markerWidth="2" markerHeight="2" orient="auto">
              <rect x="1" y="1" width="8" height="8" fill={color} />
            </marker>
          </g>
        )),
      )}
    </defs>
  )
}

/** Every line colour on the board, for the markers above. */
export function capColors(paths: BoardPath[]): string[] {
  return Array.from(new Set(paths.map((p) => pathLook(p).color)))
}

/** What a drawn item needs from the editor to be picked up. Absent on a read-only board. */
export interface ItemHandlers {
  onDown: (e: ReactPointerEvent, item: Item) => void
  onMenu: (e: ReactMouseEvent, item: Item) => void
  onDouble: (e: ReactMouseEvent, item: Item) => void
}

// ── Lines ───────────────────────────────────────────────────────────────────

export function PathView({
  path,
  hit,
  hitWidth = 2.4,
  handlers,
  item,
  faint = false,
}: {
  path: BoardPath
  hit?: boolean
  hitWidth?: number
  handlers?: ItemHandlers
  item?: Item
  faint?: boolean
}) {
  const look = pathLook(path)
  const d = pathD(path)
  return (
    <g>
      {/* A line is a couple of pixels wide and a finger is not, so a fat
          invisible twin underneath is what you actually tap. It follows the
          line the coach drew, not the wiggle on it. */}
      {hit && handlers && item && (
        <path
          d={look.curve ? smoothD(path.points) : polyD(path.points)}
          fill="none"
          stroke="transparent"
          strokeWidth={Math.max(hitWidth, look.width * 3)}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ cursor: path.locked ? 'default' : 'pointer' }}
          onPointerDown={(e) => handlers.onDown(e, item)}
          onContextMenu={(e) => handlers.onMenu(e, item)}
          onDoubleClick={(e) => handlers.onDouble(e, item)}
        />
      )}
      <path
        d={d}
        fill="none"
        stroke={look.color}
        strokeWidth={look.width}
        strokeDasharray={look.dash || undefined}
        strokeLinecap={look.lineCap}
        strokeLinejoin="round"
        opacity={faint ? 0.7 : look.opacity < 1 ? look.opacity : undefined}
        markerStart={capUrl(look.startCap, 'start', look.color)}
        markerEnd={capUrl(look.endCap, 'end', look.color)}
        style={{ pointerEvents: 'none' }}
      />
    </g>
  )
}

// ── Shapes ──────────────────────────────────────────────────────────────────

/** A shape's outline, as the SVG element it is. */
function ShapeGeometry({ s, ...paint }: { s: BoardShape } & React.SVGProps<SVGElement>) {
  const look = shapeLook(s)
  const p = paint as React.SVGProps<SVGRectElement>
  if (s.kind === 'rect' || s.kind === 'roundrect') {
    return <rect x={s.x} y={s.y} width={s.w} height={s.h} rx={look.radius || undefined} {...p} />
  }
  if (s.kind === 'ellipse') {
    return <ellipse cx={s.x + s.w / 2} cy={s.y + s.h / 2} rx={s.w / 2} ry={s.h / 2} {...(paint as React.SVGProps<SVGEllipseElement>)} />
  }
  const corners =
    s.kind === 'triangle'
      ? [{ x: 0.5, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }]
      : s.kind === 'diamond'
        ? [{ x: 0.5, y: 0 }, { x: 1, y: 0.5 }, { x: 0.5, y: 1 }, { x: 0, y: 0.5 }]
        : (s.pts ?? [])
  return (
    <polygon
      points={corners.map((c) => `${s.x + c.x * s.w},${s.y + c.y * s.h}`).join(' ')}
      {...(paint as React.SVGProps<SVGPolygonElement>)}
    />
  )
}

export function ShapeView({
  shape,
  handlers,
  item,
  hitWidth = 2,
}: {
  shape: BoardShape
  handlers?: ItemHandlers
  item?: Item
  hitWidth?: number
}) {
  const look = shapeLook(shape)
  const rot = shape.rot ?? 0
  const cx = shape.x + shape.w / 2
  const cy = shape.y + shape.h / 2
  const filled = look.fill !== 'none' && look.fillOpacity > 0
  const bind =
    handlers && item
      ? {
          onPointerDown: (e: ReactPointerEvent) => handlers.onDown(e, item),
          onContextMenu: (e: ReactMouseEvent) => handlers.onMenu(e, item),
          onDoubleClick: (e: ReactMouseEvent) => handlers.onDouble(e, item),
          style: { cursor: shape.locked ? 'default' : 'move' },
        }
      : null
  return (
    <g transform={rot ? `rotate(${rot} ${cx} ${cy})` : undefined}>
      <ShapeGeometry
        s={shape}
        fill={look.fill}
        fillOpacity={filled && look.fillOpacity < 1 ? look.fillOpacity : undefined}
        stroke={look.strokeWidth > 0 ? look.stroke : 'none'}
        strokeWidth={look.strokeWidth || undefined}
        strokeDasharray={look.dash || undefined}
        strokeLinejoin="round"
        style={{ pointerEvents: 'none' }}
      />
      {/* An empty outline is picked up by its edge, so a zone drawn round the
          players does not swallow a tap meant for them. A filled one is picked
          up anywhere inside. */}
      {bind && (
        <ShapeGeometry
          s={shape}
          fill={filled ? 'transparent' : 'none'}
          stroke="transparent"
          strokeWidth={Math.max(hitWidth, look.strokeWidth * 3)}
          {...(bind as object)}
          pointerEvents={filled ? 'all' : 'stroke'}
        />
      )}
    </g>
  )
}

// ── Words ───────────────────────────────────────────────────────────────────

export function TextView({
  text: t,
  turn,
  handlers,
  item,
  hidden = false,
}: {
  text: BoardText
  turn: number
  handlers?: ItemHandlers
  item?: Item
  /** Being typed into, in the box laid over it. */
  hidden?: boolean
}) {
  const lines = textLines(t.text)
  const box = textBox(t)
  // Turning the board must not turn the reading. A word written on the field
  // reads the same way up whichever way the field is; its own turn is on top.
  const rot = (t.rot ?? 0) - turn
  const pad = t.size * 0.3
  return (
    <g
      transform={rot ? `rotate(${rot} ${t.x} ${t.y})` : undefined}
      style={{ visibility: hidden ? 'hidden' : undefined, cursor: handlers ? (t.locked ? 'default' : 'move') : undefined }}
      onPointerDown={handlers && item ? (e) => handlers.onDown(e, item) : undefined}
      onContextMenu={handlers && item ? (e) => handlers.onMenu(e, item) : undefined}
      onDoubleClick={handlers && item ? (e) => handlers.onDouble(e, item) : undefined}
    >
      {t.bg ? (
        <rect
          x={box.x - pad}
          y={box.y - pad * 0.5}
          width={box.w + pad * 2}
          height={box.h + pad}
          rx={t.size * 0.22}
          fill={t.bg}
          fillOpacity={t.bgOpacity !== undefined && t.bgOpacity < 1 ? t.bgOpacity : undefined}
        />
      ) : handlers ? (
        // Letters are thin; the box round them is what a finger lands on.
        <rect x={box.x - pad} y={box.y - pad * 0.5} width={box.w + pad * 2} height={box.h + pad} fill="transparent" />
      ) : null}
      <text
        x={t.x}
        y={t.y}
        fontSize={t.size}
        fill={t.color}
        fontWeight={t.bold ? 900 : 600}
        fontStyle={t.italic ? 'italic' : undefined}
        textDecoration={t.underline ? 'underline' : undefined}
        textAnchor={t.align ?? 'middle'}
        style={{ userSelect: 'none', fontFamily: fontStack(t.font) }}
      >
        {lines.length === 1
          ? t.text
          : lines.map((l, i) => (
              <tspan key={i} x={t.x} dy={i === 0 ? 0 : t.size * LINE_HEIGHT}>
                {l || ' '}
              </tspan>
            ))}
      </text>
    </g>
  )
}

// ── Players and things ──────────────────────────────────────────────────────

export function TokenView({
  token,
  turn,
  handlers,
  item,
}: {
  token: BoardToken
  /** How far the board is turned, so the letter on the disc stays upright. */
  turn: number
  handlers?: ItemHandlers
  item?: Item
}) {
  const style = tokenStyle(token.kind)
  const fill = token.color ?? style.fill
  const r = tokenRadius(token)
  const s = token.size ?? 1
  const rot = token.rot ?? 0
  const mark = token.mark ?? 'disc'
  const people = token.kind !== 'ball' && token.kind !== 'cone' && token.kind !== 'goal' && token.kind !== 'ladder'
  const ink = mark === 'disc' || mark === 'square' ? style.ink : fill

  let body: React.ReactNode
  if (token.kind === 'cone') {
    // A cone stands up on the glass whichever way the field is turned.
    body = (
      <polygon
        points={`0,${-r * 1.6} ${r},${r} ${-r},${r}`}
        fill={fill}
        stroke="rgba(0,0,0,.25)"
        strokeWidth={0.15}
        transform={turn + rot ? `rotate(${-turn - rot})` : undefined}
      />
    )
  } else if (token.kind === 'goal') {
    // Seen from above, like the cages on the field: the pipes across the mouth
    // and the net swept back behind them. It faces along +x until turned.
    body = (
      <>
        <path d={`M ${0.8 * s} ${-1.2 * s} L ${-1.2 * s} 0 L ${0.8 * s} ${1.2 * s} Z`} fill="rgba(255,255,255,0.3)" stroke={fill} strokeWidth={0.22} strokeLinejoin="round" />
        <line x1={0.8 * s} y1={-1.25 * s} x2={0.8 * s} y2={1.25 * s} stroke={fill} strokeWidth={0.5} strokeLinecap="round" />
      </>
    )
  } else if (token.kind === 'ladder') {
    const rungs = Math.round(6 / 0.5)
    body = (
      <>
        <rect x={-3 * s} y={-0.6 * s} width={6 * s} height={1.2 * s} fill="rgba(0,0,0,0.12)" stroke={fill} strokeWidth={0.2} />
        {Array.from({ length: rungs - 1 }).map((_, i) => (
          <line key={i} x1={(-3 + (i + 1) * 0.5) * s} y1={-0.6 * s} x2={(-3 + (i + 1) * 0.5) * s} y2={0.6 * s} stroke={fill} strokeWidth={0.14} />
        ))}
      </>
    )
  } else if (people && mark === 'ring') {
    body = <circle r={r * 0.92} fill="#ffffff" stroke={fill} strokeWidth={r * 0.16} />
  } else if (people && mark === 'square') {
    body = <rect x={-r * 0.9} y={-r * 0.9} width={r * 1.8} height={r * 1.8} rx={r * 0.25} fill={fill} stroke="rgba(0,0,0,.3)" strokeWidth={0.18} />
  } else if (people && mark === 'x') {
    const k = r * 0.72
    body = (
      <>
        {/* The whole square is the target, not just the two strokes. */}
        <rect x={-r} y={-r} width={r * 2} height={r * 2} fill="transparent" />
        <path d={`M ${-k} ${-k} L ${k} ${k} M ${k} ${-k} L ${-k} ${k}`} stroke="#ffffff" strokeWidth={r * 0.42} strokeLinecap="round" opacity={0.6} />
        <path d={`M ${-k} ${-k} L ${k} ${k} M ${k} ${-k} L ${-k} ${k}`} stroke={fill} strokeWidth={r * 0.26} strokeLinecap="round" />
      </>
    )
  } else {
    body = <circle r={r} fill={fill} stroke="rgba(0,0,0,.3)" strokeWidth={0.18} />
  }

  const label = token.label && people ? token.label.slice(0, 4) : ''
  const labelTurn = -turn - rot

  return (
    <g
      transform={`translate(${token.x} ${token.y})${rot ? ` rotate(${rot})` : ''}`}
      style={{ cursor: handlers ? (token.locked ? 'default' : 'grab') : 'default' }}
      onPointerDown={handlers && item ? (e) => handlers.onDown(e, item) : undefined}
      onContextMenu={handlers && item ? (e) => handlers.onMenu(e, item) : undefined}
      onDoubleClick={handlers && item ? (e) => handlers.onDouble(e, item) : undefined}
    >
      {body}
      {label &&
        (mark === 'x' ? (
          // An X carries its number beside it, the way it is written on a whiteboard.
          <text
            x={r * 0.95}
            y={r * 0.95}
            fontSize={r * 0.85}
            fontWeight={800}
            fill={fill}
            stroke="#ffffff"
            strokeWidth={r * 0.18}
            paintOrder="stroke"
            transform={labelTurn ? `rotate(${labelTurn} ${r * 0.95} ${r * 0.95})` : undefined}
            style={{ pointerEvents: 'none', userSelect: 'none' }}
          >
            {label}
          </text>
        ) : (
          <text
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={r * 1.1}
            fontWeight={800}
            fill={ink}
            /* The disc turns with the board; the letter on it does not. */
            transform={labelTurn ? `rotate(${labelTurn})` : undefined}
            style={{ pointerEvents: 'none', userSelect: 'none' }}
          >
            {label}
          </text>
        ))}
    </g>
  )
}

// ── The lot ─────────────────────────────────────────────────────────────────

export function ItemView({
  item,
  turn,
  handlers,
  hitWidth,
  editingText,
}: {
  item: Item
  turn: number
  handlers?: ItemHandlers
  hitWidth?: number
  editingText?: string | null
}) {
  if (item.type === 'path') return <PathView path={item.it} hit={!!handlers} hitWidth={hitWidth} handlers={handlers} item={item} />
  if (item.type === 'shape') return <ShapeView shape={item.it} handlers={handlers} item={item} hitWidth={hitWidth} />
  if (item.type === 'text') return <TextView text={item.it} turn={turn} handlers={handlers} item={item} hidden={editingText === item.it.id} />
  return <TokenView token={item.it} turn={turn} handlers={handlers} item={item} />
}

/** Everything on the board, bottom first. */
export function BoardItems({
  board,
  turn,
  handlers,
  hitWidth,
  editingText,
}: {
  board: Board
  turn: number
  handlers?: ItemHandlers
  hitWidth?: number
  editingText?: string | null
}) {
  return (
    <>
      {stack(board).map((item) => (
        <ItemView key={item.it.id} item={item} turn={turn} handlers={handlers} hitWidth={hitWidth} editingText={editingText} />
      ))}
    </>
  )
}

// ── The field ───────────────────────────────────────────────────────────────

/** The markings, drawn once in field yards. */
export function FieldLines() {
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
