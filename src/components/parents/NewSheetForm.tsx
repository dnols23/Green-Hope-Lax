'use client'
import { useActionState } from 'react'
import { newSheet } from '@/lib/parentActions'
import type { FormState } from '@/lib/actions'
import { SubmitButton } from '@/components/SubmitButton'

const initial: FormState = { ok: false }

/**
 * Make a sign-up sheet.
 *
 * The slots are a textarea rather than a row-adding widget: a team parent
 * writing "Water, 2" and "Oranges, 2" gets there faster by typing the list they
 * already have in their head than by clicking Add Row six times.
 */
export function NewSheetForm({ from }: { from: 'admin' | 'hub' }) {
  const [state, formAction] = useActionState(newSheet, initial)

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="from" value={from} />
      <div>
        <label className="field-label">What is it for? *</label>
        <input
          name="title"
          required
          className="field"
          placeholder="Barton College Playday — what we need"
        />
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="field-label">Date &amp; time</label>
          <input type="datetime-local" name="event_date" className="field" />
        </div>
        <div>
          <label className="field-label">Where</label>
          <input name="location" className="field" placeholder="Barton College, Wilson NC" />
        </div>
      </div>
      <div>
        <label className="field-label">Anything parents should know</label>
        <textarea name="description" rows={2} className="field" />
      </div>
      <div>
        <label className="field-label">The spots — one per line</label>
        <textarea
          name="slots"
          rows={6}
          className="field font-mono text-sm"
          placeholder={'Water & Gatorade | 2\nOranges and snacks | 2 | enough for 25 kids\nPop-up tent\nWork the table | 3'}
        />
        <p className="text-xs text-gray-400 mt-1">
          <strong>Job | how many | extra detail.</strong> The last two are optional — a line on
          its own is one spot.
        </p>
      </div>
      {state.error && <p className="text-sm font-semibold text-[var(--gh-maroon)]">{state.error}</p>}
      <SubmitButton className="btn btn-primary">Create the sign-up</SubmitButton>
    </form>
  )
}
