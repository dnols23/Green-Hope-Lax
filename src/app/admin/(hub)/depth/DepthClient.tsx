'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { SlideList } from '@/components/admin/SlideList'
import { DEPTH_POSITIONS, fillFromRoster, tierLabel, type DepthChart, type DepthPosition } from '@/lib/depthChart'
import {
  depthAddPlayer,
  depthCreateRoster,
  depthRemoveFromRoster,
  depthSavePlayer,
  saveDepthChart,
  type DepthPlayer,
} from '@/lib/depthActions'
import type { Team } from '@/lib/teams'

const NEW_ROSTER = '__new__'

export function DepthClient({
  team,
  title,
  initial,
  rosters,
  players: initialPlayers,
  canWrite,
  canEditRoster,
}: {
  team: Team
  title: string
  initial: DepthChart
  rosters: { id: string; name: string; count: number }[]
  players: DepthPlayer[]
  canWrite: boolean
  canEditRoster: boolean
}) {
  const router = useRouter()
  const [chart, setChart] = useState(initial)
  const [players, setPlayers] = useState(initialPlayers)
  const [msg, setMsg] = useState('')
  const [saving, start] = useTransition()
  const [makingRoster, setMakingRoster] = useState(false)
  const [rosterName, setRosterName] = useState('')

  const byId = new Map(players.map((p) => [p.id, p]))
  const placedIds = new Set(Object.values(chart.slots).flat().filter((id) => byId.has(id)))
  const unplaced = players.filter((p) => !placedIds.has(p.id))

  function update(next: DepthChart, after?: () => void) {
    setChart(next)
    start(async () => {
      const r = await saveDepthChart(team, next)
      setMsg(r.ok ? 'Saved' : r.error)
      if (r.ok) after?.()
    })
  }
  const setSlot = (key: string, ids: string[]) => update({ ...chart, slots: { ...chart.slots, [key]: ids } })

  function pickRoster(id: string) {
    if (id === NEW_ROSTER) {
      setMakingRoster(true)
      return
    }
    update({ ...chart, rosterId: id || null }, () => router.refresh())
  }

  function makeRoster() {
    start(async () => {
      const r = await depthCreateRoster(team, rosterName, chart)
      if (!r.ok) {
        setMsg(r.error)
        return
      }
      setMakingRoster(false)
      setRosterName('')
      router.refresh()
    })
  }

  function pullIn() {
    const { chart: next, placed } = fillFromRoster(chart, players)
    if (!placed) {
      setMsg(unplaced.length ? 'Nobody left with a position the chart knows — place them below.' : 'Everyone is already on the chart.')
      return
    }
    update(next)
    setMsg(`Placed ${placed} ${placed === 1 ? 'player' : 'players'}.`)
  }

  return (
    <div className="max-w-5xl space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-xl font-black flex-1">{title}</h1>
        <span className="text-xs text-gray-400" role="status">
          {saving ? 'Saving…' : msg}
        </span>
      </div>

      <div className="card p-4 flex items-end gap-3 flex-wrap">
        <div className="min-w-[14rem] flex-1">
          <label className="field-label" htmlFor="depth-roster">Roster</label>
          <select
            id="depth-roster"
            value={chart.rosterId ?? ''}
            onChange={(e) => pickRoster(e.target.value)}
            disabled={!canWrite}
            className="field !py-1.5"
          >
            <option value="">Pick a roster…</option>
            {rosters.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} ({r.count})
              </option>
            ))}
            {canEditRoster && <option value={NEW_ROSTER}>＋ New roster…</option>}
          </select>
        </div>
        {canWrite && chart.rosterId && (
          <button type="button" onClick={pullIn} className="btn btn-ghost !py-1.5">
            Pull in roster
          </button>
        )}
        {makingRoster && (
          <div className="w-full flex items-center gap-2 flex-wrap">
            <input
              value={rosterName}
              onChange={(e) => setRosterName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') makeRoster()
              }}
              placeholder={team === 'jv' ? 'JV 2027' : 'Varsity 2027'}
              aria-label="New roster name"
              className="field !py-1.5 flex-1 min-w-[12rem]"
              autoFocus
            />
            <button type="button" onClick={makeRoster} disabled={saving} className="btn btn-primary !py-1.5">
              Make roster
            </button>
            <button type="button" onClick={() => setMakingRoster(false)} className="btn btn-ghost !py-1.5">
              Cancel
            </button>
          </div>
        )}
      </div>

      {!chart.rosterId ? (
        <p className="card p-6 text-sm text-gray-500">Pick the roster this depth chart is built from.</p>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 items-start">
            {DEPTH_POSITIONS.map((pos) => (
              <PositionCard
                key={pos.key}
                pos={pos}
                ids={(chart.slots[pos.key] ?? []).filter((id) => byId.has(id))}
                players={players}
                byId={byId}
                placedIds={placedIds}
                canWrite={canWrite}
                onChange={(ids) => setSlot(pos.key, ids)}
              />
            ))}
            {unplaced.length > 0 && (
              <section className="card p-4">
                <h2 className="font-black mb-2">
                  Not on the chart <span className="text-xs font-normal text-gray-400">{unplaced.length}</span>
                </h2>
                <ul className="space-y-1.5">
                  {unplaced.map((p) => (
                    <li key={p.id} className="flex items-center gap-2 text-sm">
                      <PlayerName p={p} />
                      {p.position && <span className="text-xs text-gray-400">{p.position}</span>}
                      {canWrite && (
                        <select
                          value=""
                          onChange={(e) => {
                            const key = e.target.value
                            if (key) setSlot(key, [...(chart.slots[key] ?? []), p.id])
                          }}
                          aria-label={`Place ${p.name}`}
                          className="field !py-1 !w-auto ml-auto text-xs"
                        >
                          <option value="">Place at…</option>
                          {DEPTH_POSITIONS.map((d) => (
                            <option key={d.key} value={d.key}>{d.label}</option>
                          ))}
                        </select>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          {canEditRoster && (
            <RosterPanel
              team={team}
              rosterId={chart.rosterId}
              players={players}
              onAdded={(p) => setPlayers((list) => [...list, p])}
              onSaved={(p) => setPlayers((list) => list.map((x) => (x.id === p.id ? p : x)))}
              onRemoved={(id) => setPlayers((list) => list.filter((x) => x.id !== id))}
              setMsg={setMsg}
            />
          )}
        </>
      )}
    </div>
  )
}

function PlayerName({ p }: { p: DepthPlayer }) {
  return (
    <span className="min-w-0 truncate">
      {p.number && <span className="font-black tabular-nums text-[var(--gh-green)] mr-1.5">#{p.number}</span>}
      <span className="font-semibold">{p.name}</span>
      {p.class_year && <span className="text-xs text-gray-400 ml-1.5">{p.class_year}</span>}
    </span>
  )
}

function PositionCard({
  pos,
  ids,
  players,
  byId,
  placedIds,
  canWrite,
  onChange,
}: {
  pos: DepthPosition
  ids: string[]
  players: DepthPlayer[]
  byId: Map<string, DepthPlayer>
  placedIds: Set<string>
  canWrite: boolean
  onChange: (ids: string[]) => void
}) {
  const others = players.filter((p) => !ids.includes(p.id))
  const fresh = others.filter((p) => !placedIds.has(p.id))
  const elsewhere = others.filter((p) => placedIds.has(p.id))
  return (
    <section className="card p-4" data-position={pos.key}>
      <h2 className="font-black mb-2">
        {pos.label} <span className="text-xs font-normal text-gray-400">{ids.length}</span>
      </h2>
      {ids.length === 0 ? (
        <p className="text-sm text-gray-400 mb-2">Nobody yet.</p>
      ) : (
        <SlideList
          items={ids.map((id) => ({ id }))}
          locked={!canWrite}
          onReorder={onChange}
          label={(x) => byId.get(x.id)?.name ?? 'player'}
          className="space-y-1 mb-2"
          renderItem={(x, grip, dragging) => {
            const i = ids.indexOf(x.id)
            const p = byId.get(x.id)!
            const tier = tierLabel(pos, i)
            const starter = i < pos.starters
            return (
              <div>
                {tier && (
                  <div className="text-[0.65rem] font-black uppercase tracking-wide text-gray-400 mt-2 mb-1 first:mt-0">{tier}</div>
                )}
                <div
                  className={`flex items-center gap-2 rounded-lg border px-2 min-h-10 text-sm ${dragging ? 'shadow-lg' : ''}`}
                  style={{
                    background: starter ? 'var(--gh-green-50, #ecf6f0)' : 'var(--surface, #fff)',
                    borderColor: 'var(--border)',
                  }}
                >
                  {grip && (
                    <span {...grip} className="px-1 py-2 text-gray-300 hover:text-gray-500 select-none leading-none">☰</span>
                  )}
                  <span className="w-5 text-xs font-black text-gray-400 tabular-nums">{i + 1}</span>
                  <PlayerName p={p} />
                  {canWrite && (
                    <button
                      type="button"
                      onClick={() => onChange(ids.filter((id) => id !== x.id))}
                      aria-label={`Take ${p.name} off ${pos.label}`}
                      className="ml-auto px-2 text-gray-300 hover:text-red-700"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
            )
          }}
        />
      )}
      {canWrite && others.length > 0 && (
        <select
          value=""
          onChange={(e) => e.target.value && onChange([...ids, e.target.value])}
          aria-label={`Add to ${pos.label}`}
          className="field !py-1.5 text-sm"
        >
          <option value="">＋ Add to {pos.label}</option>
          {fresh.length > 0 && (
            <optgroup label="Not on the chart">
              {fresh.map((p) => (
                <option key={p.id} value={p.id}>{p.number ? `#${p.number} ` : ''}{p.name}{p.position ? ` · ${p.position}` : ''}</option>
              ))}
            </optgroup>
          )}
          {elsewhere.length > 0 && (
            <optgroup label="Already at another spot">
              {elsewhere.map((p) => (
                <option key={p.id} value={p.id}>{p.number ? `#${p.number} ` : ''}{p.name}{p.position ? ` · ${p.position}` : ''}</option>
              ))}
            </optgroup>
          )}
        </select>
      )}
    </section>
  )
}

/** The roster behind the chart: add a player, or fix a number or a position, without leaving. */
function RosterPanel({
  team,
  rosterId,
  players,
  onAdded,
  onSaved,
  onRemoved,
  setMsg,
}: {
  team: Team
  rosterId: string
  players: DepthPlayer[]
  onAdded: (p: DepthPlayer) => void
  onSaved: (p: DepthPlayer) => void
  onRemoved: (id: string) => void
  setMsg: (m: string) => void
}) {
  const blank = { name: '', number: '', position: '', class_year: '' }
  const [draft, setDraft] = useState(blank)
  const [busy, start] = useTransition()

  function add() {
    start(async () => {
      const r = await depthAddPlayer(team, rosterId, draft)
      if (!r.ok) {
        setMsg(r.error)
        return
      }
      onAdded(r.player)
      setDraft(blank)
      setMsg(`Added ${r.player.name}.`)
    })
  }

  return (
    <details className="card p-4">
      <summary className="cursor-pointer list-none font-bold text-gray-700 flex items-center gap-2">
        <span className="caret text-sm">▸</span> Edit the roster
        <span className="font-normal text-xs text-gray-400">{players.length}</span>
        <Link href={`/admin/rosters/${rosterId}`} className="ml-auto text-xs font-bold text-[var(--gh-green)]">
          Roster page →
        </Link>
      </summary>
      <div className="mt-3 pt-3 border-t border-gray-100 space-y-1.5">
        <div className="hidden sm:grid grid-cols-[4rem_1fr_7rem_5rem_2rem] gap-2 text-[0.65rem] font-black uppercase tracking-wide text-gray-400">
          <span>#</span><span>Name</span><span>Position</span><span>Grad</span><span />
        </div>
        {players.map((p) => (
          <RosterRow key={p.id} team={team} rosterId={rosterId} p={p} onSaved={onSaved} onRemoved={onRemoved} setMsg={setMsg} />
        ))}
        <div className="grid grid-cols-[4rem_1fr] sm:grid-cols-[4rem_1fr_7rem_5rem_2rem] gap-2 pt-2">
          <input value={draft.number} onChange={(e) => setDraft({ ...draft, number: e.target.value })} placeholder="#" aria-label="New player number" className="field !py-1.5" />
          <input
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') add()
            }}
            placeholder="New player"
            aria-label="New player name"
            className="field !py-1.5"
          />
          <input value={draft.position} onChange={(e) => setDraft({ ...draft, position: e.target.value })} placeholder="A, M, D…" aria-label="New player position" className="field !py-1.5" />
          <input value={draft.class_year} onChange={(e) => setDraft({ ...draft, class_year: e.target.value })} placeholder="2028" aria-label="New player grad year" className="field !py-1.5" />
          <span />
        </div>
        <button type="button" onClick={add} disabled={busy || !draft.name.trim()} className="btn btn-primary !py-1.5 text-sm">
          {busy ? 'Adding…' : 'Add player'}
        </button>
      </div>
    </details>
  )
}

function RosterRow({
  team,
  rosterId,
  p,
  onSaved,
  onRemoved,
  setMsg,
}: {
  team: Team
  rosterId: string
  p: DepthPlayer
  onSaved: (p: DepthPlayer) => void
  onRemoved: (id: string) => void
  setMsg: (m: string) => void
}) {
  const [row, setRow] = useState({
    name: p.name,
    number: p.number ?? '',
    position: p.position ?? '',
    class_year: p.class_year ?? '',
  })
  const [, start] = useTransition()
  const changed =
    row.name !== p.name ||
    row.number !== (p.number ?? '') ||
    row.position !== (p.position ?? '') ||
    row.class_year !== (p.class_year ?? '')

  // Saved as he leaves the box, the way a spreadsheet does.
  function save() {
    if (!changed || !row.name.trim()) return
    const next: DepthPlayer = {
      id: p.id,
      name: row.name.trim(),
      number: row.number.trim() || null,
      position: row.position.trim() || null,
      class_year: row.class_year.trim() || null,
    }
    start(async () => {
      const r = await depthSavePlayer(team, next)
      setMsg(r.ok ? `Saved ${next.name}.` : r.error)
      if (r.ok) onSaved(next)
    })
  }

  function remove() {
    if (!confirm(`Take ${p.name} off this roster? The player and his evaluations stay.`)) return
    start(async () => {
      const r = await depthRemoveFromRoster(team, rosterId, p.id)
      setMsg(r.ok ? `${p.name} is off the roster.` : r.error)
      if (r.ok) onRemoved(p.id)
    })
  }

  const field = (k: keyof typeof row, label: string, extra = '') => (
    <input
      value={row[k]}
      onChange={(e) => setRow({ ...row, [k]: e.target.value })}
      onBlur={save}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
      }}
      aria-label={`${p.name} ${label}`}
      className={`field !py-1.5 ${extra}`}
    />
  )

  return (
    <div className="grid grid-cols-[4rem_1fr_2rem] sm:grid-cols-[4rem_1fr_7rem_5rem_2rem] gap-2 items-center">
      {field('number', 'number')}
      {field('name', 'name')}
      <button type="button" onClick={remove} aria-label={`Take ${p.name} off the roster`} className="sm:hidden text-gray-300 hover:text-red-700">×</button>
      <div className="col-span-3 grid grid-cols-2 gap-2 sm:contents">
        {field('position', 'position')}
        {field('class_year', 'grad year')}
      </div>
      <button type="button" onClick={remove} aria-label={`Take ${p.name} off the roster`} className="hidden sm:block text-gray-300 hover:text-red-700">×</button>
    </div>
  )
}
