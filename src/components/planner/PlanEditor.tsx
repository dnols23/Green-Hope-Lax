'use client'
import { useActionState, useState } from 'react'
import { savePlan } from '@/lib/actions'
import type { FormState } from '@/lib/actions'
import {
  BLOCK_TAGS,
  EMPTY_BOARD,
  clockAt,
  emptyBlock,
  formatMinutes,
  minutesByTag,
  runningClock,
  tagFor,
  totalMinutes,
  type Board,
  type Plan,
  type PlanBlock,
} from '@/lib/planner'
import { FieldBoard, type BoardPlayer } from './FieldBoard'

const EMPTY: FormState = { ok: true }

export interface RosterOption {
  id: string
  name: string
}

/**
 * Writing a practice.
 *
 * The whole plan lives here until you save it: blocks reorder, minutes retotal
 * and the clock recalculates as you type, and one Save writes the lot. A coach
 * moving a drill up the session shouldn't be waiting on the network to see where
 * it landed.
 */
export function PlanEditor({
  plan,
  rosters,
  players,
}: {
  plan: Plan
  rosters: RosterOption[]
  players: BoardPlayer[]
}) {
  const [state, save, saving] = useActionState(savePlan, EMPTY)
  const [title, setTitle] = useState(plan.title)
  const [date, setDate] = useState(plan.plan_date ?? '')
  const [start, setStart] = useState('16:00')
  const [summary, setSummary] = useState(plan.summary ?? '')
  const [rosterId, setRosterId] = useState(plan.roster_id ?? '')
  const [blocks, setBlocks] = useState<PlanBlock[]>(plan.blocks)
  const [openBoard, setOpenBoard] = useState<string | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)

  const clock = runningClock(blocks)
  const total = totalMinutes(blocks)
  const byTag = minutesByTag(blocks)

  const patch = (id: string, next: Partial<PlanBlock>) =>
    setBlocks((bs) => bs.map((b) => (b.id === id ? { ...b, ...next } : b)))

  function move(id: string, by: number) {
    setBlocks((bs) => {
      const from = bs.findIndex((b) => b.id === id)
      const to = from + by
      if (from < 0 || to < 0 || to >= bs.length) return bs
      const next = [...bs]
      next.splice(to, 0, next.splice(from, 1)[0])
      return next
    })
  }

  function dropOn(targetId: string) {
    if (!dragId || dragId === targetId) return
    setBlocks((bs) => {
      const moved = bs.find((b) => b.id === dragId)
      if (!moved) return bs
      const rest = bs.filter((b) => b.id !== dragId)
      rest.splice(rest.findIndex((b) => b.id === targetId), 0, moved)
      return rest
    })
    setDragId(null)
  }

  return (
    <form action={save}>
      <input type="hidden" name="id" value={plan.id} />
      <input type="hidden" name="blocks" value={JSON.stringify(blocks)} />
      <input type="hidden" name="season" value={plan.season ?? ''} />

      <div className="card p-5 mb-4">
        <div className="grid sm:grid-cols-4 gap-3">
          <div className="sm:col-span-2">
            <label className="field-label">Title</label>
            <input name="title" value={title} onChange={(e) => setTitle(e.target.value)} className="field" required />
          </div>
          <div>
            <label className="field-label">Date</label>
            <input type="date" name="plan_date" value={date} onChange={(e) => setDate(e.target.value)} className="field" />
          </div>
          <div>
            <label className="field-label">Starts</label>
            <input type="time" value={start} onChange={(e) => setStart(e.target.value)} className="field" />
          </div>
          <div className="sm:col-span-2">
            <label className="field-label">Roster</label>
            <select name="roster_id" value={rosterId} onChange={(e) => setRosterId(e.target.value)} className="field">
              <option value="">No roster</option>
              {rosters.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="field-label">One line on the day</label>
            <input name="summary" value={summary} onChange={(e) => setSummary(e.target.value)} className="field" placeholder="Ride and clear, then 6v6 to finish" />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-4 pt-4 border-t border-gray-100">
          <div>
            <div className="text-2xl font-black" style={{ color: 'var(--gh-green)' }}>{formatMinutes(total)}</div>
            <div className="text-xs text-gray-400">
              {blocks.length} {blocks.length === 1 ? 'block' : 'blocks'}
              {clockAt(start, total) ? ` · ends ${clockAt(start, total)}` : ''}
            </div>
          </div>
          {byTag.length > 0 && (
            <div className="flex-1 min-w-[220px]">
              <div className="flex h-2.5 rounded-full overflow-hidden">
                {byTag.map(({ tag, minutes }) => (
                  <div key={tag.key} style={{ background: tag.color, width: `${(minutes / total) * 100}%` }} title={`${tag.label} — ${minutes}m`} />
                ))}
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5">
                {byTag.map(({ tag, minutes }) => (
                  <span key={tag.key} className="text-[0.7rem] text-gray-500">
                    <span className="inline-block w-2 h-2 rounded-full mr-1 align-middle" style={{ background: tag.color }} />
                    {tag.label} {minutes}m
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className="ml-auto flex items-center gap-2">
            {state.error && <span className="text-sm text-red-700">{state.error}</span>}
            {state.ok && state.message && !saving && <span className="text-sm text-green-700">{state.message}</span>}
            <button type="submit" disabled={saving} className="btn btn-primary disabled:opacity-60">
              {saving ? 'Saving…' : 'Save plan'}
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {blocks.map((b, i) => {
          const tag = tagFor(b.tag)
          const at = clockAt(start, clock[i])
          const boardOpen = openBoard === b.id
          return (
            <div
              key={b.id}
              draggable
              onDragStart={() => setDragId(b.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => dropOn(b.id)}
              onDragEnd={() => setDragId(null)}
              className="card p-3"
              style={{ borderLeft: `4px solid ${tag.color}`, opacity: dragId === b.id ? 0.4 : 1 }}
            >
              <div className="flex items-start gap-2">
                <span className="cursor-grab select-none text-gray-300 pt-2" title="Drag to reorder">☰</span>

                <div className="w-16 shrink-0 pt-1.5 text-center">
                  <div className="text-sm font-black tabular-nums" style={{ color: tag.color }}>
                    {at ?? `+${clock[i]}m`}
                  </div>
                  <div className="text-[0.65rem] text-gray-400">{at ? `+${clock[i]}m` : 'from start'}</div>
                </div>

                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex gap-2 flex-wrap">
                    <input
                      value={b.title}
                      onChange={(e) => patch(b.id, { title: e.target.value })}
                      placeholder="Ground balls — 1v1 from the whistle"
                      className="field flex-1 min-w-[180px] !py-1.5 font-semibold"
                    />
                    <select
                      value={b.tag}
                      onChange={(e) => patch(b.id, { tag: e.target.value })}
                      className="field !py-1.5 w-auto"
                    >
                      {BLOCK_TAGS.map((t) => (
                        <option key={t.key} value={t.key}>{t.label}</option>
                      ))}
                    </select>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min={0}
                        max={240}
                        value={b.minutes}
                        onChange={(e) => patch(b.id, { minutes: Number(e.target.value) })}
                        className="field !py-1.5 w-20 text-center tabular-nums"
                      />
                      <span className="text-xs text-gray-400">min</span>
                    </div>
                  </div>

                  <textarea
                    value={b.notes}
                    onChange={(e) => patch(b.id, { notes: e.target.value })}
                    rows={boardOpen ? 3 : 2}
                    placeholder="Coaching points, groups, what good looks like…"
                    className="field !py-2 text-sm"
                  />

                  <div className="flex items-center gap-3 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setOpenBoard(boardOpen ? null : b.id)}
                      className="text-xs font-bold"
                      style={{ color: 'var(--gh-green)' }}
                    >
                      {boardOpen ? '▾ Hide the field' : b.board ? '▸ Field diagram' : '▸ Draw it on the field'}
                    </button>
                    {b.board && !boardOpen && (
                      <span className="text-[0.7rem] text-gray-400">
                        {b.board.tokens.length} on the field · {b.board.paths.length} lines
                      </span>
                    )}
                    <span className="ml-auto flex items-center gap-1">
                      <button type="button" onClick={() => move(b.id, -1)} className="px-1.5 text-gray-400 hover:text-gray-700" aria-label="Move up">↑</button>
                      <button type="button" onClick={() => move(b.id, 1)} className="px-1.5 text-gray-400 hover:text-gray-700" aria-label="Move down">↓</button>
                      <button
                        type="button"
                        onClick={() => setBlocks((bs) => bs.filter((x) => x.id !== b.id))}
                        className="px-1.5 text-gray-400 hover:text-red-700 text-xs font-bold"
                      >
                        Remove
                      </button>
                    </span>
                  </div>

                  {boardOpen && (
                    <div className="pt-2">
                      <FieldBoard
                        board={b.board ?? EMPTY_BOARD}
                        players={players}
                        onChange={(next: Board) => patch(b.id, { board: next })}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex flex-wrap gap-2 mt-3">
        <button
          type="button"
          onClick={() => setBlocks((bs) => [...bs, emptyBlock()])}
          className="btn btn-ghost"
        >
          + Add a block
        </button>
        {blocks.length === 0 && (
          <button
            type="button"
            onClick={() => setBlocks(STARTER)}
            className="btn btn-ghost"
          >
            Start from a standard practice
          </button>
        )}
      </div>
    </form>
  )
}

/** A shape most practices take, as a starting point rather than a rule. */
const STARTER: PlanBlock[] = [
  { ...emptyBlock(), title: 'Dynamic warm-up', minutes: 10, tag: 'warmup' },
  { ...emptyBlock(), title: 'Stick work — partner passing', minutes: 10, tag: 'individual' },
  { ...emptyBlock(), title: 'Ground balls', minutes: 10, tag: 'individual' },
  { ...emptyBlock(), title: 'Position breakout', minutes: 20, tag: 'unit' },
  { ...emptyBlock(), title: 'Water', minutes: 5, tag: 'water' },
  { ...emptyBlock(), title: 'Ride and clear', minutes: 15, tag: 'team' },
  { ...emptyBlock(), title: '6v6', minutes: 20, tag: 'team' },
  { ...emptyBlock(), title: 'Man-up / man-down', minutes: 10, tag: 'specials' },
  { ...emptyBlock(), title: 'Conditioning and finish', minutes: 10, tag: 'conditioning' },
]
