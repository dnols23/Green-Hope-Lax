'use client'
import Link from 'next/link'
import { useActionState } from 'react'
import { teamLogin, type FormState } from '@/lib/actions'
import { SubmitButton } from '@/components/SubmitButton'
import { FalconBadge } from '@/components/Logo'

const initial: FormState = { ok: false }

export default function TeamLoginPage() {
  const [state, formAction] = useActionState(teamLogin, initial)

  return (
    <div className="min-h-screen flex items-center justify-center px-4 hero-gradient">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <FalconBadge size={96} className="mx-auto mb-4" />
          <h1 className="text-2xl font-black text-white">Falcons Team Hub</h1>
          <p className="text-white/70 text-sm mt-1">Private feed for Falcons parents &amp; players</p>
        </div>

        <form action={formAction} className="bg-white rounded-xl p-6 space-y-4">
          <div>
            <label className="field-label">Team password</label>
            <input
              name="password"
              type="password"
              required
              autoFocus
              autoComplete="current-password"
              className="field"
              placeholder="Enter the team password"
            />
          </div>
          {state.error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
              {state.error}
            </div>
          )}
          <SubmitButton pendingText="Checking…">Enter Team Hub</SubmitButton>
          <p className="text-xs text-gray-400 text-center">
            Don’t have the password? Ask a coach — it’s shared with the team.
          </p>
        </form>

        <p className="text-center mt-4">
          <Link href="/" className="text-sm font-semibold text-white/80 hover:text-white">← Back to main site</Link>
        </p>
      </div>
    </div>
  )
}
