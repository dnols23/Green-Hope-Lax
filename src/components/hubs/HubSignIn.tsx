'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { signInHub } from '@/lib/hubAccountActions'
import type { HubKind } from '@/lib/hubAccounts'
import { PasswordField } from '@/components/PasswordField'

/** Email and password back into the Team Hub or the Parent Hub. */
export function HubSignIn({ kind, joinHref }: { kind: HubKind; joinHref: string }) {
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setError(null)
    start(async () => {
      const res = await signInHub(kind, String(fd.get('email') ?? ''), String(fd.get('password') ?? ''))
      if (!res.ok) setError(res.error)
    })
  }

  return (
    <div className="space-y-4">
      <form onSubmit={submit} className="card p-5 sm:p-6 space-y-3">
        <div>
          <label htmlFor="hub-email" className="field-label">Email</label>
          <input id="hub-email" name="email" type="email" required autoComplete="email" className="field" />
        </div>
        <PasswordField name="password" label="Password" required autoComplete="current-password" />
        {error && <p className="text-sm font-semibold text-red-700" role="alert">{error}</p>}
        <button type="submit" disabled={pending} className="btn btn-primary w-full justify-center">
          {pending ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <Link href={joinHref} className="btn btn-ghost w-full justify-center">
        New here? Sign up with the {kind === 'player' ? 'team' : 'parent'} code
      </Link>
    </div>
  )
}
