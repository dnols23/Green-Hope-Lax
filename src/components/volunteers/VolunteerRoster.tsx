'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { loadGameVolunteers, remindVolunteers, saveGamePositions } from '@/lib/gameVolunteerActions'
import { spotsOpen, type GameSignup, type Position } from '@/lib/gameVolunteerModel'
import { PositionsEditor } from './PositionsEditor'
import { gameWhenLong } from './VolunteerSignup'

/**
 * A game's volunteers, from the coaches' calendar: every position and who has
 * it, with their email. The head coach can change this game's positions and
 * send everyone on it a reminder now.
 */
export function VolunteerRoster({ gameId, onClose, onChanged }: { gameId: string; onClose: () => void; onChanged: () => void }) {
  const [signup, setSignup] = useState<GameSignup | null>(null)
  const [isOwner, setIsOwner] = useState(false)
  const [open, setOpen] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [editing, setEditing] = useState<Position[] | null>(null)
  const [confirm, setConfirm] = useState<{ positions: Position[] | 'lists'; message: string } | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let live = true
    loadGameVolunteers(gameId)
      .then((res) => {
        if (!live) return
        if (res.ok) {
          setSignup(res.signup)
          setIsOwner(res.isOwner)
          setOpen(res.open)
        } else setError(res.error)
      })
      .catch(() => live && setError('Couldn’t reach the server. Check the signal and try again.'))
    return () => {
      live = false
    }
  }, [gameId])

  async function save(positions: Position[] | 'lists', sure = false) {
    setBusy(true)
    setError(null)
    try {
      const res = await saveGamePositions({ gameId, positions, confirm: sure })
      if (!res.ok) {
        if (res.confirm) setConfirm({ positions, message: res.error })
        else setError(res.error)
        return
      }
      setSignup(res.signup)
      setEditing(null)
      setConfirm(null)
      setNote(positions === 'lists' ? 'Back on the list.' : 'Positions saved.')
      onChanged()
    } catch {
      setError('Couldn’t reach the server. Check the signal and try again.')
    } finally {
      setBusy(false)
    }
  }

  async function remind() {
    setBusy(true)
    setError(null)
    try {
      const res = await remindVolunteers(gameId)
      if (!res.ok) setError(res.error)
      else setNote(res.sent ? `Reminder sent to ${res.sent} ${res.sent === 1 ? 'person' : 'people'}.` : 'Nobody to remind yet.')
    } catch {
      setError('Couldn’t reach the server. Check the signal and try again.')
    } finally {
      setBusy(false)
    }
  }

  const people = signup?.positions.reduce((n, p) => n + p.people.length, 0) ?? 0
  const needed = signup?.positions.reduce((n, p) => n + p.needed, 0) ?? 0
  const taken = Object.fromEntries(signup?.positions.map((p) => [p.label.toLowerCase(), p.people.length]) ?? [])
  const venue = signup?.homeAway === 'home' ? 'home' : 'away'

  return (
    <>
      <div aria-hidden className="sm:hidden mx-auto mt-2 h-1.5 w-10 rounded-full bg-gray-200" />
      <div className="flex items-start gap-3 px-5 pt-3 sm:pt-5 pb-3">
        <span aria-hidden className="mt-1 w-3.5 h-3.5 rounded shrink-0 border" style={{ background: '#fdf2e0', borderColor: '#eda100' }} />
        <div className="min-w-0 flex-1">
          <div className="text-[0.68rem] font-black tracking-[0.18em] uppercase" style={{ color: '#a16207' }}>
            🙋 Volunteers
          </div>
          <h2 className="text-lg font-black leading-snug break-words">{signup?.title ?? 'Loading…'}</h2>
          {signup && <p className="text-sm text-gray-600 mt-0.5">{gameWhenLong(signup.startsAt)}</p>}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="shrink-0 w-10 h-10 -mr-2 -mt-1 rounded-full text-2xl leading-none text-gray-400 hover:text-gray-800 hover:bg-gray-100"
        >
          &times;
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-4 space-y-3 text-sm">
        {!signup && !error && <div className="h-32 rounded-xl bg-gray-100 animate-pulse" />}
        {signup && !editing && (
          <>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="rounded-full px-2.5 py-1 text-xs font-black" style={{ background: '#fdf2e0', color: '#7a4f00' }}>
                {needed - spotsOpen(signup)} of {needed} filled
              </span>
              {signup.custom && (
                <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-700">This game’s own positions</span>
              )}
            </div>
            {isOwner && !open && (
              <p className="rounded-lg px-3 py-2" style={{ background: '#fdf2e0', color: '#7a4f00' }}>
                Parents can’t see sign-ups yet.{' '}
                <Link href="/admin/parents#volunteers" className="font-bold underline">
                  Open them in Parent Hub settings
                </Link>
              </p>
            )}
            <div className="rounded-xl border border-gray-200 divide-y divide-gray-100">
              {signup.positions.length === 0 && <p className="px-3 py-3 text-gray-500">No positions for this game.</p>}
              {signup.positions.map((p) => (
                <div key={p.id} className="px-3 py-2.5">
                  <div className="flex items-baseline gap-2">
                    <span className="font-bold flex-1 min-w-0">{p.label}</span>
                    <span className="text-xs font-bold tabular-nums text-gray-500">
                      {p.people.length}/{p.needed}
                    </span>
                  </div>
                  {p.people.length === 0 ? (
                    <p className="text-gray-400 mt-0.5">Open</p>
                  ) : (
                    <ul className="mt-1 space-y-1">
                      {p.people.map((x) => (
                        <li key={x.id} className="leading-snug">
                          <span className="font-semibold" style={{ color: 'var(--gh-green)' }}>
                            ✓ {x.name}
                          </span>
                          {x.email && (
                            <a href={`mailto:${x.email}`} className="ml-1.5 text-gray-500 hover:underline break-all">
                              {x.email}
                            </a>
                          )}
                          {x.note && <span className="block text-gray-500">“{x.note}”</span>}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
        {editing && (
          <>
            <p className="text-gray-500">
              Changes here are for this game only. The {venue}-game list in Parent Hub settings sets every other game.
            </p>
            <PositionsEditor value={editing} onChange={setEditing} taken={taken} />
          </>
        )}
        {confirm && (
          <div role="alert" className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5">
            <p className="font-semibold text-amber-900">{confirm.message}</p>
            <div className="mt-2 flex gap-2">
              <button type="button" disabled={busy} onClick={() => void save(confirm.positions, true)} className="btn btn-maroon !py-1.5 min-h-9">
                Save anyway
              </button>
              <button type="button" onClick={() => setConfirm(null)} className="btn btn-ghost !py-1.5 min-h-9">
                Go back
              </button>
            </div>
          </div>
        )}
        {note && !error && (
          <p role="status" className="rounded-lg px-3 py-2 font-bold" style={{ background: '#e6f2ec', color: '#00512F' }}>
            {note}
          </p>
        )}
        {error && (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 font-semibold text-red-800">
            {error}
          </p>
        )}
      </div>

      <div className="border-t border-gray-100 px-5 py-3 flex flex-wrap items-center gap-2">
        {editing ? (
          <>
            <button
              type="button"
              disabled={busy || editing.some((p) => !p.label.trim())}
              onClick={() => void save(editing)}
              className="btn btn-primary min-h-10 disabled:opacity-50"
            >
              {busy ? 'Saving…' : 'Save for this game'}
            </button>
            <button type="button" onClick={() => setEditing(null)} className="btn btn-ghost min-h-10">
              Cancel
            </button>
          </>
        ) : (
          <>
            {isOwner && signup && (
              <button
                type="button"
                onClick={() => {
                  setNote(null)
                  setEditing(signup.positions.map((p) => ({ label: p.label, needed: p.needed, detail: p.detail })))
                }}
                className="btn btn-primary min-h-10"
              >
                Edit positions
              </button>
            )}
            {isOwner && signup?.custom && (
              <button type="button" disabled={busy} onClick={() => void save('lists')} className="btn btn-ghost min-h-10">
                Use the {venue}-game list
              </button>
            )}
            {isOwner && people > 0 && (
              <button type="button" disabled={busy} onClick={() => void remind()} className="btn btn-ghost min-h-10">
                {busy ? 'Sending…' : '✉️ Remind them now'}
              </button>
            )}
            <button type="button" onClick={onClose} className="btn btn-ghost min-h-10 ml-auto">
              Close
            </button>
          </>
        )}
      </div>
    </>
  )
}
