'use client'

import { useActionState, useRef, useState, useTransition, type FormEvent } from 'react'
import { savePlan } from '@/lib/actions'
import type { FormState } from '@/lib/actions'
import type { Plan } from '@/lib/planner'
import { readNoteBlocks, type NoteBlock } from '@/lib/noteBlocks'
import { NoteEditor } from '@/components/planner/NoteEditor'
import { AutosaveNote, useAutosave } from '@/components/planner/useAutosave'

const EMPTY: FormState = { ok: true }

/**
 * A note: a title, a page, and a date if it has one. Notes live in their own
 * part of the hub, apart from the practices and game plans, and save as you go
 * like everything in the planner.
 */
export function NoteDocEditor({ plan, canWrite = true }: { plan: Plan; canWrite?: boolean }) {
  const [state, save, saving] = useActionState(savePlan, EMPTY)
  const [, startSave] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)
  const autosave = useAutosave(formRef, canWrite)
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    startSave(() => save(data))
  }
  const [title, setTitle] = useState(plan.title)
  const [date, setDate] = useState(plan.plan_date ?? '')
  const [content, setContent] = useState<NoteBlock[]>(() => readNoteBlocks(plan.content))

  return (
    <form ref={formRef} onSubmit={submit}>
      <input type="hidden" name="id" value={plan.id} />
      <input type="hidden" name="blocks" value="[]" />
      <input type="hidden" name="content" value={JSON.stringify(content)} />
      <input type="hidden" name="season" value={plan.season ?? ''} />
      <input type="hidden" name="roster_id" value="" />
      <input type="hidden" name="summary" value={plan.summary ?? ''} />

      <div className="card p-4">
        <input
          name="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="field !text-lg !font-black !py-2 mb-4"
          placeholder="What is this about?"
          required
        />

        <NoteEditor blocks={content} onChange={setContent} />

        <div className="flex items-center gap-3 mt-4 pt-3 border-t border-gray-100 flex-wrap">
          <div>
            <label className="field-label">Date</label>
            <input
              type="date"
              name="plan_date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="field !py-1.5 !w-auto"
            />
          </div>
          <span className="ml-auto">
            <AutosaveNote state={autosave} />
          </span>
          <button type="submit" disabled={saving || !canWrite} className="btn btn-primary !py-1.5 disabled:opacity-60">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
        {state.error && <p className="text-sm text-red-700 mt-2">{state.error}</p>}
        {state.ok && state.message && !saving && <p className="text-sm text-green-700 mt-2">{state.message}</p>}
      </div>
    </form>
  )
}
