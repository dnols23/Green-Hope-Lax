'use client'
import { PRIORITY_LEVELS, levelOf } from '@/lib/priorityLevels'

/**
 * The two pieces the priority lists are made of.
 *
 * The colour never carries the meaning on its own — the amber does not clear
 * the contrast a phone in the sun needs — so the level's name rides beside it
 * everywhere it appears.
 */

export function PriorityChip({ level }: { level: number }) {
  const l = levelOf(level)
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[0.65rem] font-black uppercase tracking-wider px-2 py-0.5 rounded-full"
      style={{ background: `${l.color}1a`, color: '#3f3f46' }}
    >
      <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ background: l.color }} />
      {l.label}
    </span>
  )
}

/** Slide it up as it starts costing goals. */
export function LevelSlider({
  value,
  onChange,
  compact = false,
}: {
  value: number
  onChange: (next: number) => void
  compact?: boolean
}) {
  const l = levelOf(value)
  return (
    <label className="inline-flex items-center gap-2">
      {!compact && (
        <span className="text-[0.65rem] font-black uppercase tracking-wider text-gray-400">How bad</span>
      )}
      <input
        type="range"
        min={1}
        max={PRIORITY_LEVELS.length}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label="How much it matters"
        className={compact ? 'w-24' : 'w-40'}
        style={{ accentColor: l.color }}
      />
      {!compact && (
        <span className="text-xs font-bold" style={{ color: '#3f3f46' }}>
          {l.label}
          <span className="font-normal text-gray-400"> — {l.blurb}</span>
        </span>
      )}
    </label>
  )
}
