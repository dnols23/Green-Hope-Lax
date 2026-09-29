'use client'
import { useState } from 'react'
import { BOARD_COLORS } from '@/lib/planner'
import { MenuLabel } from './Popover'

const RECENT = 'gh-board-recent-colors'

function loadRecent(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(RECENT) ?? '[]')
    return Array.isArray(raw) ? raw.filter((c) => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c)).slice(0, 7) : []
  } catch {
    return []
  }
}

/** Colours this browser picked by hand lately, beyond the palette — a coach's own few. */
function remember(c: string) {
  if (BOARD_COLORS.some((b) => b.key.toLowerCase() === c.toLowerCase())) return
  try {
    const next = [c, ...loadRecent().filter((x) => x.toLowerCase() !== c.toLowerCase())].slice(0, 7)
    localStorage.setItem(RECENT, JSON.stringify(next))
  } catch {
    // A blocked store just means no recent colours.
  }
}

/** A hex the colour input will take: it wants #rrggbb, nothing shorter. */
const six = (c: string | undefined) => {
  if (!c) return '#17222e'
  if (/^#[0-9a-f]{3}$/i.test(c)) return `#${c[1]}${c[1]}${c[2]}${c[2]}${c[3]}${c[3]}`
  return /^#[0-9a-f]{6}$/i.test(c) ? c : c.slice(0, 7)
}

/**
 * The palette: the program's colours and the ones a field needs, the ones
 * picked lately, and any other through the system picker. A fill can also be
 * none, and carries how see-through it is.
 */
export function ColorPicker({
  value,
  onChange,
  allowNone = false,
  opacity,
  onOpacity,
  title = 'Colour',
}: {
  value: string | undefined
  onChange: (c: string | undefined) => void
  allowNone?: boolean
  opacity?: number
  onOpacity?: (n: number) => void
  title?: string
}) {
  // Only ever mounted in a menu a coach opened, so the browser is there to ask.
  const [recent, setRecent] = useState<string[]>(loadRecent)
  const current = value?.toLowerCase()

  const swatch = (c: string, label: string) => (
    <button
      key={c}
      type="button"
      onClick={() => onChange(c)}
      title={label}
      aria-label={label}
      aria-pressed={current === c.toLowerCase()}
      className="w-9 h-9 rounded-full border-2 transition-transform hover:scale-110 justify-self-center"
      style={{
        background: c,
        borderColor: current === c.toLowerCase() ? '#17222e' : 'rgba(0,0,0,.14)',
        boxShadow: current === c.toLowerCase() ? '0 0 0 2px #fff inset' : undefined,
      }}
    />
  )

  return (
    <div>
      <MenuLabel>{title}</MenuLabel>
      <div className="grid grid-cols-7 gap-1.5">
        {allowNone && (
          <button
            type="button"
            onClick={() => onChange(undefined)}
            title="None"
            aria-label="None"
            aria-pressed={!value}
            className="w-9 h-9 rounded-full border-2 bg-white relative overflow-hidden justify-self-center"
            style={{ borderColor: !value ? '#17222e' : 'rgba(0,0,0,.14)' }}
          >
            <span className="absolute left-1/2 top-0 h-full w-0.5 -translate-x-1/2 rotate-45 bg-red-500" />
          </button>
        )}
        {BOARD_COLORS.map((c) => swatch(c.key, c.label))}
      </div>
      {recent.length > 0 && (
        <>
          <MenuLabel>Recent</MenuLabel>
          <div className="grid grid-cols-7 gap-1.5">{recent.map((c) => swatch(c, c))}</div>
        </>
      )}
      <label className="mt-2 flex items-center gap-2 min-h-9 px-1 text-xs font-bold text-gray-500 cursor-pointer">
        <input
          type="color"
          value={six(value)}
          onChange={(e) => onChange(e.target.value)}
          onBlur={(e) => {
            remember(e.target.value)
            setRecent(loadRecent())
          }}
          className="w-9 h-9 rounded border border-gray-200 bg-white p-0.5 cursor-pointer"
          aria-label="Any other colour"
        />
        Any other colour
      </label>
      {onOpacity && opacity !== undefined && (
        <label className="flex items-center gap-2 px-1 min-h-9 text-xs font-bold text-gray-500">
          <span className="w-16 shrink-0">See-through</span>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={Math.round((1 - opacity) * 100)}
            onChange={(e) => onOpacity(1 - Number(e.target.value) / 100)}
            className="flex-1 accent-[var(--gh-green)]"
            aria-label="How see-through"
          />
          <span className="w-9 text-right tabular-nums text-gray-400">{Math.round((1 - opacity) * 100)}%</span>
        </label>
      )}
    </div>
  )
}
