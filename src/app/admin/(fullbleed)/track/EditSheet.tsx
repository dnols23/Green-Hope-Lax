'use client'
import { useState } from 'react'
import {
  MAX_PERIOD,
  PENALTY_MINUTES,
  SITUATIONS,
  SITUATION_LABELS,
  describeEvent,
  periodLabel,
  playerLabel,
  type StatEvent,
  type StatPlayer,
} from '@/lib/stats'
import { playerRole, resultChoices, sameStat, tidyEvent } from './pad'
import { FOCUS, minutesLabel } from './Pickers'
import { Sheet } from './Sheet'

/** A row of chips, one of which is on. */
function Chips<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: { value: T; label: string }[]
  value: T | null
  onChange: (v: T) => void
}) {
  return (
    <fieldset>
      <legend className="field-label">{label}</legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const on = o.value === value
          return (
            <button
              key={String(o.value)}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(o.value)}
              className={`min-h-11 min-w-11 px-3 rounded-lg text-sm font-bold border touch-manipulation ${FOCUS} ${
                on ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
              style={on ? undefined : { borderColor: 'var(--border)' }}
            >
              {o.label}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}

/** A player dropdown: the phone's own picker is the quickest way to change one name. */
function PlayerSelect({
  label,
  value,
  players,
  none,
  exclude,
  onChange,
}: {
  label: string
  value: string | null
  players: StatPlayer[]
  none: string
  exclude?: string | null
  onChange: (id: string | null) => void
}) {
  const active = players.filter((p) => p.is_active && p.id !== exclude)
  const inactive = players.filter((p) => !p.is_active && p.id !== exclude)
  const known = value == null || players.some((p) => p.id === value)
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      <select className="field h-12" value={value ?? ''} onChange={(e) => onChange(e.target.value || null)}>
        <option value="">{none}</option>
        {!known && value && <option value={value}>Player no longer on the roster</option>}
        {active.map((p) => (
          <option key={p.id} value={p.id}>
            {playerLabel(p)}
          </option>
        ))}
        {inactive.length > 0 && (
          <optgroup label="Not active">
            {inactive.map((p) => (
              <option key={p.id} value={p.id}>
                {playerLabel(p)}
              </option>
            ))}
          </optgroup>
        )}
      </select>
    </label>
  )
}

/**
 * Fixing a logged stat: the wrong number, the wrong result, the wrong quarter,
 * a man-up goal logged as even. What kind of stat it is (and whose) stays put;
 * a stat that was the wrong thing altogether is quicker to remove and re-tap.
 */
export function EditSheet({
  event,
  players,
  error,
  onSave,
  onRemove,
  onClose,
}: {
  event: StatEvent
  players: StatPlayer[]
  /** Why the last save didn't go through, if it didn't. */
  error: string | null
  onSave: (e: StatEvent) => void
  onRemove: () => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState<StatEvent>(event)
  const set = (patch: Partial<StatEvent>) => setDraft((d) => tidyEvent({ ...d, ...patch }))
  const map = new Map(players.map((p) => [p.id, p]))
  const role = playerRole(draft)
  const results = resultChoices(draft)
  const ourGoal = draft.kind === 'shot' && draft.side === 'us' && draft.result === 'goal'
  // Through the last period with anything in it, and one more overtime.
  const periods = Array.from({ length: Math.min(MAX_PERIOD, Math.max(5, draft.period + 1)) }, (_, i) => i + 1)
  const changed = !sameStat(draft, event)

  return (
    <Sheet onClose={onClose} title="Fix this stat">
      <p className="text-sm font-bold mb-4 rounded-lg px-3 py-2 bg-gray-100">{describeEvent(draft, map)}</p>
      <div className="space-y-4">
        {results.length > 0 && <Chips label="Result" options={results} value={draft.result} onChange={(v) => set({ result: v })} />}
        {role && (
          <PlayerSelect
            label={role}
            value={draft.player_id}
            players={players}
            none={draft.kind === 'shot' && draft.side === 'them' ? 'No one / not sure' : 'Not sure'}
            onChange={(id) => set({ player_id: id })}
          />
        )}
        {ourGoal && (
          <PlayerSelect
            label="Assist"
            value={draft.assist_id}
            players={players}
            none="Unassisted"
            exclude={draft.player_id}
            onChange={(id) => set({ assist_id: id })}
          />
        )}
        {draft.kind === 'penalty' && (
          <Chips
            label="Minutes"
            options={PENALTY_MINUTES.map((m) => ({ value: m as number, label: minutesLabel(m) }))}
            value={draft.penalty_minutes}
            onChange={(v) => set({ penalty_minutes: v })}
          />
        )}
        <Chips
          label="Period"
          options={periods.map((p) => ({ value: p, label: periodLabel(p) }))}
          value={draft.period}
          onChange={(v) => set({ period: v })}
        />
        <Chips
          label="Situation (ours)"
          options={SITUATIONS.map((s) => ({ value: s, label: SITUATION_LABELS[s] }))}
          value={draft.situation}
          onChange={(v) => set({ situation: v })}
        />
      </div>
      {error && <p className="mt-4 text-sm text-red-700">{error}</p>}
      <div className="mt-5 flex items-center gap-2">
        <button type="button" onClick={onRemove} className={`btn btn-ghost h-12 ${FOCUS}`} style={{ color: 'var(--gh-maroon)' }}>
          Remove
        </button>
        <span className="flex-1" />
        <button type="button" onClick={onClose} className={`btn btn-ghost h-12 ${FOCUS}`}>
          Cancel
        </button>
        <button type="button" onClick={() => onSave(draft)} disabled={!changed} className={`btn btn-primary h-12 px-6 disabled:opacity-40 ${FOCUS}`}>
          Save
        </button>
      </div>
    </Sheet>
  )
}
