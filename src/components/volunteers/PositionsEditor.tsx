'use client'

import type { Position } from '@/lib/gameVolunteerModel'

/**
 * A list of volunteer positions to edit: what the job is, how many people,
 * and a line on what it means. Used for the lists every game starts from and
 * for one game's own.
 */
export function PositionsEditor({
  value,
  onChange,
  taken,
}: {
  value: Position[]
  onChange: (next: Position[]) => void
  /** How many have signed up for each position (by name), to show beside it. */
  taken?: Record<string, number>
}) {
  const set = (i: number, patch: Partial<Position>) => onChange(value.map((p, j) => (j === i ? { ...p, ...patch } : p)))

  return (
    <div className="space-y-2">
      {value.length === 0 && <p className="text-sm text-gray-400">No positions — nobody is asked to help.</p>}
      {value.map((p, i) => {
        const n = taken?.[p.label.trim().toLowerCase()] ?? 0
        return (
          <div key={i} className="rounded-xl border border-gray-200 bg-white p-2.5">
            <div className="flex items-center gap-2">
              <input
                className="field !py-1.5 flex-1 min-w-0 font-semibold"
                value={p.label}
                maxLength={60}
                placeholder="Position — e.g. Scorebook"
                aria-label="Position"
                onChange={(e) => set(i, { label: e.target.value })}
              />
              <div className="flex items-center rounded-lg border border-gray-200 shrink-0" role="group" aria-label="People needed">
                <button
                  type="button"
                  className="w-8 h-8 text-lg leading-none text-gray-500 disabled:opacity-30"
                  disabled={p.needed <= 1}
                  onClick={() => set(i, { needed: Math.max(1, p.needed - 1) })}
                  aria-label="One fewer"
                >
                  −
                </button>
                <span className="w-6 text-center text-sm font-black tabular-nums" title="People needed">
                  {p.needed}
                </span>
                <button
                  type="button"
                  className="w-8 h-8 text-lg leading-none text-gray-500 disabled:opacity-30"
                  disabled={p.needed >= 50}
                  onClick={() => set(i, { needed: Math.min(50, p.needed + 1) })}
                  aria-label="One more"
                >
                  +
                </button>
              </div>
              <button
                type="button"
                onClick={() => onChange(value.filter((_, j) => j !== i))}
                className="w-8 h-8 shrink-0 rounded-full text-xl leading-none text-gray-400 hover:text-[var(--gh-maroon)] hover:bg-gray-100"
                aria-label={`Remove ${p.label || 'this position'}`}
              >
                &times;
              </button>
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <input
                className="field !py-1 text-sm flex-1 min-w-0"
                value={p.detail ?? ''}
                maxLength={200}
                placeholder="What it means (optional)"
                aria-label="What it means"
                onChange={(e) => set(i, { detail: e.target.value })}
              />
              {n > 0 && (
                <span className="shrink-0 text-xs font-bold" style={{ color: 'var(--gh-green)' }}>
                  {n} signed up
                </span>
              )}
            </div>
          </div>
        )
      })}
      <button
        type="button"
        onClick={() => onChange([...value, { label: '', needed: 1, detail: null }])}
        className="btn btn-ghost !py-1.5 text-sm"
      >
        + Add a position
      </button>
    </div>
  )
}
