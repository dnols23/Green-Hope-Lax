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
  newId,
  runningClock,
  tagFor,
  totalMinutes,
  type Board,
  type Plan,
  type PlanBlock,
} from '@/lib/planner'
import { DRILL_CATEGORIES, categoryFor, type Drill } from '@/lib/drills'
import { FieldBoard } from './FieldBoard'

const EMPTY: FormState = { ok: true }

export interface RosterOption {
  id: string
  name: string
}

export interface PlayerOption {
  id: string
  name: string
  number: string | null
}

const ROLES = ['Attack', 'Midfield', 'Defense', 'Goalie', 'LSM', 'FOGO', 'Line 1', 'Line 2', 'Blue', 'White']

/**
 * Writing a practice.
 *
 * Blocks are shut by default — a plan is a running order first and a set of
 * forms second, and on a phone twelve open forms is a scroll to nowhere. Tap one
 * to work on it. The whole plan lives here until Save, so reordering and
 * retiming are instant.
 */
export function PlanEditor({
  plan,
  rosters,
  playersByRoster,
  coaches,
  drills,
}: {
  plan: Plan
  rosters: RosterOption[]
  /** Every roster's players, so switching roster changes who you can pick without a reload. */
  playersByRoster: Record<string, PlayerOption[]>
  coaches: string[]
  drills: Drill[]
}) {
  const [state, save, saving] = useActionState(savePlan, EMPTY)
  const [title, setTitle] = useState(plan.title)
  const [date, setDate] = useState(plan.plan_date ?? '')
  const [start, setStart] = useState('16:00')
  const [summary, setSummary] = useState(plan.summary ?? '')
  const [rosterId, setRosterId] = useState(plan.roster_id ?? '')
  const [blocks, setBlocks] = useState<PlanBlock[]>(plan.blocks)
  const [toPlayers, setToPlayers] = useState(plan.publish_players)
  const [toCoaches, setToCoaches] = useState(plan.publish_coaches)
  const [openId, setOpenId] = useState<string | null>(null)
  const [fieldOpen, setFieldOpen] = useState<string | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)

  const clock = runningClock(blocks)
  const total = totalMinutes(blocks)
  const byTag = minutesByTag(blocks)
  const squad = playersByRoster[rosterId] ?? []

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

  /** Picking a drill fills the block in — name, length, category and its link. */
  function applyDrill(id: string, drillId: string) {
    const drill = drills.find((d) => d.id === drillId)
    if (!drill) {
      patch(id, { drillId: null, link: null })
      return
    }
    const block = blocks.find((b) => b.id === id)
    patch(id, {
      drillId: drill.id,
      link: drill.link,
      title: !block?.title ? drill.name : block.title,
      minutes: block?.minutes ? block.minutes : drill.minutes,
      tag: categoryFor(drill.category).tag,
      notes: block?.notes || drill.description || '',
    })
  }

  function addPlayer(id: string, playerId: string) {
    if (!playerId) return
    const block = blocks.find((b) => b.id === id)
    if (!block || (block.players ?? []).some((a) => a.playerId === playerId)) return
    patch(id, { players: [...(block.players ?? []), { playerId, role: '' }] })
  }

  const nameOf = (playerId: string) => {
    const p = squad.find((x) => x.id === playerId)
    return p ? `${p.number ? `#${p.number} ` : ''}${p.name}` : 'Player'
  }

  return (
    <form action={save}>
      <input type="hidden" name="id" value={plan.id} />
      <input type="hidden" name="blocks" value={JSON.stringify(blocks)} />
      <input type="hidden" name="season" value={plan.season ?? ''} />

      <div className="card p-4 mb-3">
        <input
          name="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="field !text-lg !font-black !py-2 mb-3"
          required
        />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div>
            <label className="field-label">Date</label>
            <input type="date" name="plan_date" value={date} onChange={(e) => setDate(e.target.value)} className="field !py-1.5" />
          </div>
          <div>
            <label className="field-label">Starts</label>
            <input type="time" value={start} onChange={(e) => setStart(e.target.value)} className="field !py-1.5" />
          </div>
          <div className="col-span-2">
            <label className="field-label">Roster</label>
            <select name="roster_id" value={rosterId} onChange={(e) => setRosterId(e.target.value)} className="field !py-1.5">
              <option value="">No roster</option>
              {rosters.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({(playersByRoster[r.id] ?? []).length})
                </option>
              ))}
            </select>
          </div>
          <div className="col-span-2 sm:col-span-4">
            <input
              name="summary"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              className="field !py-1.5 text-sm"
              placeholder="One line on the day — ride and clear, then 6v6 to finish"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-100 flex-wrap">
          <div className="text-xl font-black" style={{ color: 'var(--gh-green)' }}>{formatMinutes(total)}</div>
          <div className="text-xs text-gray-400">
            {blocks.length} {blocks.length === 1 ? 'block' : 'blocks'}
            {clockAt(start, total) ? ` · ends ${clockAt(start, total)}` : ''}
          </div>
          {byTag.length > 0 && (
            <div className="flex h-2 rounded-full overflow-hidden flex-1 min-w-[120px]">
              {byTag.map(({ tag, minutes }) => (
                <div key={tag.key} style={{ background: tag.color, width: `${(minutes / total) * 100}%` }} title={`${tag.label} — ${minutes}m`} />
              ))}
            </div>
          )}
          <button type="submit" disabled={saving} className="btn btn-primary !py-1.5 disabled:opacity-60">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>

        {/* Who this is for. A plan is the author's working document until it is
            sent somewhere. */}
        <div className="flex items-center gap-4 mt-2 pt-2 border-t border-gray-100 flex-wrap">
          <span className="text-xs font-bold tracking-wide uppercase text-gray-400">Publish to</span>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              name="publish_coaches"
              value="true"
              checked={toCoaches}
              onChange={(e) => setToCoaches(e.target.checked)}
              className="w-4 h-4 accent-[var(--gh-green)]"
            />
            Coaches&rsquo; War Room
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              name="publish_players"
              value="true"
              checked={toPlayers}
              onChange={(e) => setToPlayers(e.target.checked)}
              className="w-4 h-4 accent-[var(--gh-green)]"
            />
            Players&rsquo; Game Day
          </label>
          <span className="text-xs text-gray-400">
            {toPlayers ? 'Players see this plan on their page.' : 'Players can’t see this.'}
          </span>
        </div>
        {state.error && <p className="text-sm text-red-700 mt-2">{state.error}</p>}
        {state.ok && state.message && !saving && <p className="text-sm text-green-700 mt-2">{state.message}</p>}
      </div>

      <div className="space-y-1.5">
        {blocks.map((b, i) => {
          const tag = tagFor(b.tag)
          const at = clockAt(start, clock[i])
          const open = openId === b.id
          const showField = fieldOpen === b.id
          const assigned = b.players ?? []
          return (
            <div
              key={b.id}
              draggable={!open}
              onDragStart={() => setDragId(b.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => dropOn(b.id)}
              onDragEnd={() => setDragId(null)}
              className="card"
              style={{ borderLeft: `4px solid ${tag.color}`, opacity: dragId === b.id ? 0.4 : 1 }}
            >
              {/* The shut row: the running order, readable at a glance. */}
              <div
                className="flex items-center gap-2 p-2.5 cursor-pointer"
                onClick={() => setOpenId(open ? null : b.id)}
              >
                <span className="text-gray-300 select-none" title="Drag to reorder">☰</span>
                <span className="text-xs font-black tabular-nums w-16 shrink-0" style={{ color: tag.color }}>
                  {at ?? `+${clock[i]}m`}
                </span>
                <span className="flex-1 min-w-0 truncate text-sm font-semibold">
                  {b.title || <span className="text-gray-400 font-normal">Untitled block</span>}
                </span>
                {b.link && (
                  <a
                    href={b.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-xs font-bold shrink-0"
                    style={{ color: 'var(--gh-green)' }}
                  >
                    ↗
                  </a>
                )}
                {assigned.length > 0 && <span className="text-[0.7rem] text-gray-400 shrink-0">{assigned.length}p</span>}
                {b.board && <span className="text-[0.7rem] text-gray-400 shrink-0" title="Has a field diagram">▦</span>}
                <span className="text-xs tabular-nums text-gray-500 shrink-0">{b.minutes}m</span>
                <span className="text-gray-300 text-xs shrink-0">{open ? '▾' : '▸'}</span>
              </div>

              {open && (
                <div className="px-2.5 pb-2.5 space-y-2 border-t border-gray-100 pt-2.5">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="col-span-2 sm:col-span-4">
                      <label className="field-label">Drill</label>
                      <select
                        value={b.drillId ?? ''}
                        onChange={(e) => applyDrill(b.id, e.target.value)}
                        className="field !py-1.5"
                      >
                        <option value="">Not from the bank</option>
                        {DRILL_CATEGORIES.map((c) => {
                          const group = drills.filter((d) => d.category === c.key)
                          if (!group.length) return null
                          return (
                            <optgroup key={c.key} label={`${c.icon} ${c.label}`}>
                              {group.map((d) => (
                                <option key={d.id} value={d.id}>{d.name}</option>
                              ))}
                            </optgroup>
                          )
                        })}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="field-label">Title</label>
                      <input value={b.title} onChange={(e) => patch(b.id, { title: e.target.value })} className="field !py-1.5" />
                    </div>
                    <div>
                      <label className="field-label">Minutes</label>
                      <input
                        type="number"
                        min={0}
                        max={240}
                        value={b.minutes}
                        onChange={(e) => patch(b.id, { minutes: Number(e.target.value) })}
                        className="field !py-1.5 tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="field-label">Part of</label>
                      <select value={b.tag} onChange={(e) => patch(b.id, { tag: e.target.value })} className="field !py-1.5">
                        {BLOCK_TAGS.map((t) => (
                          <option key={t.key} value={t.key}>{t.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="field-label">Coach</label>
                      <select
                        value={b.coach ?? ''}
                        onChange={(e) => patch(b.id, { coach: e.target.value || null })}
                        className="field !py-1.5"
                      >
                        <option value="">Whole staff</option>
                        {coaches.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="field-label">Add a player</label>
                      <select
                        value=""
                        onChange={(e) => { addPlayer(b.id, e.target.value); e.target.value = '' }}
                        className="field !py-1.5"
                        disabled={squad.length === 0}
                      >
                        <option value="">{squad.length ? 'Pick a player…' : 'Choose a roster first'}</option>
                        {squad
                          .filter((p) => !assigned.some((a) => a.playerId === p.id))
                          .map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.number ? `#${p.number} ` : ''}{p.name}
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>

                  {assigned.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {assigned.map((a) => (
                        <span key={a.playerId} className="inline-flex items-center gap-1 rounded-full border border-gray-200 pl-2 pr-1 py-0.5">
                          <span className="text-xs font-semibold">{nameOf(a.playerId)}</span>
                          <input
                            list="gh-roles"
                            value={a.role}
                            onChange={(e) =>
                              patch(b.id, {
                                players: assigned.map((x) =>
                                  x.playerId === a.playerId ? { ...x, role: e.target.value } : x
                                ),
                              })
                            }
                            placeholder="role"
                            className="w-20 text-xs bg-transparent border-0 focus:outline-none text-gray-500"
                          />
                          <button
                            type="button"
                            onClick={() => patch(b.id, { players: assigned.filter((x) => x.playerId !== a.playerId) })}
                            className="text-gray-300 hover:text-red-600 px-1"
                            aria-label={`Take ${nameOf(a.playerId)} out of this block`}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  <textarea
                    value={b.notes}
                    onChange={(e) => patch(b.id, { notes: e.target.value })}
                    rows={2}
                    placeholder="Coaching points, groups, what good looks like…"
                    className="field !py-1.5 text-sm"
                  />

                  <div className="flex items-center gap-3 flex-wrap text-xs">
                    <button
                      type="button"
                      onDoubleClick={() => setFieldOpen(showField ? null : b.id)}
                      onClick={() => setFieldOpen(showField ? null : b.id)}
                      className="font-bold"
                      style={{ color: 'var(--gh-green)' }}
                    >
                      {showField ? '▾ Hide the field' : b.board ? '▸ Field diagram' : '▸ Draw it on the field'}
                    </button>
                    <span className="ml-auto flex items-center gap-1">
                      <button type="button" onClick={() => move(b.id, -1)} className="px-1.5 text-gray-400 hover:text-gray-700" aria-label="Move up">↑</button>
                      <button type="button" onClick={() => move(b.id, 1)} className="px-1.5 text-gray-400 hover:text-gray-700" aria-label="Move down">↓</button>
                      <button
                        type="button"
                        onClick={() => setBlocks((bs) => bs.filter((x) => x.id !== b.id))}
                        className="px-1.5 text-gray-400 hover:text-red-700 font-bold"
                      >
                        Remove
                      </button>
                    </span>
                  </div>

                  {showField && (
                    <FieldBoard
                      board={b.board ?? EMPTY_BOARD}
                      players={assigned.map((a) => {
                        const p = squad.find((x) => x.id === a.playerId)
                        return { id: a.playerId, name: p?.name ?? 'Player', number: p?.number ?? null }
                      })}
                      onChange={(next: Board) => patch(b.id, { board: next })}
                    />
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <datalist id="gh-roles">
        {ROLES.map((r) => (
          <option key={r} value={r} />
        ))}
      </datalist>

      <div className="flex flex-wrap gap-2 mt-3">
        <button
          type="button"
          onClick={() => {
            const block = emptyBlock()
            setBlocks((bs) => [...bs, block])
            setOpenId(block.id)
          }}
          className="btn btn-primary"
        >
          + Add a block
        </button>
        {blocks.length === 0 && (
          <button type="button" onClick={() => setBlocks(starter())} className="btn btn-ghost">
            Start from a standard practice
          </button>
        )}
      </div>
    </form>
  )
}

/** A shape most practices take, as a starting point rather than a rule. */
function starter(): PlanBlock[] {
  const make = (title: string, minutes: number, tag: string): PlanBlock => ({
    ...emptyBlock(),
    id: newId('b'),
    title,
    minutes,
    tag,
  })
  return [
    make('Dynamic warm-up', 10, 'warmup'),
    make('Stick work', 10, 'individual'),
    make('Ground balls', 10, 'individual'),
    make('Position breakout', 20, 'unit'),
    make('Water', 5, 'water'),
    make('Ride and clear', 15, 'team'),
    make('6v6', 20, 'team'),
    make('Man-up / man-down', 10, 'specials'),
    make('Conditioning and finish', 10, 'conditioning'),
  ]
}
