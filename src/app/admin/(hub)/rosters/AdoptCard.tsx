'use client'
import { useActionState } from 'react'
import { adoptPublicRoster } from '@/lib/actions'
import type { FormState } from '@/lib/actions'

const EMPTY: FormState = { ok: true }

/**
 * Gathers players who aren't on any roster into one.
 *
 * A client component purely so a failure is visible: every way this can go wrong
 * used to end in a silent return, which looks exactly like a button that does
 * nothing.
 */
export function AdoptCard({ count, published }: { count: number; published: boolean }) {
  const [state, run, pending] = useActionState(adoptPublicRoster, EMPTY)

  return (
    <section className="card p-5 border-l-4" style={{ borderLeftColor: 'var(--gh-green)' }}>
      <h2 className="font-bold text-gray-700">
        {count} {count === 1 ? 'player isn’t' : 'players aren’t'} on any roster
      </h2>
      <p className="text-sm text-gray-500 mt-1 max-w-lg">
        They’re in the program but not on one of the lists below — last season’s squad, most likely,
        from before rosters existed. Gather them into one and you can evaluate through it, publish
        it, or keep it as history.
        {!published && ' Nothing is published right now, so this one will be.'}
      </p>

      <form action={run} className="grid sm:grid-cols-3 gap-3 items-end mt-4">
        <div className="sm:col-span-2">
          <label className="field-label">Call it</label>
          <input name="name" defaultValue="2025-2026 Season" className="field" />
        </div>
        <div>
          <label className="field-label">Season</label>
          <input name="season" defaultValue="2025-2026" className="field" />
        </div>
        {state.error && (
          <div className="sm:col-span-3 text-sm rounded-lg px-3 py-2 bg-red-50 border border-red-200 text-red-700">
            {state.error}
          </div>
        )}
        <div className="sm:col-span-3">
          <button type="submit" disabled={pending} className="btn btn-primary disabled:opacity-60">
            {pending ? 'Building…' : `Make a roster from ${count} ${count === 1 ? 'player' : 'players'}`}
          </button>
        </div>
      </form>
    </section>
  )
}
