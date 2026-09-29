'use client'

import { useEffect, useLayoutEffect, useRef, type ClipboardEvent, type CSSProperties, type KeyboardEvent } from 'react'
import { richToHtml, sameRich, type Rich } from '@/lib/noteText'
import { caretToPoint, domToRich, getOffsets, setSelection } from './caret'

/** Where the editor wants the caret next. `n` makes asking twice for the same place count. */
export interface FocusRequest {
  id: string
  at: 'start' | 'end' | number
  /** With `at`, selects from `at` to here. */
  end?: number
  /** Arrowing between blocks: land at this x on the block's first or last line. */
  x?: number
  line?: 'first' | 'last'
  n: number
}

export interface TypedInfo {
  el: HTMLDivElement
  /** Where the caret is after the change. */
  caret: number | null
  inputType: string
  data: string | null
}

/**
 * One line of a note you can type on.
 *
 * A contentEditable the browser types into, which this reads back after every
 * change. It is filled from the block's words only when they change from
 * somewhere else — an undo, a merge, a markdown shortcut — never while the
 * words on screen are the ones just typed, which is what keeps the caret and
 * a phone's autocorrect where they are.
 */
export function RichText({
  id,
  value,
  focus,
  readOnly = false,
  placeholder,
  alwaysHint = false,
  className = '',
  style,
  label,
  onTyped,
  onKeyDown,
  onPaste,
  onFocus,
  onBlur,
  onEnter,
  onBackspace,
  onUndo,
}: {
  id: string
  value: Rich
  focus: FocusRequest | null
  readOnly?: boolean
  placeholder?: string
  /** Show the placeholder even when this line is not being typed on. */
  alwaysHint?: boolean
  className?: string
  style?: CSSProperties
  label?: string
  onTyped: (rich: Rich, info: TypedInfo) => void
  onKeyDown?: (e: KeyboardEvent<HTMLDivElement>) => void
  onPaste?: (e: ClipboardEvent<HTMLDivElement>) => void
  onFocus?: () => void
  onBlur?: () => void
  /** Return pressed on a keyboard that only says so through `beforeinput` (Android). */
  onEnter?: (el: HTMLDivElement) => void
  onBackspace?: (el: HTMLDivElement) => boolean
  onUndo?: (redo: boolean) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  // What is on screen now, as words — so an edit that came from here is not drawn back over itself.
  const shown = useRef<Rich | null>(null)
  const latest = useRef({ onEnter, onBackspace, onUndo })
  useEffect(() => {
    latest.current = { onEnter, onBackspace, onUndo }
  })

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    if (shown.current && sameRich(shown.current, value)) return
    el.innerHTML = richToHtml(value)
    shown.current = { text: value.text, marks: value.marks }
  }, [value])

  useLayoutEffect(() => {
    const el = ref.current
    if (!el || !focus || readOnly) return
    el.focus({ preventScroll: true })
    const len = (shown.current?.text ?? '').length
    let placed = false
    if (focus.x !== undefined && focus.line) placed = caretToPoint(el, focus.x, focus.line)
    if (!placed) {
      const at = focus.at === 'start' ? 0 : focus.at === 'end' ? len : Math.max(0, Math.min(focus.at, len))
      setSelection(el, at, focus.end !== undefined ? Math.min(focus.end, len) : at)
    }
    // Keep the line being typed on in view, above a phone's keyboard.
    const box = el.getBoundingClientRect()
    const vv = window.visualViewport
    const bottom = vv ? vv.offsetTop + vv.height : window.innerHeight
    if (box.bottom > bottom - 56 || box.top < 0) el.scrollIntoView({ block: 'nearest' })
  }, [focus, readOnly])

  /* Keyboards that do not send a keydown for Return or Backspace (Android's,
     mostly) still say what they are about to do here, and so does the
     undo on an iPhone's keyboard bar. */
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const before = (e: InputEvent) => {
      const { onEnter: enter, onBackspace: back, onUndo: undo } = latest.current
      if (e.inputType === 'insertParagraph' && enter) {
        e.preventDefault()
        enter(el)
      } else if (e.inputType === 'deleteContentBackward' && back) {
        const off = getOffsets(el)
        if (off && off.start === 0 && off.end === 0 && back(el)) e.preventDefault()
      } else if ((e.inputType === 'historyUndo' || e.inputType === 'historyRedo') && undo) {
        e.preventDefault()
        undo(e.inputType === 'historyRedo')
      }
    }
    el.addEventListener('beforeinput', before)
    return () => el.removeEventListener('beforeinput', before)
  }, [])

  return (
    <div
      ref={ref}
      data-rt={id}
      role="textbox"
      aria-multiline="true"
      aria-label={label ?? placeholder}
      contentEditable={!readOnly}
      suppressContentEditableWarning
      spellCheck
      data-empty={value.text === '' ? '' : undefined}
      data-always={alwaysHint ? '' : undefined}
      data-placeholder={placeholder}
      className={`ne-rt ${className}`}
      style={style}
      onInput={(e) => {
        const el = e.currentTarget
        const rich = domToRich(el)
        shown.current = rich
        const native = e.nativeEvent as InputEvent
        const off = getOffsets(el)
        onTyped(rich, { el, caret: off ? off.end : null, inputType: native.inputType ?? '', data: native.data ?? null })
      }}
      onKeyDown={onKeyDown}
      onPaste={onPaste}
      onDrop={(e) => {
        // A drop would bring its own HTML in with it; only the words come in.
        const words = e.dataTransfer.getData('text/plain')
        e.preventDefault()
        if (words && !readOnly) document.execCommand('insertText', false, words)
      }}
      onFocus={onFocus}
      onBlur={onBlur}
      onClick={(e) => {
        // Ctrl- or Cmd-click opens a link, as it does in any editor.
        const a = (e.target as HTMLElement).closest('a')
        if (a && (e.metaKey || e.ctrlKey || readOnly)) {
          e.preventDefault()
          window.open(a.href, '_blank', 'noopener,noreferrer')
        }
      }}
    />
  )
}
