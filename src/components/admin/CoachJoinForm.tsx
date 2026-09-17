'use client'
import { useActionState } from 'react'
import { joinAsCoach } from '@/lib/joinActions'
import type { FormState } from '@/lib/actions'
import { SubmitButton } from '@/components/SubmitButton'
import { PasswordField } from '@/components/PasswordField'

const initial: FormState = { ok: false }

export function CoachJoinForm({ token }: { token: string }) {
  const [state, formAction] = useActionState(joinAsCoach, initial)

  return (
    <form action={formAction} className="bg-white rounded-xl p-6 space-y-4">
      <input type="hidden" name="join_token" value={token} />
      <div>
        <label className="field-label">Your name</label>
        <input name="name" required className="field" autoComplete="name" />
      </div>
      <div>
        <label className="field-label">Email</label>
        <input name="email" type="email" required className="field" autoComplete="email" autoCapitalize="none" />
      </div>
      <PasswordField
        name="password"
        label="Pick a password"
        placeholder="At least 8 characters"
        required
        minLength={8}
        autoComplete="new-password"
      />
      {state.error && <p className="text-sm font-semibold text-[var(--gh-maroon)]">{state.error}</p>}
      <SubmitButton>Create my coach account</SubmitButton>
      <p className="text-xs text-gray-400">
        You start with assistant access: the Coaches Hub, the planner and the drill bank. Rosters,
        evaluations and anything else are the head coach&rsquo;s to hand out.
      </p>
    </form>
  )
}
