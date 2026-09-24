'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Board } from '@/lib/planner'
import { FieldBoard } from './FieldBoard'

/**
 * Two taps in the same spot, quickly — the gesture every phone uses for "let me
 * see that bigger". Returns a pointer-down handler that says whether this press
 * finished a double tap.
 */
export function useDoubleTap(onDouble: () => void, ms = 320) {
  const last = useRef<{ t: number; x: number; y: number } | null>(null)
  return useCallback(
    (e: React.PointerEvent) => {
      const now = e.timeStamp
      const prev = last.current
      if (prev && now - prev.t < ms && Math.hypot(e.clientX - prev.x, e.clientY - prev.y) < 30) {
        last.current = null
        onDouble()
        return true
      }
      last.current = { t: now, x: e.clientX, y: e.clientY }
      return false
    },
    [onDouble, ms],
  )
}

/**
 * A board, as big as the screen will take it.
 *
 * For a coach on the field with a phone: double-tap a play and it fills the
 * glass. Held upright, the field turns on its side so it runs the long way down
 * the screen, the way turning the phone would — without having to turn it.
 * Built as an overlay rather than the browser's own full screen, because an
 * iPhone won't put anything but a video full screen; where the browser does
 * allow it, it is asked for as well.
 *
 * Double-tap again, ✕, or Escape to go back.
 */
export function BoardViewer({ board, title, onClose }: { board: Board; title?: string | null; onClose: () => void }) {
  const root = useRef<HTMLDivElement>(null)
  const body = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)
  // null follows the screen: sideways when the phone is upright.
  const [turnPick, setTurnPick] = useState<boolean | null>(null)
  const closeRef = useRef(onClose)
  useEffect(() => {
    closeRef.current = onClose
  }, [onClose])

  useEffect(() => {
    const el = body.current
    if (!el) return
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight })
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const page = document.body
    const was = page.style.overflow
    page.style.overflow = 'hidden'
    root.current?.requestFullscreen?.().catch(() => {})
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current()
    }
    const onFs = () => {
      if (!document.fullscreenElement) closeRef.current()
    }
    window.addEventListener('keydown', onKey)
    document.addEventListener('fullscreenchange', onFs)
    return () => {
      page.style.overflow = was
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('fullscreenchange', onFs)
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    }
  }, [])

  const doubleTap = useDoubleTap(onClose)
  const portrait = size ? size.h > size.w : false
  const turned = turnPick ?? portrait

  // Turned, the board is laid out in the body's height by its width and spun a
  // quarter turn about its middle, so it lands filling the same space.
  const frame: React.CSSProperties =
    size && turned
      ? {
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: size.h,
          height: size.w,
          transform: 'translate(-50%, -50%) rotate(90deg)',
        }
      : { position: 'absolute', inset: 0 }

  if (typeof document === 'undefined') return null
  return createPortal(
    <div
      ref={root}
      role="dialog"
      aria-modal="true"
      aria-label={title ? `${title}, full screen` : 'Board, full screen'}
      className="fixed inset-0 z-[95] flex flex-col bg-[#0e1a12] text-white"
      style={{ touchAction: 'manipulation' }}
    >
      <div className="flex items-center gap-2 px-3 py-2 shrink-0" style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top))' }}>
        <p className="min-w-0 flex-1 truncate text-sm font-bold text-white/80">{title || 'Board'}</p>
        <button
          type="button"
          onClick={() => setTurnPick(!turned)}
          className="h-9 px-3 rounded-full bg-white/10 hover:bg-white/20 text-xs font-bold"
          aria-pressed={turned}
          title="Turn the field"
        >
          ⟳ Turn
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close full screen"
          className="w-9 h-9 inline-flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-lg leading-none"
        >
          ✕
        </button>
      </div>
      <div
        ref={body}
        className="relative flex-1 min-h-0 m-2 mt-0"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        onPointerDown={(e) => {
          doubleTap(e)
        }}
      >
        {size && (
          <div style={frame}>
            <FieldBoard board={board} readOnly fit zoomable={false} />
          </div>
        )}
      </div>
      <p className="shrink-0 pb-2 text-center text-[0.7rem] text-white/40" style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}>
        Double-tap to close
      </p>
    </div>,
    document.body,
  )
}
