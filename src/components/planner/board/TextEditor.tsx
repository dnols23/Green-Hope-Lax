'use client'
import { useEffect, useRef } from 'react'
import { fontStack, type BoardText } from '@/lib/planner'
import { LINE_HEIGHT, textBox } from './geometry'

/**
 * Typing straight onto the field.
 *
 * A text box laid exactly over the word, in its own size, face and colour, so
 * what is typed is where it will be. Enter starts a new line, as it does in any
 * text box; tapping away, Escape, or Ctrl/⌘+Enter finishes.
 */
export function TextEditor({
  text: t,
  anchor,
  k,
  onText,
  onDone,
}: {
  text: BoardText
  /** Where the word's own spot is, in pixels inside the box the field sits in. */
  anchor: { x: number; y: number }
  /** Pixels per yard. */
  k: number
  onText: (value: string) => void
  onDone: () => void
}) {
  const ref = useRef<HTMLTextAreaElement>(null)

  // In, with whatever is there picked so typing replaces it.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.focus({ preventScroll: true })
    el.select()
  }, [])

  const box = textBox(t)
  const font = Math.max(10, t.size * k)
  const padX = 6
  const lines = t.text.split('\n').length
  const width = Math.max(90, box.w * k + font + padX * 2)
  const align = t.align ?? 'middle'
  // The box grows from the word's anchor the way the word does.
  const left = align === 'start' ? anchor.x - padX : align === 'end' ? anchor.x - width + padX : anchor.x - width / 2

  return (
    <textarea
      ref={ref}
      value={t.text}
      onChange={(e) => onText(e.target.value)}
      onBlur={onDone}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === 'Escape' || (e.key === 'Enter' && (e.metaKey || e.ctrlKey))) {
          e.preventDefault()
          onDone()
        }
      }}
      onPointerDown={(e) => e.stopPropagation()}
      rows={lines}
      spellCheck={false}
      aria-label="Words on the field"
      placeholder="Type…"
      className="absolute z-20 resize-none overflow-hidden rounded-md outline-none"
      style={{
        left,
        top: anchor.y + (box.y - t.y) * k - 4,
        width,
        height: (lines - 1) * font * LINE_HEIGHT + font * 1.3 + 8,
        padding: `2px ${padX}px`,
        fontSize: font,
        lineHeight: LINE_HEIGHT,
        fontFamily: fontStack(t.font),
        fontWeight: t.bold ? 900 : 600,
        fontStyle: t.italic ? 'italic' : undefined,
        textDecoration: t.underline ? 'underline' : undefined,
        textAlign: align === 'start' ? 'left' : align === 'end' ? 'right' : 'center',
        color: t.color,
        background: t.bg ?? 'rgba(255,255,255,0.18)',
        border: '2px dashed #ffffff',
        boxShadow: '0 0 0 1px rgba(0,0,0,.35)',
      }}
    />
  )
}
