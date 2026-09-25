'use client'

import { useMemo, useState } from 'react'
import type { HubQuestion } from '@/lib/hubQuestions'

/** One question from the bank, as a field. */
export function QuestionField({
  q,
  value,
  onChange,
}: {
  q: HubQuestion
  value: string | string[] | undefined
  onChange: (v: string | string[]) => void
}) {
  const id = `q-${q.key}`
  const label = (
    <label htmlFor={id} className="field-label">
      {q.label}
      {q.required && <span className="text-[var(--gh-maroon)]"> *</span>}
    </label>
  )
  if (q.kind === 'multi') {
    const picked = Array.isArray(value) ? value : []
    return (
      <fieldset>
        <legend className="field-label">{q.label}</legend>
        <div className="flex flex-wrap gap-1.5">
          {q.options?.map((o) => {
            const on = picked.includes(o)
            return (
              <button
                key={o}
                type="button"
                aria-pressed={on}
                onClick={() => onChange(on ? picked.filter((x) => x !== o) : [...picked, o])}
                className={`min-h-9 px-3 rounded-full border text-sm font-semibold ${
                  on ? 'bg-[var(--gh-green)] text-white border-[var(--gh-green)]' : 'border-gray-300 text-gray-600'
                }`}
              >
                {on && '✓ '}
                {o}
              </button>
            )
          })}
        </div>
      </fieldset>
    )
  }
  if (q.kind === 'choice') {
    return (
      <div>
        {label}
        <select id={id} value={typeof value === 'string' ? value : ''} onChange={(e) => onChange(e.target.value)} className="field">
          <option value="">—</option>
          {q.options?.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      </div>
    )
  }
  return (
    <div>
      {label}
      {q.kind === 'long' ? (
        <textarea
          id={id}
          rows={3}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={q.placeholder}
          className="field"
        />
      ) : (
        <input
          id={id}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={q.placeholder}
          className="field"
        />
      )}
    </div>
  )
}

export interface RosterOption {
  id: string
  name: string
  number: string | null
  team: string
  taken: boolean
}

/** Search the roster and pick one or more names off it. */
export function RosterPicker({
  roster,
  picked,
  onPick,
  multi = false,
  blockTaken = false,
}: {
  roster: RosterOption[]
  picked: string[]
  onPick: (ids: string[]) => void
  multi?: boolean
  blockTaken?: boolean
}) {
  const [q, setQ] = useState('')
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase()
    return (s ? roster.filter((p) => p.name.toLowerCase().includes(s)) : roster).slice(0, 60)
  }, [q, roster])
  return (
    <div>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search your name"
        className="field mb-2"
        aria-label="Search the roster"
      />
      <div className="rounded-xl border border-gray-200 divide-y divide-gray-100 max-h-72 overflow-y-auto">
        {shown.length === 0 && <p className="px-3 py-3 text-sm text-gray-400">No one by that name.</p>}
        {shown.map((p) => {
          const on = picked.includes(p.id)
          const off = blockTaken && p.taken
          return (
            <button
              key={p.id}
              type="button"
              disabled={off}
              onClick={() => onPick(multi ? (on ? picked.filter((x) => x !== p.id) : [...picked, p.id]) : [p.id])}
              className={`w-full text-left px-3 min-h-11 flex items-center gap-2 ${on ? 'bg-[#e3f4ea]' : 'hover:bg-gray-50'} disabled:opacity-40`}
            >
              <span className="w-5 text-[var(--gh-green)] font-black">{on ? '✓' : ''}</span>
              <span className="font-semibold flex-1">
                {p.number ? `#${p.number} ` : ''}
                {p.name}
              </span>
              <span className="text-xs text-gray-400">{off ? 'Signed up' : p.team}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** "Step 2 of 5" and a bar. */
export function Steps({ at, of, title }: { at: number; of: number; title: string }) {
  return (
    <div className="mb-4">
      <div className="text-xs font-bold text-gray-400 uppercase tracking-wide">
        Step {at + 1} of {of}
      </div>
      <h2 className="text-xl font-black">{title}</h2>
      <div className="mt-2 h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <div className="h-full bg-[var(--gh-green)] transition-all" style={{ width: `${((at + 1) / of) * 100}%` }} />
      </div>
    </div>
  )
}
