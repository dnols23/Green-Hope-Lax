'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { createStatGame } from '@/lib/statsActions'
import type { Team } from '@/lib/teams'

const SITES = [
  { key: 'home', label: 'Home' },
  { key: 'away', label: 'Away' },
  { key: 'neutral', label: 'Neutral' },
] as const

/**
 * A game that isn't on the schedule — a scrimmage, or one typed in on the
 * sideline. Four things and he's tracking: who, when, where, conference or not.
 * `today` comes from the server, in Eastern time, so the date is right at 9pm.
 */
export function NewGameForm({ team, today }: { team: Team; today: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  // Stays on once the game is made, so the button can't be tapped twice while
  // the tracker loads.
  const [going, setGoing] = useState(false)
  const [busy, start] = useTransition()
  const working = busy || going

  if (!open) {
    return (
      <button type="button" className="btn btn-ghost" onClick={() => setOpen(true)}>
        <span aria-hidden>＋</span> New game
      </button>
    )
  }

  return (
    <form
      className="card p-4 sm:p-5 space-y-4"
      aria-label="New game"
      onSubmit={(e) => {
        e.preventDefault()
        const f = new FormData(e.currentTarget)
        const site = String(f.get('site'))
        setError('')
        start(async () => {
          const r = await createStatGame({
            team,
            opponent: String(f.get('opponent') ?? ''),
            date: String(f.get('date') ?? ''),
            time: String(f.get('time') ?? ''),
            homeAway: site === 'away' || site === 'neutral' ? site : 'home',
            isConference: f.get('conference') === 'on',
          })
          if (!r.ok) {
            setError(r.error)
            return
          }
          setGoing(true)
          router.push(`/admin/track/${r.id}`)
        })
      }}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-black">New game</h3>
        <span className="text-xs text-gray-400">Goes on the schedule for coaches only</span>
      </div>

      <div>
        <label className="field-label" htmlFor="ng-opponent">Opponent</label>
        <input
          id="ng-opponent"
          name="opponent"
          required
          maxLength={80}
          autoFocus
          autoComplete="off"
          enterKeyHint="go"
          className="field"
          placeholder="Cary"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="field-label" htmlFor="ng-date">Date</label>
          <input id="ng-date" name="date" type="date" required defaultValue={today} className="field" />
        </div>
        <div>
          <label className="field-label" htmlFor="ng-time">
            Time <span className="font-normal text-gray-400">(optional)</span>
          </label>
          <input id="ng-time" name="time" type="time" className="field" />
        </div>
      </div>

      <fieldset>
        <legend className="field-label">Where</legend>
        <div className="grid grid-cols-3 rounded-full border p-0.5 bg-white" style={{ borderColor: 'var(--border)' }}>
          {SITES.map((s) => (
            <label key={s.key} className="cursor-pointer">
              <input type="radio" name="site" value={s.key} defaultChecked={s.key === 'home'} className="sr-only peer" />
              <span className="flex min-h-10 items-center justify-center rounded-full text-sm font-bold text-gray-500 peer-checked:bg-[var(--gh-green)] peer-checked:text-white peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2">
                {s.label}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className="flex items-center gap-2.5 text-sm font-semibold cursor-pointer select-none">
        <input type="checkbox" name="conference" className="h-5 w-5 accent-[var(--gh-green)]" />
        Conference game
      </label>

      {error && (
        <p role="alert" className="text-sm font-semibold text-red-700">
          {error}
        </p>
      )}

      <div className="flex gap-2 pt-1">
        <button type="submit" className="btn btn-primary flex-1 sm:flex-none" disabled={working}>
          {working ? 'Opening tracker…' : 'Start tracking'}
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={working}
          onClick={() => {
            setOpen(false)
            setError('')
          }}
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
