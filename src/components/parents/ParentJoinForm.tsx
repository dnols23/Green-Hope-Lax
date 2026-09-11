'use client'
import { useActionState } from 'react'
import { joinParentHub } from '@/lib/parentActions'
import type { FormState } from '@/lib/actions'
import { SubmitButton } from '@/components/SubmitButton'

const initial: FormState = { ok: false }

export function ParentJoinForm({ token }: { token: string }) {
  const [state, formAction] = useActionState(joinParentHub, initial)

  return (
    <form action={formAction} className="card p-6 space-y-4">
      <input type="hidden" name="join_token" value={token} />
      <div>
        <label className="field-label">Your name *</label>
        <input name="name" required className="field" autoComplete="name" />
      </div>
      <div>
        <label className="field-label">Email *</label>
        <input name="email" type="email" required className="field" autoComplete="email" />
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="field-label">Phone</label>
          <input name="phone" type="tel" className="field" autoComplete="tel" />
        </div>
        <div>
          <label className="field-label">Your player</label>
          <input name="player_name" className="field" placeholder="Player's name" />
        </div>
      </div>
      {state.error && <p className="text-sm font-semibold text-[var(--gh-maroon)]">{state.error}</p>}
      <SubmitButton>Enter the Parent Hub</SubmitButton>
    </form>
  )
}
