'use client'
import { useActionState } from 'react'
import { importDrills } from '@/lib/actions'
import type { FormState } from '@/lib/actions'
import { DRILL_CATEGORIES } from '@/lib/drills'

const EMPTY: FormState = { ok: true }

/** Paste a bank in rather than typing it one drill at a time. */
export function DrillImport() {
  const [state, run, pending] = useActionState(importDrills, EMPTY)

  return (
    <details className="card p-4">
      <summary className="cursor-pointer list-none font-bold text-gray-700 flex items-center gap-2">
        <span className="caret text-sm">▸</span> Paste a list of drills
        <span className="font-normal text-xs text-gray-400">one per line</span>
      </summary>
      <form action={run} className="mt-4 pt-4 border-t border-gray-100 space-y-3">
        <p className="text-xs text-gray-500">
          One drill a line. Add a category, a length or a link after it, separated by{' '}
          <code>|</code> — in any order, all optional:
          <br />
          <code>West Genny | groundballs | 10 | https://…</code>
        </p>
        <textarea
          name="paste"
          rows={6}
          className="field font-mono text-xs"
          placeholder={'3 man passing\nWest Genny | groundballs | 10\nMirror dodge | dodging | 8 | https://…'}
        />
        <div className="flex items-center gap-3 flex-wrap">
          <label className="text-xs font-bold text-gray-500">
            Anything without a category goes in
            <select name="category" className="field !py-1.5 text-sm ml-2 w-auto inline-block">
              {DRILL_CATEGORIES.map((c) => (
                <option key={c.key} value={c.key}>{c.label}</option>
              ))}
            </select>
          </label>
          <button type="submit" disabled={pending} className="btn btn-primary disabled:opacity-60">
            {pending ? 'Adding…' : 'Add them'}
          </button>
        </div>
        {state.error && <p className="text-sm text-red-700">{state.error}</p>}
        {state.ok && state.message && <p className="text-sm text-green-700">{state.message}</p>}
      </form>
    </details>
  )
}
