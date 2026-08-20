'use client'
import { useActionState, useRef, useState } from 'react'
import { importRosterPlayers } from '@/lib/actions'
import { SubmitButton } from '@/components/SubmitButton'
import { TEAM_LABELS } from '@/lib/types'

type State = { ok: boolean; error?: string; added?: number; matched?: number }
const initial: State = { ok: false }

/**
 * Bulk-add players by pasting from a spreadsheet or picking a CSV.
 *
 * The file is read here in the browser and dropped into the same box the paste
 * goes into, so both routes end up as one piece of text the server parses —
 * nothing is uploaded, and you can see and fix what's about to be imported.
 */
export function ImportPlayers({ listId }: { listId: string }) {
  const [state, formAction] = useActionState(importRosterPlayers, initial)
  const [text, setText] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const lineCount = text.split(/\r?\n/).filter((l) => l.trim()).length

  return (
    <form action={formAction} className="card p-5 space-y-3">
      <input type="hidden" name="list_id" value={listId} />

      <div>
        <h2 className="font-bold text-gray-700 mb-1">Add players in bulk</h2>
        <p className="text-xs text-gray-500">
          Paste straight from Google Sheets or Excel — select the cells, copy, paste below. Or pick a
          CSV. One player per line: <b>Name, Number, Position, Grad year</b>. Only the name is
          required, so a plain list of names works.
        </p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.txt,text/csv,text/plain"
          className="text-xs"
          onChange={async (e) => {
            const file = e.target.files?.[0]
            if (!file) return
            setText(await file.text())
          }}
        />
        {text && (
          <button
            type="button"
            className="text-xs font-bold text-gray-500 hover:text-gray-800"
            onClick={() => {
              setText('')
              if (fileRef.current) fileRef.current.value = ''
            }}
          >
            Clear
          </button>
        )}
      </div>

      <textarea
        name="paste"
        rows={8}
        className="field font-mono text-xs"
        placeholder={'Jack Nolan\t12\tAttack\t2027\nSam Rivera\t5\tMidfield\t2028'}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />

      <div className="flex items-end gap-3 flex-wrap">
        <div>
          <label className="field-label">Add new players to</label>
          <select name="team" defaultValue="boys_varsity" className="field">
            {Object.entries(TEAM_LABELS)
              .filter(([v]) => v !== 'girls')
              .map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <SubmitButton pendingText="Importing…">
          {lineCount > 0 ? `Import ${lineCount} ${lineCount === 1 ? 'player' : 'players'}` : 'Import players'}
        </SubmitButton>
      </div>

      <p className="text-xs text-gray-400">
        New names are added as <b>inactive</b>, so nobody appears on the public roster until you mark
        them active. A name already in the system joins this roster instead of being duplicated.
      </p>

      {state.error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
          {state.error}
        </div>
      )}
      {state.ok && (
        <div className="bg-green-50 border border-green-200 text-green-800 text-sm rounded-lg px-3 py-2 font-semibold">
          Added {state.added} new {state.added === 1 ? 'player' : 'players'}
          {state.matched ? `, and matched ${state.matched} already in the system` : ''}.
        </div>
      )}
    </form>
  )
}
