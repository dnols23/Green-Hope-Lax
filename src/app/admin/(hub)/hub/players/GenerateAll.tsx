'use client'
import { useActionState } from 'react'
import { generateDrillSetsForRoster } from '@/lib/actions'
import type { FormState } from '@/lib/actions'

const EMPTY: FormState = { ok: true }

export function GenerateAll({ rosters }: { rosters: { id: string; name: string }[] }) {
  const [state, run, pending] = useActionState(generateDrillSetsForRoster, EMPTY)

  return (
    <form action={run} className="card p-4 flex flex-wrap items-end gap-3">
      <div className="flex-1 min-w-[200px]">
        <label className="field-label">Make a drill set for everyone on</label>
        <select name="list_id" className="field !py-1.5">
          {rosters.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
      </div>
      <button type="submit" disabled={pending} className="btn btn-primary disabled:opacity-60">
        {pending ? 'Working…' : 'Generate sets'}
      </button>
      {state.error && <p className="w-full text-sm text-red-700">{state.error}</p>}
      {state.ok && state.message && <p className="w-full text-sm text-green-700">{state.message}</p>}
    </form>
  )
}
