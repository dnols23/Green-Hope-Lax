'use client'

import { useEffect, useState } from 'react'
import { dropGameSpot, openGameSignup, takeGameSpot } from '@/lib/gameVolunteerActions'
import { spotsOpen, type GameSignup } from '@/lib/gameVolunteerModel'

/** "Wednesday, March 3 at 6:30 PM" on this phone's clock, like the calendar. */
export const gameWhenLong = (iso: string) =>
  new Date(iso).toLocaleString('en-US', { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })

const hasStarted = (iso: string) => Date.parse(iso) < Date.now()

/**
 * The Parent Hub's sign-up for one game: every volunteer position, who has
 * it, and a button to take one. Signing up takes two taps — "Sign up", then
 * "Confirm" with an optional note — so a stray tap on a phone signs nobody up.
 */
export function VolunteerSignup({ gameId, onBack, onClose }: { gameId: string; onBack: () => void; onClose: () => void }) {
  const [signup, setSignup] = useState<GameSignup | null>(null)
  const [signedIn, setSignedIn] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [picking, setPicking] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    openGameSignup(gameId)
      .then((res) => {
        if (!live) return
        if (res.ok) {
          setSignup(res.signup)
          setSignedIn(res.signedIn)
        } else setError(res.error)
      })
      .catch(() => live && setError('Couldn’t reach the server. Check the signal and try again.'))
    return () => {
      live = false
    }
  }, [gameId])

  async function run(job: () => ReturnType<typeof takeGameSpot>, message: string) {
    setBusy(true)
    setError(null)
    try {
      const res = await job()
      if (!res.ok) {
        setError(res.error)
        return
      }
      setSignup(res.signup)
      setPicking(null)
      setNote('')
      setDone(message)
    } catch {
      setError('Couldn’t reach the server. Check the signal and try again.')
    } finally {
      setBusy(false)
    }
  }

  const started = signup ? hasStarted(signup.startsAt) : false
  const open = signup ? spotsOpen(signup) : 0

  return (
    <>
      <div aria-hidden className="sm:hidden mx-auto mt-2 h-1.5 w-10 rounded-full bg-gray-200" />
      <div className="flex items-start gap-2 px-4 pt-3 sm:pt-4 pb-3 border-b border-gray-100">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to the game"
          className="shrink-0 w-10 h-10 -ml-1 rounded-full text-2xl leading-none text-gray-500 hover:bg-gray-100"
        >
          &lsaquo;
        </button>
        <div className="min-w-0 flex-1 pt-0.5">
          <div className="text-[0.68rem] font-black tracking-[0.18em] uppercase" style={{ color: '#a16207' }}>
            🙋 Volunteer sign-up
          </div>
          <h2 className="text-lg font-black leading-snug break-words">{signup?.title ?? 'Loading…'}</h2>
          {signup && (
            <p className="text-sm text-gray-600 mt-0.5">
              {gameWhenLong(signup.startsAt)}
              {signup.location ? ` · ${signup.location}` : ''}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="shrink-0 w-10 h-10 -mr-2 rounded-full text-2xl leading-none text-gray-400 hover:text-gray-800 hover:bg-gray-100"
        >
          &times;
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-2.5">
        {done && (
          <p role="status" className="rounded-lg px-3 py-2 text-sm font-bold" style={{ background: '#e6f2ec', color: '#00512F' }}>
            {done}
          </p>
        )}
        {error && (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800">
            {error}
          </p>
        )}
        {!signup && !error && <div className="h-32 rounded-xl bg-gray-100 animate-pulse" />}
        {signup && signup.positions.length === 0 && <p className="text-sm text-gray-500">No volunteers needed for this game.</p>}
        {signup?.positions.map((p) => {
          const left = Math.max(0, p.needed - p.people.length)
          const mine = p.people.find((x) => x.mine)
          return (
            <div
              key={p.id}
              className="rounded-xl border p-3"
              style={{ borderColor: mine ? '#6fbf8f' : 'var(--color-gray-200, #e5e7eb)', background: mine ? '#f2faf5' : undefined }}
            >
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-bold leading-snug">{p.label}</div>
                  {p.detail && <p className="text-sm text-gray-500 leading-snug mt-0.5">{p.detail}</p>}
                </div>
                <span
                  className="shrink-0 rounded-full px-2 py-0.5 text-xs font-black tabular-nums"
                  style={left ? { background: '#fdf2e0', color: '#7a4f00' } : { background: 'var(--color-gray-100, #f3f4f6)', color: 'var(--color-gray-500, #6b7280)' }}
                >
                  {left ? `${left} open` : 'Filled'}
                </span>
              </div>

              {p.people.length > 0 && (
                <ul className="mt-2 space-y-0.5 text-sm">
                  {p.people.map((x) => (
                    <li key={x.id} className="flex items-baseline gap-1.5">
                      <span className="font-semibold" style={{ color: 'var(--gh-green)' }}>
                        ✓ {x.mine ? 'You' : x.name}
                      </span>
                      {x.note && <span className="text-gray-500 truncate">— {x.note}</span>}
                    </li>
                  ))}
                </ul>
              )}

              {mine ? (
                !started && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void run(() => dropGameSpot({ gameId, claimId: mine.id }), 'Okay — your spot is open again.')}
                    className="mt-2 text-sm font-semibold text-[var(--gh-maroon)] disabled:opacity-50"
                  >
                    I can&rsquo;t after all
                  </button>
                )
              ) : picking === p.id ? (
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  <input
                    autoFocus
                    value={note}
                    maxLength={200}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Note for the coaches (optional)"
                    className="field !py-1.5 text-sm flex-1 min-w-40"
                  />
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void run(() => takeGameSpot({ gameId, slotId: p.id, note }), `You’re signed up for ${p.label}. Check your email for a copy.`)
                    }
                    className="btn btn-primary !py-1.5 min-h-9 disabled:opacity-50"
                  >
                    {busy ? 'Signing up…' : 'Confirm'}
                  </button>
                  <button type="button" onClick={() => setPicking(null)} className="btn btn-ghost !py-1.5 min-h-9">
                    Cancel
                  </button>
                </div>
              ) : (
                left > 0 &&
                signedIn &&
                !started && (
                  <button
                    type="button"
                    onClick={() => {
                      setPicking(p.id)
                      setNote('')
                      setDone(null)
                    }}
                    className="btn btn-primary !py-1.5 min-h-9 mt-2.5"
                  >
                    Sign up
                  </button>
                )
              )}
            </div>
          )
        })}
      </div>

      <div className="border-t border-gray-100 px-4 py-2.5 text-xs text-gray-500">
        {!signup
          ? ' '
          : started
            ? 'This game has started — sign-ups are closed.'
            : !signedIn
              ? 'Parents sign up here. You’re looking as a coach.'
              : open
                ? 'You’ll get an email copy now and a reminder the day before.'
                : 'Every spot is filled — thank you!'}
      </div>
    </>
  )
}
