'use client'
import { memo } from 'react'
import { FieldBoard } from '@/components/planner/FieldBoard'
import { MAX_PLAY_STEPS, type Board, type PlayStep } from '@/lib/planner'

/**
 * A play as a run of steps, like slides down the side of a deck.
 *
 * The big board always shows the step that is picked; drawing on it changes
 * that step. "Add step" copies the picture on the board into a new step right
 * after it, so the next moment of the play starts from where this one ended —
 * move the players, draw the next lines, add the next step.
 */
export function ProgressionPanel({
  steps,
  active,
  onStart,
  onPick,
  onAdd,
  onMove,
  onCopy,
  onDelete,
  onNote,
  onEnd,
}: {
  steps: PlayStep[] | null
  active: number
  onStart: () => void
  onPick: (i: number) => void
  onAdd: () => void
  onMove: (i: number, to: number) => void
  onCopy: (i: number) => void
  onDelete: (i: number) => void
  onNote: (note: string) => void
  onEnd: () => void
}) {
  if (!steps) {
    return (
      <aside className="lg:w-60 shrink-0">
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-4 space-y-2">
          <h2 className="font-black text-sm">Play progression</h2>
          <p className="text-xs text-gray-500 leading-relaxed">
            Build the play step by step, like slides: the set, the pick, the slip, the shot. Each step goes in the
            playbook as its own page, in order.
          </p>
          <button type="button" onClick={onStart} className="btn btn-primary !py-1.5 text-sm w-full">
            ＋ Start a progression
          </button>
        </div>
      </aside>
    )
  }

  const full = steps.length >= MAX_PLAY_STEPS
  return (
    <aside className="lg:w-60 shrink-0 flex flex-col gap-2 min-h-0">
      <div className="flex items-center justify-between">
        <h2 className="font-black text-sm">
          Progression <span className="text-gray-400 font-bold">· {steps.length} step{steps.length === 1 ? '' : 's'}</span>
        </h2>
        <button type="button" onClick={onEnd} className="text-xs font-semibold text-gray-400 hover:text-gray-700" title="Keep the board as it is now, as one play">
          End
        </button>
      </div>

      {/* The filmstrip: down the side on a wide screen, across the bottom on a phone. */}
      <ol className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-x-visible lg:overflow-y-auto lg:max-h-[60vh] pb-1 lg:pb-0 lg:pr-1">
        {steps.map((s, i) => (
          <li key={i} className="shrink-0 w-36 lg:w-auto group">
            <div
              className="relative rounded-lg border-2 bg-white overflow-hidden transition"
              style={{ borderColor: i === active ? 'var(--gh-green)' : '#e5e7eb' }}
            >
              <button
                type="button"
                onClick={() => onPick(i)}
                aria-label={`Step ${i + 1}${s.note ? `: ${s.note}` : ''}`}
                aria-current={i === active ? 'step' : undefined}
                className="block w-full text-left"
              >
                <Thumb board={s.board} />
                <span
                  className="absolute left-1.5 top-1.5 min-w-5 h-5 px-1 rounded-full text-[0.7rem] font-black flex items-center justify-center"
                  style={{ background: i === active ? 'var(--gh-green)' : 'rgba(0,0,0,.55)', color: '#fff' }}
                >
                  {i + 1}
                </span>
                <span className="block px-2 py-1 text-xs truncate text-gray-600 min-h-6">{s.note || <span className="text-gray-300">No note</span>}</span>
              </button>
              {/* Step tools: always there on the picked step, on hover for the rest. */}
              <div
                className={`absolute right-1 top-1 flex gap-0.5 ${i === active ? '' : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100'}`}
              >
                <StepTool label="Move up" disabled={i === 0} onClick={() => onMove(i, i - 1)}>↑</StepTool>
                <StepTool label="Move down" disabled={i === steps.length - 1} onClick={() => onMove(i, i + 1)}>↓</StepTool>
                <StepTool label="Duplicate" disabled={full} onClick={() => onCopy(i)}>⧉</StepTool>
                <StepTool label="Delete step" disabled={steps.length === 1} onClick={() => onDelete(i)}>×</StepTool>
              </div>
            </div>
          </li>
        ))}
      </ol>

      <button type="button" onClick={onAdd} disabled={full} className="btn btn-ghost !py-1.5 text-sm w-full disabled:opacity-50">
        ＋ Add step {steps.length + 1}
      </button>
      <div>
        <label className="field-label">Step {active + 1}: what happens</label>
        <input
          value={steps[active]?.note ?? ''}
          onChange={(e) => onNote(e.target.value)}
          maxLength={140}
          placeholder="M sets the pick on A"
          className="field !py-1.5 text-sm"
        />
      </div>
      <p className="text-xs text-gray-400 leading-relaxed">
        Save keeps every step. Add to playbook puts each step in as its own page, in order.
      </p>
    </aside>
  )
}

function StepTool({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className="w-6 h-6 rounded-md bg-white/95 shadow text-xs font-black text-gray-600 hover:text-[var(--gh-green)] disabled:opacity-30"
    >
      {children}
    </button>
  )
}

/** A step's picture. Redrawn only when that step's board changes, not on every stroke elsewhere. */
const Thumb = memo(function Thumb({ board }: { board: Board }) {
  return (
    <div className="pointer-events-none">
      <FieldBoard board={board} readOnly zoomable={false} />
    </div>
  )
})
