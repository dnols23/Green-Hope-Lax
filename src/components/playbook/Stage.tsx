'use client'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { SLIDE_H, SLIDE_W } from '@/lib/playbook'

/**
 * The slide, drawn at whatever size it has been given.
 *
 * Everything inside is laid out in slide units on a 1000 × 562 stage, and the
 * whole stage is scaled to fit. That is the one thing that makes a hand-placed
 * slide trustworthy: a caption sitting beside a particular player is beside
 * that player on the projector, on a laptop and on a phone, because nothing
 * reflows — the entire page is simply bigger or smaller.
 */
export function Stage({
  children,
  onScale,
  onBackgroundPointerDown,
  stageRef,
  background = '#ffffff',
  className = '',
  clip = true,
}: {
  children: ReactNode
  /** Handed the current scale, so an editor can turn screen pixels into slide units. */
  onScale?: (scale: number) => void
  onBackgroundPointerDown?: (e: React.PointerEvent) => void
  stageRef?: React.RefObject<HTMLDivElement | null>
  background?: string
  className?: string
  /** Off in the editor, so the handles on a box at the slide's edge aren't cut in half. */
  clip?: boolean
}) {
  const wrap = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  const measure = useCallback(() => {
    const el = wrap.current
    if (!el) return
    const next = el.clientWidth / SLIDE_W
    setScale(next > 0 ? next : 1)
    onScale?.(next > 0 ? next : 1)
  }, [onScale])

  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const ro = new ResizeObserver(() => measure())
    ro.observe(el)
    const id = requestAnimationFrame(measure)
    return () => {
      ro.disconnect()
      cancelAnimationFrame(id)
    }
  }, [measure])

  return (
    <div
      ref={wrap}
      className={`relative w-full ${clip ? 'overflow-hidden' : ''} ${className}`}
      style={{ aspectRatio: `${SLIDE_W} / ${SLIDE_H}`, background }}
      onPointerDown={onBackgroundPointerDown}
    >
      <div
        ref={stageRef}
        className="absolute top-0 left-0 origin-top-left"
        style={{ width: SLIDE_W, height: SLIDE_H, transform: `scale(${scale})` }}
      >
        {children}
      </div>
    </div>
  )
}
