'use client'

import { useRef, useState } from 'react'
import { SlideList } from '@/components/admin/SlideList'
import { DeleteButton } from '@/components/admin/DeleteButton'
import { deleteProgression, saveProgression } from '@/lib/progressionActions'
import { MAX_STEPS, PROGRESSION_POSITIONS, progressionMinutes, type Progression, type ProgressionStep } from '@/lib/progressions'
import { newId } from '@/lib/board'

export interface DrillOption {
  id: string
  name: string
  category: string
  minutes: number
  link: string | null
  favorite: boolean
}

type Row = ProgressionStep & { id: string }
type Draft = { name: string; position: string; notes: string; rows: Row[] }

/** One progression: its drills in order, slid into place, saved as it changes. */
export function ProgressionCard({
  progression: p,
  drills,
  categories,
  canWrite,
  startOpen,
}: {
  progression: Progression
  drills: DrillOption[]
  categories: { key: string; label: string }[]
  canWrite: boolean
  startOpen: boolean
}) {
  const [name, setName] = useState(p.name)
  const [position, setPosition] = useState(p.position)
  const [notes, setNotes] = useState(p.notes ?? '')
  const [rows, setRows] = useState<Row[]>(() => p.steps.map((s) => ({ ...s, id: newId('s') })))
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | string>('idle')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latest = useRef<Draft>({ name, position, notes, rows })

  function save(next: Partial<Draft>) {
    latest.current = { ...latest.current, ...next }
    if (next.name !== undefined) setName(next.name)
    if (next.position !== undefined) setPosition(next.position)
    if (next.notes !== undefined) setNotes(next.notes)
    if (next.rows !== undefined) setRows(next.rows)
    if (!canWrite) return
    if (timer.current) clearTimeout(timer.current)
    setStatus('saving')
    timer.current = setTimeout(async () => {
      const now = latest.current
      const r = await saveProgression({
        id: p.id,
        name: now.name,
        position: now.position,
        notes: now.notes,
        steps: now.rows.map(({ drillId, minutes, note }) => ({ drillId, minutes, note })),
      })
      setStatus(r.ok ? 'saved' : r.error ?? 'Not saved')
    }, 600)
  }

  const drill = (id: string) => drills.find((d) => d.id === id)
  const setRow = (id: string, part: Partial<Row>) => save({ rows: rows.map((r) => (r.id === id ? { ...r, ...part } : r)) })
  function addStep(drillId: string) {
    const d = drill(drillId)
    if (!d || rows.length >= MAX_STEPS) return
    save({ rows: [...rows, { id: newId('s'), drillId, minutes: d.minutes, note: '' }] })
  }

  const total = progressionMinutes({ steps: rows })
  const favorites = drills.filter((d) => d.favorite)

  return (
    <details open={startOpen || undefined} className="card p-4">
      <summary className="cursor-pointer list-none flex items-center gap-2">
        <span className="caret text-sm text-gray-400">▸</span>
        <span className="font-bold flex-1 min-w-0 truncate">{name || 'Untitled'}</span>
        <span className="text-xs text-gray-400 shrink-0">
          {rows.length} {rows.length === 1 ? 'drill' : 'drills'}
          {total ? ` · ${total} min` : ''}
        </span>
      </summary>

      <div className="mt-3 pt-3 border-t border-gray-100 space-y-3">
        <div className="grid sm:grid-cols-6 gap-2">
          <div className="sm:col-span-4">
            <label className="field-label">Name</label>
            <input value={name} disabled={!canWrite} onChange={(e) => save({ name: e.target.value })} maxLength={120} className="field !py-1.5" />
          </div>
          <div className="sm:col-span-2">
            <label className="field-label">Position</label>
            <select value={position} disabled={!canWrite} onChange={(e) => save({ position: e.target.value })} className="field !py-1.5">
              {PROGRESSION_POSITIONS.map((x) => (
                <option key={x.key} value={x.key}>{x.label}</option>
              ))}
            </select>
          </div>
        </div>

        {rows.length === 0 ? (
          <p className="text-sm text-gray-400">No drills yet — add the first one below.</p>
        ) : (
          <SlideList
            items={rows}
            locked={!canWrite}
            onReorder={(ids) => save({ rows: ids.map((id) => rows.find((r) => r.id === id)).filter((r): r is Row => !!r) })}
            label={(r) => drill(r.drillId)?.name ?? 'Drill'}
            className="space-y-1.5"
            renderItem={(r, grip, dragging) => {
              const d = drill(r.drillId)
              const n = rows.findIndex((x) => x.id === r.id) + 1
              return (
                <div
                  className={`rounded-lg border px-2.5 py-2 ${dragging ? 'shadow-lg' : ''}`}
                  style={{ background: 'var(--surface, #fff)', borderColor: 'var(--border)' }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-6 h-6 rounded-full grid place-items-center text-xs font-black text-white shrink-0"
                      style={{ background: 'var(--gh-green)' }}
                    >
                      {n}
                    </span>
                    <span className="font-semibold text-sm flex-1 min-w-0 truncate">{d?.name ?? 'Drill no longer in the bank'}</span>
                    {d?.link && (
                      <a href={d.link} target="_blank" rel="noopener noreferrer" className="text-xs font-bold shrink-0" style={{ color: 'var(--gh-green)' }}>
                        ▶
                      </a>
                    )}
                    <label className="flex items-center gap-1 text-xs text-gray-500 shrink-0">
                      <input
                        type="number"
                        min={0}
                        max={120}
                        inputMode="numeric"
                        value={r.minutes || ''}
                        disabled={!canWrite}
                        onChange={(e) => setRow(r.id, { minutes: Math.max(0, Math.min(120, Number(e.target.value) || 0)) })}
                        className="field !py-1 !px-1.5 w-14 text-center"
                        aria-label="Minutes"
                      />
                      min
                    </label>
                    {canWrite && (
                      <button
                        type="button"
                        onClick={() => save({ rows: rows.filter((x) => x.id !== r.id) })}
                        className="text-gray-300 hover:text-red-600 px-1 shrink-0"
                        aria-label="Remove"
                      >
                        ✕
                      </button>
                    )}
                    {grip && (
                      <span {...grip} className="px-1.5 py-1 text-lg leading-none select-none text-gray-400 shrink-0">
                        ☰
                      </span>
                    )}
                  </div>
                  <input
                    value={r.note}
                    disabled={!canWrite}
                    onChange={(e) => setRow(r.id, { note: e.target.value })}
                    maxLength={1000}
                    placeholder="Coaching point"
                    className="mt-1.5 w-full text-sm bg-transparent border-0 border-b border-dashed border-gray-200 focus:border-gray-400 outline-none px-1 py-0.5 ml-7"
                    style={{ width: 'calc(100% - 1.75rem)' }}
                  />
                </div>
              )
            }}
          />
        )}

        {canWrite && rows.length < MAX_STEPS && (
          <select
            value=""
            onChange={(e) => addStep(e.target.value)}
            className="field !py-1.5"
            aria-label="Add a drill"
          >
            <option value="">＋ Add a drill…</option>
            {favorites.length > 0 && (
              <optgroup label="⭐ Favorites">
                {favorites.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </optgroup>
            )}
            {categories.map((c) => {
              const list = drills.filter((d) => d.category === c.key)
              return list.length ? (
                <optgroup key={c.key} label={c.label}>
                  {list.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </optgroup>
              ) : null
            })}
          </select>
        )}

        <div>
          <label className="field-label">Notes</label>
          <textarea
            value={notes}
            disabled={!canWrite}
            onChange={(e) => save({ notes: e.target.value })}
            rows={2}
            className="field !py-1.5 text-sm"
            placeholder="Who it's for, what it builds toward"
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-gray-400" role="status">
            {status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved' : status === 'idle' ? '' : status}
          </span>
          {canWrite && <DeleteButton id={p.id} action={deleteProgression} label="Delete progression" />}
        </div>
      </div>
    </details>
  )
}
