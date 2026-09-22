'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { BlockArt, type SlidePlay } from './BlockArt'
import { Stage } from './Stage'
import { SLIDE_H, SLIDE_W, clampFrame, inZOrder, type Frame, type SlideBlock } from '@/lib/playbook'

/** Which corner or edge is being pulled. */
type Grip = 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w'

const GRIPS: { key: Grip; cx: number; cy: number; cursor: string }[] = [
  { key: 'nw', cx: 0, cy: 0, cursor: 'nwse-resize' },
  { key: 'n', cx: 0.5, cy: 0, cursor: 'ns-resize' },
  { key: 'ne', cx: 1, cy: 0, cursor: 'nesw-resize' },
  { key: 'e', cx: 1, cy: 0.5, cursor: 'ew-resize' },
  { key: 'se', cx: 1, cy: 1, cursor: 'nwse-resize' },
  { key: 's', cx: 0.5, cy: 1, cursor: 'ns-resize' },
  { key: 'sw', cx: 0, cy: 1, cursor: 'nesw-resize' },
  { key: 'w', cx: 0, cy: 0.5, cursor: 'ew-resize' },
]

/** Snap to a 10-unit grid unless Alt is held, which is the usual bargain. */
const SNAP = 10
const snap = (n: number, free: boolean) => (free ? Math.round(n) : Math.round(n / SNAP) * SNAP)

/**
 * The slide, being arranged.
 *
 * Drag a box to move it, pull a handle to resize it, arrow keys to nudge —
 * and because everything is in slide units on a scaled stage, where you put
 * something is where it stays on every screen it is ever shown on.
 */
export function SlideCanvas({
  blocks,
  plays,
  title,
  selected,
  onSelect,
  onChange,
  onDelete,
  onDuplicate,
}: {
  blocks: SlideBlock[]
  plays: Record<string, SlidePlay>
  title: string
  selected: string | null
  onSelect: (id: string | null) => void
  onChange: (id: string, frame: Frame) => void
  onDelete: (id: string) => void
  onDuplicate: (id: string) => void
}) {
  const scaleRef = useRef(1)
  const stageRef = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState<{ id: string; grip: Grip | null } | null>(null)
  const startRef = useRef<{ x: number; y: number; frame: Frame } | null>(null)

  const onScale = useCallback((s: number) => { scaleRef.current = s }, [])

  const begin = (e: React.PointerEvent, block: SlideBlock, grip: Grip | null) => {
    e.stopPropagation()
    e.preventDefault()
    onSelect(block.id)
    if (!block.frame) return
    startRef.current = { x: e.clientX, y: e.clientY, frame: block.frame }
    setDrag({ id: block.id, grip })
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
  }

  useEffect(() => {
    if (!drag) return
    const move = (e: PointerEvent) => {
      const start = startRef.current
      if (!start) return
      const k = scaleRef.current || 1
      const dx = (e.clientX - start.x) / k
      const dy = (e.clientY - start.y) / k
      const free = e.altKey
      const f = start.frame

      if (!drag.grip) {
        onChange(drag.id, clampFrame({ ...f, x: snap(f.x + dx, free), y: snap(f.y + dy, free) }))
        return
      }
      const g = drag.grip
      let { x, y, w, h } = f
      if (g.includes('e')) w = f.w + dx
      if (g.includes('s')) h = f.h + dy
      if (g.includes('w')) { x = f.x + dx; w = f.w - dx }
      if (g.includes('n')) { y = f.y + dy; h = f.h - dy }
      onChange(drag.id, clampFrame({ x: snap(x, free), y: snap(y, free), w: snap(w, free), h: snap(h, free) }))
    }
    const up = () => { setDrag(null); startRef.current = null }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [drag, onChange])

  // Arrows nudge, Delete removes, Escape lets go — the usual bargain.
  useEffect(() => {
    if (!selected) return
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return
      const block = blocks.find((b) => b.id === selected)
      if (!block?.frame) return
      const step = e.shiftKey ? 10 : 1
      const f = block.frame
      if (e.key === 'ArrowLeft') { e.preventDefault(); onChange(selected, clampFrame({ ...f, x: f.x - step })) }
      else if (e.key === 'ArrowRight') { e.preventDefault(); onChange(selected, clampFrame({ ...f, x: f.x + step })) }
      else if (e.key === 'ArrowUp') { e.preventDefault(); onChange(selected, clampFrame({ ...f, y: f.y - step })) }
      else if (e.key === 'ArrowDown') { e.preventDefault(); onChange(selected, clampFrame({ ...f, y: f.y + step })) }
      else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); onDelete(selected) }
      else if (e.key === 'Escape') onSelect(null)
      else if ((e.key === 'd' || e.key === 'D') && (e.metaKey || e.ctrlKey)) { e.preventDefault(); onDuplicate(selected) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selected, blocks, onChange, onDelete, onDuplicate, onSelect])

  return (
    <Stage
      onScale={onScale}
      stageRef={stageRef}
      onBackgroundPointerDown={() => onSelect(null)}
      className="rounded-lg border border-gray-200 select-none touch-none"
    >
      {title && (
        <div style={{ position: 'absolute', left: 48, top: 28, right: 48, fontSize: 44, fontWeight: 900, lineHeight: 1.1, pointerEvents: 'none', color: '#111' }}>
          {title}
        </div>
      )}

      {inZOrder(blocks).map((b) => {
        if (!b.frame) return null
        const on = selected === b.id
        return (
          <div
            key={b.id}
            onPointerDown={(e) => begin(e, b, null)}
            style={{
              position: 'absolute',
              left: b.frame.x,
              top: b.frame.y,
              width: b.frame.w,
              height: b.frame.h,
              cursor: drag?.id === b.id && !drag.grip ? 'grabbing' : 'grab',
              outline: on ? '2px solid var(--gh-green)' : '1px dashed rgba(0,0,0,0.12)',
              outlineOffset: 2,
            }}
          >
            <div className="w-full h-full pointer-events-none">
              <BlockArt block={b} plays={plays} editing />
            </div>

            {on &&
              GRIPS.map((g) => (
                <div
                  key={g.key}
                  onPointerDown={(e) => begin(e, b, g.key)}
                  role="presentation"
                  style={{
                    position: 'absolute',
                    left: g.cx * b.frame!.w - 7,
                    top: g.cy * b.frame!.h - 7,
                    width: 14,
                    height: 14,
                    borderRadius: 4,
                    background: '#fff',
                    border: '2px solid var(--gh-green)',
                    cursor: g.cursor,
                  }}
                />
              ))}
          </div>
        )
      })}

      {/* Guides, while something is being moved, so edges can be lined up. */}
      {drag && (
        <>
          <div style={{ position: 'absolute', left: SLIDE_W / 2, top: 0, bottom: 0, width: 1, background: 'rgba(0,105,62,0.25)' }} />
          <div style={{ position: 'absolute', top: SLIDE_H / 2, left: 0, right: 0, height: 1, background: 'rgba(0,105,62,0.25)' }} />
        </>
      )}
    </Stage>
  )
}
