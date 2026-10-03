'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { removePlayerFromRoster, saveRosterPlayer } from '@/lib/actions'
import { PublishToggle } from '@/components/admin/PublishToggle'

export interface RosterRowPlayer {
  id: string
  name: string
  number: string | null
  position: string | null
  class_year: string | null
  team: string
  is_active: boolean
}

const POSITIONS = ['Attack', 'Midfield', 'Defense', 'LSM', 'SSDM', 'FOGO', 'Goalie']
const TEAMS = [
  { key: 'boys_varsity', label: 'Varsity' },
  { key: 'boys_jv', label: 'JV' },
  { key: 'girls', label: 'Girls' },
]

/**
 * The roster, editable where it stands: tap a box, change it, and it saves
 * when you leave it — the way a spreadsheet does.
 */
export function RosterTable({ listId, players }: { listId: string; players: RosterRowPlayer[] }) {
  const [msg, setMsg] = useState('')
  return (
    <>
      <datalist id="roster-positions">
        {POSITIONS.map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>
      <div className="card table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>#</th><th>Player</th><th>Position</th><th>Grad</th><th>Team</th><th>Public</th>
              <th className="col-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {players.map((p) => (
              <Row key={p.id} listId={listId} p={p} setMsg={setMsg} />
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-400 mt-2 min-h-4" role="status">{msg}</p>
    </>
  )
}

function Row({ listId, p, setMsg }: { listId: string; p: RosterRowPlayer; setMsg: (m: string) => void }) {
  const initial = {
    name: p.name,
    number: p.number ?? '',
    position: p.position ?? '',
    class_year: p.class_year ?? '',
    team: p.team,
  }
  const [row, setRow] = useState(initial)
  const [saved, setSaved] = useState(initial)
  // The name opens his profile; the pencil beside it edits it.
  const [naming, setNaming] = useState(false)
  const [, start] = useTransition()

  function save(next = row) {
    if (JSON.stringify(next) === JSON.stringify(saved)) return
    if (!next.name.trim()) {
      setRow(saved)
      setMsg('A player needs a name.')
      return
    }
    start(async () => {
      const r = await saveRosterPlayer({ id: p.id, listId, ...next })
      if (r.ok) {
        setSaved(next)
        setMsg(`Saved ${next.name.trim()}.`)
      } else {
        setMsg(r.error ?? 'Couldn’t save.')
      }
    })
  }

  const box = (k: 'number' | 'position' | 'class_year', label: string, cls: string, extra: Record<string, string> = {}) => (
    <input
      value={row[k]}
      onChange={(e) => setRow({ ...row, [k]: e.target.value })}
      onBlur={() => save()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        if (e.key === 'Escape') setRow(saved)
      }}
      aria-label={`${p.name} ${label}`}
      className={`field !py-1 !px-2 text-sm ${cls}`}
      {...extra}
    />
  )

  return (
    <tr>
      <td>{box('number', 'number', '!w-12 font-black tabular-nums text-[var(--gh-green)]', { inputMode: 'numeric' })}</td>
      <td>
        {naming ? (
          <input
            autoFocus
            value={row.name}
            onChange={(e) => setRow({ ...row, name: e.target.value })}
            onBlur={() => {
              setNaming(false)
              save()
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
              if (e.key === 'Escape') {
                setRow(saved)
                setNaming(false)
              }
            }}
            aria-label={`${p.name} name`}
            className="field !py-1 !px-2 text-sm min-w-36 font-semibold"
          />
        ) : (
          <div className="flex items-center gap-1.5 min-w-36">
            <Link href={`/admin/hub/players/${p.id}`} className="font-semibold hover:underline hover:text-[var(--gh-green)]">
              {saved.name}
            </Link>
            <button
              type="button"
              onClick={() => setNaming(true)}
              aria-label={`Rename ${saved.name}`}
              title="Edit name"
              className="text-gray-300 hover:text-gray-600 text-sm px-1"
            >
              ✎
            </button>
          </div>
        )}
      </td>
      <td>{box('position', 'position', '!w-24', { list: 'roster-positions' })}</td>
      <td>{box('class_year', 'grad year', '!w-16', { inputMode: 'numeric', placeholder: '2028' })}</td>
      <td>
        <select
          value={row.team}
          onChange={(e) => {
            const next = { ...row, team: e.target.value }
            setRow(next)
            save(next)
          }}
          aria-label={`${p.name} team`}
          className="field !py-1 !pl-2 !pr-7 !w-auto text-sm"
        >
          {TEAMS.map((t) => (
            <option key={t.key} value={t.key}>{t.label}</option>
          ))}
        </select>
      </td>
      <td>
        <PublishToggle entity="player" id={p.id} live={p.is_active} onLabel="● Public" offLabel="○ Hidden" />
      </td>
      <td className="col-actions">
        <div className="flex items-center gap-3">
          <Link href={`/admin/hub/players/${p.id}`} className="text-xs font-bold text-[var(--gh-green)]">
            Profile
          </Link>
          <Link href={`/admin/hub/evaluate/${p.id}`} className="text-xs font-bold text-[var(--gh-green)]">
            Evaluate
          </Link>
          <form action={removePlayerFromRoster}>
            <input type="hidden" name="list_id" value={listId} />
            <input type="hidden" name="player_id" value={p.id} />
            <button type="submit" className="text-xs font-bold text-gray-400 hover:text-red-700">
              Remove
            </button>
          </form>
        </div>
      </td>
    </tr>
  )
}
