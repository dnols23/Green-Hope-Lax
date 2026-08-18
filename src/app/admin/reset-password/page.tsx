'use client'
import { useActionState } from 'react'
import { resetCoachPassword, type FormState } from '@/lib/actions'
import { SubmitButton } from '@/components/SubmitButton'
import { FalconHead } from '@/components/Logo'
import { PasswordField } from '@/components/PasswordField'

const initial: FormState = { ok: false }

export default function ResetPasswordPage() {
  const [state, formAction] = useActionState(resetCoachPassword, initial)

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--gh-green-darker)' }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-6 text-white">
          <FalconHead size={48} className="mx-auto mb-3" />
          <h1 className="text-2xl font-black">Choose your password</h1>
          <p className="text-white/70 text-sm mt-1">
            Welcome, Coach! Set a personal password to finish setting up your account.
          </p>
        </div>

        <form action={formAction} className="bg-white rounded-xl p-6 space-y-4">
          <div>
            <PasswordField name="password" label="New password" required minLength={8} autoComplete="new-password" />
          </div>
          <div>
            <PasswordField name="confirm" label="Confirm new password" required minLength={8} autoComplete="new-password" />
          </div>
          {state.error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
              {state.error}
            </div>
          )}
          <SubmitButton pendingText="Saving…">Save password &amp; continue</SubmitButton>
          <p className="text-xs text-gray-400 text-center">At least 8 characters.</p>
        </form>
      </div>
    </div>
  )
}
