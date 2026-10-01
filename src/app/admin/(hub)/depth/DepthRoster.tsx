'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { depthAddPlayer, depthRemoveFromRoster, depthSavePlayer, type DepthPlayer } from '@/lib/depthActions'
import type { Team } from '@/lib/teams'

/** The roster behind the chart: add a player, or fix a number or a position, without leaving. */
export function RosterPanel({
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
