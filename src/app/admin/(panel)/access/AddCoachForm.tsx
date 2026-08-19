'use client'
import { useActionState, useState } from 'react'
import { createCoachAccount } from '@/lib/actions'
import { SubmitButton } from '@/components/SubmitButton'
import { PasswordField } from '@/components/PasswordField'
import { GRANTABLE } from '@/lib/sections'

type State = {
  ok: boolean
  error?: string
  email?: string
  password?: string
  outcome?: 'generated' | 'chosen' | 'linked'
}
const initial: State = { ok: false }

export function AddCoachForm({ loginUrl }: { loginUrl: string }) {
  const [state, formAction] = useActionState(createCoachAccount, initial)
  const [copied, setCopied] = useState(false)

  if (state.ok) {
    const handover = `You're set up on the Falcons coaches site.

Sign in: ${loginUrl}
Username: ${state.email}${state.password ? `\nPassword: ${state.password}` : ''}
${state.outcome === 'generated' ? "\nYou'll be asked to pick your own password the first time you sign in." : ''}`

    return (
      <div className="card p-5 mb-6 border-2" style={{ borderColor: 'var(--gh-green)' }}>
        <h2 className="font-black mb-1" style={{ color: 'var(--gh-green-dk)' }}>
          {state.outcome === 'linked' ? `${state.email} added` : `Account ready for ${state.email}`}
        </h2>

        <p className="text-sm text-gray-600 mb-3">
          {state.outcome === 'linked' &&
            'They already had a sign-in, so nothing was created and their password is unchanged.'}
          {state.outcome === 'chosen' &&
            'They sign in with the password you set. Nothing else to do — tick their access below any time.'}
          {state.outcome === 'generated' &&
            "Copy this now — it can't be shown again. They'll pick their own password the first time they sign in."}
        </p>

        {state.password && (
          <div className="flex items-center gap-3 flex-wrap mb-4">
            <code className="text-lg font-black tracking-wider px-3 py-2 rounded bg-gray-50 border border-gray-200">
              {state.password}
            </code>
          </div>
        )}

        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            className="btn btn-primary text-sm"
            onClick={async () => {
              await navigator.clipboard.writeText(handover)
              setCopied(true)
              setTimeout(() => setCopied(false), 2000)
            }}
          >
            {copied ? 'Copied' : 'Copy sign-in instructions'}
          </button>
          <a href="/admin/access" className="text-sm font-bold text-[var(--gh-green)]">
            Add another coach &rarr;
          </a>
        </div>
      </div>
    )
  }

  return (
    <form action={formAction} className="card p-5 mb-6">
      <h2 className="font-bold text-gray-700 mb-1">Add a coach</h2>
      <p className="text-xs text-gray-500 mb-4">
        Set their username and password here and tell them what it is. If they already have a
        login, this records them without changing anything &mdash; unless you type a new password.
      </p>

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="field-label">Username</label>
          <input name="email" required placeholder="coachsmith" className="field" />
          <p className="text-xs text-gray-400 mt-1">
            Becomes <code>username@ghfalcons.local</code> behind the scenes. They only type the
            username.
          </p>
        </div>
        <div>
          <label className="field-label">Display name</label>
          <input name="display_name" placeholder="Coach Smith" className="field" />
        </div>
        <div>
          <PasswordField
            name="password"
            label="Password"
            placeholder="Leave blank to generate one"
            minLength={8}
            autoComplete="new-password"
            hint="At least 8 characters. Blank generates one and makes them change it on first sign-in."
          />
        </div>
        <div>
          <label className="field-label">Evaluation role</label>
          <select name="role" defaultValue="assistant" className="field">
            <option value="assistant">Assistant — sees only their own evaluations</option>
            <option value="head">Head — sees the compiled board</option>
          </select>
        </div>
      </div>

      <fieldset className="mt-4">
        <legend className="field-label">Pages they can open</legend>
        <p className="text-xs text-gray-500 mb-2">
          Every coach gets the Coaches Hub and Film Room. Tick anything else.
        </p>
        <div className="grid sm:grid-cols-3 gap-2">
          {GRANTABLE.map((s) => (
            <label key={s.key} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="permissions" value={s.key} />
              {s.label}
            </label>
          ))}
        </div>
      </fieldset>

      {state.error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2 mt-4">
          {state.error}
        </div>
      )}

      <div className="mt-4">
        <SubmitButton pendingText="Saving…">Save coach</SubmitButton>
      </div>
    </form>
  )
}
