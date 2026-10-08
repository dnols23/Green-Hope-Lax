'use client'
import { useEffect } from 'react'

/**
 * A small panel that opens off a button.
 *
 * Under the button on a laptop; on a phone it rises from the bottom of the
 * screen instead, where the thumb already is and where it can't hang off the
 * side of the glass. Escape, or a tap anywhere else, puts it away.
 *
 * The parent is the anchor: give it `relative`.
 */
export function Popover({
  open,
  onClose,
  label,
  align = 'left',
  children,
}: {
  open: boolean
  onClose: () => void
  /** What it is, for a screen reader. */
  label: string
  /** Which edge of the button it lines up with on a wide screen. */
  align?: 'left' | 'right'
  children: React.ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <>
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="fixed inset-0 z-40 cursor-default bg-black/25 sm:bg-transparent"
      />
      <div
        role="dialog"
        aria-label={label}
        className={`fixed inset-x-3 bottom-3 z-50 max-h-[75vh] overflow-y-auto rounded-2xl border border-gray-200 bg-white text-left shadow-2xl sm:absolute sm:inset-x-auto sm:bottom-auto sm:top-full sm:mt-1 sm:w-80 sm:max-h-[60vh] sm:rounded-xl ${
          align === 'right' ? 'sm:right-0' : 'sm:left-0'
        }`}
      >
        {children}
      </div>
    </>
  )
}
