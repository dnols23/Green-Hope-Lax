'use client'

import { useState } from 'react'
import { saveCalendarShare } from '@/lib/calendarActions'
import {
  SHARE_CALENDARS,
  SHARE_HUBS,
  SHARE_LAYERS,
  parseCalendarShare,
  type CalendarShare,
  type ShareHub,
  type ShareLayer,
} from '@/lib/calendarShare'
import type { CalTeam } from '@/lib/calendarModel'

/**
 * The owner's share settings: for each calendar, whether it is published to
 * each hub and which parts of it go there.
 */
export function SharePanel({
  initial,
  onSaved,
  onClose,
}: {
  initial: CalendarShare | null | undefined
  onSaved: () => void
  onClose: () => void
}) {
  const [share, setShare] = useState<CalendarShare>(() => parseCalendarShare(initial ?? null))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function patch(cal: CalTeam, hub: ShareHub, next: { on?: boolean; layer?: ShareLayer }) {
    setShare((s) => {
      const cur = s[cal][hub]
      const layers = next.layer
        ? cur.layers.includes(next.layer)
          ? cur.layers.filter((l) => l !== next.layer)
          : [...cur.layers, next.layer]
        : cur.layers
      return { ...s, [cal]: { ...s[cal], [hub]: { on: next.on ?? cur.on, layers } } }
    })
  }

  async function save() {
    setBusy(true)
    setError(null)
    try {
      const res = await saveCalendarShare(share)
      if (!res.ok) {
        setError(res.error)
        return
      }
      onSaved()
      onClose()
    } catch {
      setError('Couldn’t reach the server.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="flex items-center gap-3 px-5 pt-4 pb-3 border-b border-gray-100">
        <h2 className="text-lg font-black flex-1">Sharing</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="w-10 h-10 -mr-2 rounded-full text-2xl leading-none text-gray-400 hover:text-gray-800 hover:bg-gray-100"
        >
          &times;
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-5">
        {SHARE_CALENDARS.map((cal) => (
          <section key={cal.key}>
            <h3 className="text-xs font-black tracking-[0.15em] uppercase text-gray-400 mb-2">{cal.label}</h3>
            <div className="rounded-xl border border-gray-200 divide-y divide-gray-100">
              {SHARE_HUBS.map((hub) => {
                const s = share[cal.key][hub.key]
                return (
                  <div key={hub.key} className="px-3 py-2.5 flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={s.on}
                      aria-label={`${cal.label} calendar in the ${hub.label}`}
                      onClick={() => patch(cal.key, hub.key, { on: !s.on })}
                      className="relative w-9 h-5 rounded-full shrink-0 transition-colors"
                      style={{ background: s.on ? 'var(--gh-green)' : 'var(--color-gray-300, #d1d5db)' }}
                    >
                      <span
                        className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all"
                        style={{ left: s.on ? 18 : 2 }}
                      />
                    </button>
                    <span className={`text-sm font-bold w-24 shrink-0 ${s.on ? 'text-gray-900' : 'text-gray-400'}`}>
                      {hub.label}
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {SHARE_LAYERS.filter((l) => cal.layers.includes(l.key)).map((l) => {
                        const on = s.layers.includes(l.key)
                        return (
                          <button
                            key={l.key}
                            type="button"
                            aria-pressed={on}
                            disabled={!s.on}
                            onClick={() => patch(cal.key, hub.key, { layer: l.key })}
                            className="min-h-8 px-3 rounded-full border text-xs font-bold disabled:opacity-40"
                            style={
                              on
                                ? { background: 'var(--color-gray-900, #111827)', color: 'var(--surface, #fff)', borderColor: 'var(--color-gray-900, #111827)' }
                                : { color: 'var(--text-muted)', borderColor: 'var(--border)' }
                            }
                          >
                            {on && <span aria-hidden>✓ </span>}
                            {l.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        ))}
      </div>

      <div className="px-5 py-3 border-t border-gray-100 flex items-center gap-3">
        {error && <p className="text-sm text-red-700 flex-1">{error}</p>}
        <button type="button" onClick={onClose} className="btn btn-ghost ml-auto">
          Cancel
        </button>
        <button type="button" onClick={save} disabled={busy} className="btn btn-primary">
          {busy ? 'Saving…' : 'Save'}
        </button>
      </div>
    </>
  )
}
