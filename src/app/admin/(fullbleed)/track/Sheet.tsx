'use client'
import { useEffect, useRef } from 'react'

/**
 * The frame every tracker pop-up sits in: a sheet up from the bottom on a
 * phone, where the thumb already is, and a card in the middle of a laptop.
 *
 * Escape and a tap anywhere outside close it, so backing out of a wrong tap is
 * never more than one more tap. Focus goes in on open and back to whatever
 * opened it on the way out.
 */
export function Sheet({
  title,
  onClose,
  children,
  back,
}: {
  title: React.ReactNode
  onClose: () => void
  children: React.ReactNode
  /** A step back, shown as ← beside the title. */
  back?: () => void
}) {
  const panel = useRef<HTMLDivElement>(null)
  const openedAt = useRef(Infinity)

  useEffect(() => {
    openedAt.current = performance.now()
    const before = document.activeElement as HTMLElement | null
    panel.current?.focus({ preventScroll: true })
    return () => {
      if (before && document.contains(before)) before.focus({ preventScroll: true })
    }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[70]" role="presentation">
      <div
        className="absolute inset-0 bg-black/40"
        // The second half of a double tap on the button that opened the sheet
        // lands out here; that isn't the coach asking to cancel.
        onClick={() => {
          if (performance.now() - openedAt.current > 350) onClose()
        }}
        aria-hidden
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="track-sheet-title"
        tabIndex={-1}
        className="fixed inset-x-0 bottom-0 max-h-[88dvh] rounded-t-2xl shadow-2xl sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-[min(36rem,calc(100vw-2rem))] sm:max-h-[85dvh] sm:rounded-2xl flex flex-col min-h-0 bg-white overflow-hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)', outline: 'none' }}
      >
        <div className="flex items-center gap-1 px-2 pt-2 pb-1 flex-none">
          {back ? (
            <button
              type="button"
              onClick={back}
              className="w-11 h-11 inline-flex items-center justify-center rounded-full text-xl text-gray-500 hover:bg-gray-100"
              aria-label="Back a step"
            >
              ←
            </button>
          ) : (
            <span className="w-2" aria-hidden />
          )}
          <h2 id="track-sheet-title" className="flex-1 min-w-0 text-base font-black leading-tight">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-11 h-11 inline-flex items-center justify-center rounded-full text-2xl leading-none text-gray-500 hover:bg-gray-100"
            aria-label="Cancel"
          >
            ×
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 pb-3">{children}</div>
      </div>
    </div>
  )
}
