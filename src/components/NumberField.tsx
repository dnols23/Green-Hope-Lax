'use client'

import { useState, type InputHTMLAttributes } from 'react'

/**
 * A number box you can actually clear.
 *
 * A plain `<input type="number" value={n}>` turns an empty box straight back
 * into 0, so on a phone "15" becomes "015" and the zero never goes away. This
 * keeps what's being typed as text, hands the number up as soon as it reads as
 * one, and tidies the box when you leave it. Focusing it selects what's there,
 * so a tap and a new number replaces the old one.
 */
type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'min' | 'max'> & {
  value: number
  onValue: (n: number) => void
  min?: number
  max?: number
  /** Whole numbers only. */
  integer?: boolean
}

export default function NumberField({ value, onValue, min, max, integer = false, onFocus, onBlur, ...rest }: Props) {
  const [draft, setDraft] = useState(String(value))
  // The last number this box sent up, or took from outside. When the value
  // changes to something else (a − / + button, "fit to time"), show that.
  const [known, setKnown] = useState(value)
  if (value !== known) {
    setKnown(value)
    setDraft(String(value))
  }

  const negative = min === undefined || min < 0
  const shape = new RegExp(`^${negative ? '-?' : ''}\\d*${integer ? '' : '(\\.\\d*)?'}$`)

  function clamp(n: number) {
    let v = n
    if (min !== undefined) v = Math.max(min, v)
    if (max !== undefined) v = Math.min(max, v)
    return v
  }

  return (
    <input
      {...rest}
      type="text"
      inputMode={integer && !negative ? 'numeric' : 'decimal'}
      value={draft}
      onFocus={(e) => {
        e.currentTarget.select()
        onFocus?.(e)
      }}
      onChange={(e) => {
        const text = e.target.value.trim()
        if (!shape.test(text)) return
        setDraft(text)
        if (text === '' || text === '-' || text === '.' || text === '-.') return
        const n = clamp(Number(text))
        if (Number.isNaN(n)) return
        setKnown(n)
        if (n !== value) onValue(n)
      }}
      onBlur={(e) => {
        setDraft(String(value))
        onBlur?.(e)
      }}
    />
  )
}
