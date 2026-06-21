'use client'
import { useState, useTransition } from 'react'
import { login } from '@/lib/actions'
import { FalconHead } from '@/components/Logo'

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await login(fd)
      if (result?.error) setError(result.error)
    })
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--gh-green-darker)' }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8 text-white">
          <FalconHead size={56} className="mx-auto mb-3" />
          <h1 className="text-2xl font-black">Falcons Admin</h1>
          <p className="text-white/60 text-sm mt-1">Sign in to manage the site</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl p-6 space-y-4">
          <div>
            <label className="field-label">Username</label>
            <input name="username" type="text" required autoCapitalize="none" autoComplete="username" className="field" placeholder="e.g. HCNolan" />
          </div>
          <div>
            <label className="field-label">Password</label>
            <input name="password" type="password" required autoComplete="current-password" className="field" />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <button type="submit" disabled={pending} className="btn btn-primary w-full disabled:opacity-60">
            {pending ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p className="text-center text-xs text-white/40 mt-4">
          Admin accounts are created in the Supabase dashboard.
        </p>
      </div>
    </div>
  )
}
