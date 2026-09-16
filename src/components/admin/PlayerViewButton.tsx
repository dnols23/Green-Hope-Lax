'use client'
import { useState } from 'react'

// "What does this look like on their phone?" — the question a coach asks every
// time they post something, and until now could only answer by borrowing a
// player's phone. Opens the Team Hub in a new tab, standing in for one player,
// so the editor stays where it was.
export function PlayerViewButton({
  players,
}: {
  players: { id: string; name: string }[]
}) {
  const [id, setId] = useState('')

  const href = id ? `/team?preview=${encodeURIComponent(id)}` : '/team'

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="min-w-[12rem]">
        <label className="field-label" htmlFor="previewPlayer">See it as</label>
        <select
          id="previewPlayer"
          value={id}
          onChange={(e) => setId(e.target.value)}
          className="field"
        >
          <option value="">Someone with the team password</option>
          {players.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>
      <a href={href} target="_blank" rel="noreferrer" className="btn btn-primary">
        Open player view ↗
      </a>
    </div>
  )
}
