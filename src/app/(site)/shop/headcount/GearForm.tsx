'use client'

import { useActionState, useState } from 'react'
import { addGearInterest, type GearResult } from '@/lib/gearActions'
import { GEAR } from '@/lib/gearInterest'

/** Tick what you want, the size, who it's for. One form for both items. */
export function GearForm() {
  const [state, action, pending] = useActionState<GearResult | null, FormData>(addGearInterest, null)
  const [want, setWant] = useState<Record<string, boolean>>({})

  if (state?.ok && state.items.length) {
    return (
      <div className="card p-6 text-center">
        <div className="text-3xl" aria-hidden>🦅</div>
        <p className="font-black text-lg mt-2">You’re on the list</p>
        <p className="text-gray-600 mt-1">{state.items.join(' and ')}. We’ll email you if we reach six and the order goes in.</p>
        <button type="button" className="btn btn-ghost mt-4" onClick={() => window.location.reload()}>
          Add another player
        </button>
      </div>
    )
  }

  return (
    <form action={action} className="card p-5 sm:p-6 space-y-5">
      <div className="space-y-3">
        {GEAR.map((g) => {
          const on = !!want[g.key]
          return (
            <div
              key={g.key}
              className="rounded-xl border-2 p-4 transition-colors"
              style={{ borderColor: on ? 'var(--gh-green)' : 'var(--border)' }}
            >
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  name={`want_${g.key}`}
                  checked={on}
                  onChange={(e) => setWant((w) => ({ ...w, [g.key]: e.target.checked }))}
                  className="mt-1 w-5 h-5 accent-[var(--gh-green)]"
                />
                <span className="flex-1">
                  <span className="font-black block">{g.name}</span>
                  <span className="text-sm text-gray-500">${g.price} · {g.blurb}</span>
                </span>
              </label>
              {on && (
                <div className="mt-3 pl-8 grid grid-cols-2 gap-3 max-w-sm">
                  {g.sizes && (
                    <div>
                      <label className="field-label" htmlFor={`size_${g.key}`}>Size</label>
                      <select id={`size_${g.key}`} name={`size_${g.key}`} className="field" defaultValue={g.sizes[g.sizes.length - 1]}>
                        {g.sizes.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="field-label" htmlFor={`qty_${g.key}`}>How many</label>
                    <select id={`qty_${g.key}`} name={`qty_${g.key}`} className="field" defaultValue="1">
                      {[1, 2, 3, 4].map((n) => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="field-label" htmlFor="player_name">Player’s name *</label>
          <input id="player_name" name="player_name" required maxLength={120} className="field" autoComplete="off" />
        </div>
        <div>
          <label className="field-label" htmlFor="contact_name">Your name</label>
          <input id="contact_name" name="contact_name" maxLength={120} className="field" autoComplete="name" />
        </div>
        <div className="sm:col-span-2">
          <label className="field-label" htmlFor="email">Email *</label>
          <input id="email" name="email" type="email" required maxLength={200} className="field" autoComplete="email" />
        </div>
      </div>
      {/* Left empty by people; bots fill it in. */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />

      {state && !state.ok && <p className="text-sm font-semibold text-red-600">{state.error}</p>}
      <button type="submit" className="btn btn-primary w-full sm:w-auto" disabled={pending || !Object.values(want).some(Boolean)}>
        {pending ? 'Saving…' : 'Count me in'}
      </button>
      <p className="text-xs text-gray-400">
        This is a head count, not an order — nothing is charged. If we reach six, we’ll email you to order through BattleLax.
      </p>
    </form>
  )
}
