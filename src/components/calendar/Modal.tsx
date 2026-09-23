'use client'

import { useEffect, useRef } from 'react'

/**
 * The frame every calendar pop-up sits in.
 *
 * Three shapes, one component, because the same thing wants a different frame
 * on a laptop and on a phone:
 *
 *   card    an event's details — a small card in the middle of a laptop
 *           screen, a sheet from the bottom on a phone, where the thumb is
 *   dialog  the event editor — a tall card on a laptop, the whole screen on a
 *           phone, since a form with a keyboard up has no room to spare
 *   drawer  setting availability — slides in from the right on a laptop so the
 *           week stays in view beside it, the whole screen on a phone
 *
 * Escape is handled by the calendar, which knows what is open on top of what.
 */
export function Modal({
  shape,
  label,
  onClose,
  children,
}: {
  shape: 'card' | 'dialog' | 'drawer'
  label: string
  onClose: () => void
  children: React.ReactNode
}) {
  const panel = useRef<HTMLDivElement>(null)

  // Keep the page behind from scrolling under a thumb, hand focus to the
  // pop-up (unless something inside already took it), and give it back to
  // whatever opened it on the way out.
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null
    const body = document.body
    const was = body.style.overflow
    body.style.overflow = 'hidden'
    const el = panel.current
    if (el && !el.contains(document.activeElement)) el.focus({ preventScroll: true })
    return () => {
      body.style.overflow = was
      if (before && document.contains(before)) before.focus({ preventScroll: true })
    }
  }, [])

  const frame =
    shape === 'drawer'
      ? 'fixed inset-0 sm:inset-y-0 sm:left-auto sm:right-0 sm:w-[440px] sm:border-l sm:border-gray-200 sm:shadow-2xl'
      : shape === 'dialog'
        ? 'fixed inset-0 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-[min(40rem,calc(100vw-2rem))] sm:max-h-[min(92dvh,56rem)] sm:rounded-2xl sm:shadow-2xl'
        : 'fixed inset-x-0 bottom-0 max-h-[85dvh] rounded-t-2xl shadow-2xl sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-[min(28rem,calc(100vw-2rem))] sm:max-h-[85dvh] sm:rounded-2xl'

  return (
    <div className="fixed inset-0 z-[70]" role="presentation">
      <div
        className={`absolute inset-0 ${shape === 'card' ? 'bg-black/25' : 'bg-black/35'}`}
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className={`${frame} flex flex-col min-h-0 bg-white overflow-hidden outline-none`}
        // The global focus ring is for keyboard users moving between controls;
        // on the frame itself, focused only so Tab starts inside, it is noise.
        style={{ paddingBottom: 'env(safe-area-inset-bottom)', outline: 'none' }}
      >
        {children}
      </div>
    </div>
  )
}
