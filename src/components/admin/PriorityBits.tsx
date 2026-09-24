'use client'
import { useState, useTransition } from 'react'
import { PRIORITY_LEVELS, levelOf } from '@/lib/priorityLevels'
import { setPriorityAction } from '@/lib/actions'

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
      style={{ background: `${l.color}1a`, color: 'var(--color-gray-700)' }}
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
        <span className="text-xs font-bold" style={{ color: 'var(--color-gray-700)' }}>
          {l.label}
          <span className="font-normal text-gray-400"> — {l.blurb}</span>
        </span>
      )}
    </label>
  )
}

/**
 * Fixing an item after it went down: the words, how bad it is, and which list
 * it belongs on. Sideline notes get typed fast — this is for tidying them up.
 */
export function PriorityEditForm({
  item,
  lists,
  onDone,
}: {
  item: { id: string; body: string; level: number; listId: string }
  /** The lists it could move to — this team's. */
  lists: { id: string; name: string }[]
  onDone: () => void
}) {
  const [body, setBody] = useState(item.body)
  const [level, setLevel] = useState(item.level)
  const [listId, setListId] = useState(item.listId)
  const [saving, start] = useTransition()

  function save() {
    const text = body.trim()
    if (!text) return
    const data = new FormData()
    data.set('id', item.id)
    data.set('body', text)
    data.set('level', String(level))
    if (listId !== item.listId) data.set('listId', listId)
    start(async () => {
      await setPriorityAction(data)
      onDone()
    })
  }

  return (
    <form
      className="space-y-2 w-full"
      onSubmit={(e) => {
        e.preventDefault()
        save()
      }}
    >
      <input
        autoFocus
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onDone()
        }}
        maxLength={300}
        aria-label="What needs work"
        className="field !py-1.5 text-sm"
      />
      <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label="How much it matters">
        {PRIORITY_LEVELS.map((l) => (
          <button
            key={l.level}
            type="button"
            role="radio"
            aria-checked={level === l.level}
            onClick={() => setLevel(l.level)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border"
            style={{
              borderColor: level === l.level ? l.color : 'var(--border)',
              background: level === l.level ? `${l.color}22` : 'transparent',
              color: 'var(--color-gray-700)',
            }}
          >
            <span className="inline-block w-2 h-2 rounded-full" style={{ background: l.color }} />
            {l.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {lists.length > 1 && (
          <select
            value={listId}
            onChange={(e) => setListId(e.target.value)}
            aria-label="Which list"
            className="field !py-1.5 !w-auto text-sm"
          >
            {lists.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        )}
        <span className="flex-1" />
        <button type="button" onClick={onDone} className="btn btn-ghost !py-1.5 text-sm">Cancel</button>
        <button type="submit" disabled={saving || !body.trim()} className="btn btn-primary !py-1.5 text-sm disabled:opacity-50">
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  )
}
