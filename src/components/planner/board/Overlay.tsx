'use client'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { FIELD } from '@/lib/planner'
import { unionBox, type Box } from './geometry'
import { frameOf, itemBox, turnable, type Guide, type Handle, type Item } from './items'

/** Which handle was taken hold of, and of what. */
export type HandleHit =
  | { kind: 'resize'; id: string; handle: Handle }
  | { kind: 'rotate'; id: string }
  | { kind: 'vertex'; id: string; index: number }
  | { kind: 'mid'; id: string; index: number }
  | { kind: 'scale'; ids: string[]; box: Box; corner: Handle }

const GREEN = '#00693E'
/** A line with this many corners or fewer shows them to drag; a scribble has hundreds, and gets a box. */
const EDITABLE_POINTS = 40
/** The smallest a selection frame is drawn, in pixels. */
const MIN_FRAME = 60

/**
 * The selection, drawn over the field: a frame round what is picked, and the
 * handles on it.
 *
 * Everything is sized in screen pixels (through `px`), not yards, so a handle
 * is the same size under a thumb whether the field is a phone's width or a
 * projector's, zoomed in or not. Each handle is a small white dot inside a
 * much bigger invisible one — the dot is what the eye finds, the big one is
 * what the finger hits.
 */
export function SelectionOverlay({
  items,
  turn,
  px,
  marquee,
  guides,
  busy,
  onHandleDown,
}: {
  items: Item[]
  turn: number
  /** Pixels on the glass → yards. */
  px: (n: number) => number
  marquee: Box | null
  guides: Guide[]
  /** Something is being dragged: the frame stays, the handles get out of the way. */
  busy: boolean
  /** Double taps on a handle are told apart by whoever takes the press. */
  onHandleDown: (e: ReactPointerEvent, hit: HandleHit) => void
}) {
  const knob = (key: string, x: number, y: number, hit: HandleHit, cursor: string, small = false) => (
    <g key={key}>
      <circle
        cx={x}
        cy={y}
        r={px(18)}
        fill="transparent"
        style={{ cursor }}
        onPointerDown={(e) => onHandleDown(e, hit)}
      />
      <circle cx={x} cy={y} r={px(small ? 4.5 : 6.5)} fill="#ffffff" stroke={GREEN} strokeWidth={px(2)} pointerEvents="none" />
    </g>
  )

  const frameRect = (b: Box, pad: number, dashed = false) => (
    <>
      <rect x={b.x - pad} y={b.y - pad} width={b.w + pad * 2} height={b.h + pad * 2} fill="none" stroke="rgba(0,0,0,.35)" strokeWidth={px(3)} pointerEvents="none" />
      <rect
        x={b.x - pad}
        y={b.y - pad}
        width={b.w + pad * 2}
        height={b.h + pad * 2}
        fill="none"
        stroke="#ffffff"
        strokeWidth={px(1.5)}
        strokeDasharray={dashed ? `${px(5)} ${px(4)}` : undefined}
        pointerEvents="none"
      />
    </>
  )

  let body: React.ReactNode = null

  if (items.length === 1) {
    const item = items[0]
    const locked = !!item.it.locked
    if (item.type === 'path' && item.it.points.length <= EDITABLE_POINTS && !locked) {
      // A line shows its corners: drag one to reshape it, pull a midpoint to add one.
      const pts = item.it.points
      const id = item.it.id
      body = (
        <g>
          {item.it.curve && (
            <polyline points={pts.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#ffffff" strokeOpacity={0.55} strokeWidth={px(1)} strokeDasharray={`${px(3)} ${px(3)}`} pointerEvents="none" />
          )}
          {!busy &&
            pts.slice(0, -1).map((p, i) => {
              const q = pts[i + 1]
              // A midpoint only where there is room for it between two corners.
              if (Math.hypot(q.x - p.x, q.y - p.y) < px(44)) return null
              return knob(`m${i}`, (p.x + q.x) / 2, (p.y + q.y) / 2, { kind: 'mid', id, index: i }, 'copy', true)
            })}
          {!busy && pts.map((p, i) => knob(`v${i}`, p.x, p.y, { kind: 'vertex', id, index: i }, 'move'))}
        </g>
      )
    } else {
      const f = frameOf(item, turn)
      const b = f.box
      // A cone on a phone is a few pixels across. Its frame is never smaller
      // than a thumb, so the handles sit clear of it and a finger on the cone
      // moves the cone rather than catching a handle.
      const padX = Math.max(px(item.type === 'token' ? 3 : 6), (px(MIN_FRAME) - b.w) / 2)
      const padY = Math.max(px(item.type === 'token' ? 3 : 6), (px(MIN_FRAME) - b.h) / 2)
      const x0 = b.x - padX
      const y0 = b.y - padY
      const x1 = b.x + b.w + padX
      const y1 = b.y + b.h + padY
      const xm = (x0 + x1) / 2
      const ym = (y0 + y1) / 2
      const id = item.it.id
      const handles: React.ReactNode[] = []
      if (!locked && !busy) {
        if (item.type === 'shape') {
          const corners: [Handle, number, number][] = [
            ['nw', x0, y0],
            ['ne', x1, y0],
            ['se', x1, y1],
            ['sw', x0, y1],
          ]
          // Edge handles only where the shape is big enough to hold them apart.
          if ((x1 - x0) / px(1) > 70) corners.push(['n', xm, y0], ['s', xm, y1])
          if ((y1 - y0) / px(1) > 70) corners.push(['e', x1, ym], ['w', x0, ym])
          for (const [h, x, y] of corners) handles.push(knob(h, x, y, { kind: 'resize', id, handle: h }, `${h}-resize`))
        } else if (item.type === 'path') {
          // A scribble stretches as a whole, from its corners.
          for (const [h, x, y] of [['nw', x0, y0], ['ne', x1, y0], ['se', x1, y1], ['sw', x0, y1]] as [Handle, number, number][]) {
            handles.push(knob(h, x, y, { kind: 'scale', ids: [id], box: b, corner: h }, `${h}-resize`))
          }
        } else {
          // A player or a word grows from one corner.
          handles.push(knob('se', x1, y1, { kind: 'resize', id, handle: 'se' }, 'nwse-resize'))
        }
        if (turnable(item)) {
          const ry = y0 - px(30)
          handles.push(
            <line key="stalk" x1={xm} y1={y0} x2={xm} y2={ry} stroke="#ffffff" strokeWidth={px(1.5)} pointerEvents="none" />,
            knob('rot', xm, ry, { kind: 'rotate', id }, 'grab'),
          )
        }
      }
      body = (
        <g transform={f.rot ? `rotate(${f.rot} ${f.pivot.x} ${f.pivot.y})` : undefined}>
          {frameRect({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 }, 0, locked)}
          {locked && (
            // A lock on the corner says why the handles are not there.
            <g transform={`translate(${x1} ${y0})`} pointerEvents="none">
              <circle r={px(9)} fill="#17222e" />
              <path
                d={`M ${-px(3.5)} ${-px(0.5)} h ${px(7)} v ${px(5)} h ${-px(7)} z M ${-px(2)} ${-px(0.5)} v ${-px(2)} a ${px(2)} ${px(2)} 0 0 1 ${px(4)} 0 v ${px(2)}`}
                fill="none"
                stroke="#ffffff"
                strokeWidth={px(1.3)}
              />
            </g>
          )}
          {handles}
        </g>
      )
    }
  } else if (items.length > 1) {
    const boxes = items.map((x) => itemBox(x, turn))
    const all = unionBox(boxes)!
    const pad = px(8)
    const x0 = all.x - pad
    const y0 = all.y - pad
    const x1 = all.x + all.w + pad
    const y1 = all.y + all.h + pad
    const ids = items.map((x) => x.it.id)
    body = (
      <g>
        {/* Each thing picked, faintly, and the box round the lot. */}
        {boxes.map((b, i) => (
          <rect key={i} x={b.x - px(2)} y={b.y - px(2)} width={b.w + px(4)} height={b.h + px(4)} fill="none" stroke="#ffffff" strokeOpacity={0.6} strokeWidth={px(1)} pointerEvents="none" />
        ))}
        {frameRect(all, pad, true)}
        {!busy &&
          ([['nw', x0, y0], ['ne', x1, y0], ['se', x1, y1], ['sw', x0, y1]] as [Handle, number, number][]).map(([h, x, y]) =>
            knob(h, x, y, { kind: 'scale', ids, box: all, corner: h }, `${h}-resize`),
          )}
      </g>
    )
  }

  return (
    <g>
      {body}
      {/* The line something just snapped to. */}
      {guides.map((g, i) =>
        g.axis === 'x' ? (
          <line key={i} x1={g.at} y1={-4} x2={g.at} y2={FIELD.width + 4} stroke="#f0abfc" strokeWidth={px(1.5)} pointerEvents="none" />
        ) : (
          <line key={i} x1={-4} y1={g.at} x2={FIELD.length + 4} y2={g.at} stroke="#f0abfc" strokeWidth={px(1.5)} pointerEvents="none" />
        ),
      )}
      {/* The rubber band, while a box is being drawn round a group. */}
      {marquee && (
        <rect
          x={marquee.x}
          y={marquee.y}
          width={marquee.w}
          height={marquee.h}
          fill="rgba(255,255,255,0.12)"
          stroke="#ffffff"
          strokeWidth={px(1.2)}
          strokeDasharray={`${px(5)} ${px(4)}`}
          pointerEvents="none"
        />
      )}
    </g>
  )
}
