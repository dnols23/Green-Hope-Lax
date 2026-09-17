'use client'
import { useMemo, useState } from 'react'
import { useActionState } from 'react'
import { joinAsPlayer } from '@/lib/joinActions'
import type { FormState } from '@/lib/actions'
import { SubmitButton } from '@/components/SubmitButton'

const initial: FormState = { ok: false }

export interface JoinablePlayer {
  id: string
  name: string
  number: string | null
  /** Somebody has already signed in as him — worth saying, not worth blocking. */
  claimed: boolean
}

export function PlayerJoinForm({ token, players }: { token: string; players: JoinablePlayer[] }) {
  const [state, formAction] = useActionState(joinAsPlayer, initial)
  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState<string | null>(null)

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return players
    return players.filter((p) => p.name.toLowerCase().includes(q))
  }, [players, query])

  return (
    <form action={formAction} className="card p-5 space-y-4">
      <input type="hidden" name="join_token" value={token} />
      <input type="hidden" name="player_id" value={picked ?? ''} />

      <div>
        <label className="field-label">Your name</label>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Start typing…"
          className="field"
          autoFocus
        />
      </div>

      <div className="max-h-72 overflow-y-auto divide-y divide-gray-100 rounded-lg border border-gray-200">
        {shown.length === 0 && (
          <p className="p-4 text-sm text-gray-500">
            No name like that on the roster. Check the spelling, or ask a coach to add you.
          </p>
        )}
        {shown.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPicked(p.id)}
            className="w-full text-left px-4 py-2.5 flex items-center gap-3 hover:bg-gray-50"
            style={picked === p.id ? { background: '#DFEFE7' } : undefined}
          >
            <span className="font-semibold flex-1">
              {p.number ? <span className="text-gray-400 mr-1.5">#{p.number}</span> : null}
              {p.name}
            </span>
            {picked === p.id && <span className="text-xs font-black" style={{ color: 'var(--gh-green)' }}>✓</span>}
            {picked !== p.id && p.claimed && <span className="text-xs text-gray-400">already signed in</span>}
          </button>
        ))}
      </div>

      {state.error && <p className="text-sm font-semibold text-[var(--gh-maroon)]">{state.error}</p>}

      <SubmitButton>That&rsquo;s me — let me in</SubmitButton>
    </form>
  )
}
