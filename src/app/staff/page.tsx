'use client'
import { useState, useTransition } from 'react'
import { login } from '@/lib/actions'
import { FalconHead } from '@/components/Logo'
import { PasswordField } from '@/components/PasswordField'

// The coaching staff's door, separate from the owner's /admin/login. Both run the
// same Supabase sign-in — what a coach may actually open is decided by their
// permissions, not by which door they came through, so this page is branding and
// a friendlier landing rather than a second security boundary.
export default function StaffSignIn() {
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    startTransition(async () => {
      const res = await login(form)
      if (res?.error) setError(res.error)
    })
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'var(--gh-green-dk)' }}
    >
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <FalconHead size={52} className="mx-auto" />
          <h1 className="text-white text-2xl font-black mt-3">Falcons Coaches</h1>
          <p className="text-white/60 text-sm">Sign in to the coaching staff area</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl p-6 space-y-4">
          <div>
            <label className="field-label">Username</label>
            <input
              name="username"
              required
              autoCapitalize="none"
              autoCorrect="off"
              className="field"
            />
          </div>
          <PasswordField name="password" label="Password" required autoComplete="current-password" />

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={pending}
            className="btn btn-primary w-full disabled:opacity-60"
          >
            {pending ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p className="text-center text-white/50 text-xs mt-4">
          Need an account? Ask the head coach to set one up.
        </p>
      </div>
    </div>
  )
}
