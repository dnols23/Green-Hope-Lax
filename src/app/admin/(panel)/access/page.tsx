import { requireOwner, GRANTABLE } from '@/lib/permissions'
import { listStaff } from '@/lib/staff'
import { setCoachAccess, removeCoachAccount, claimOwnership, setCoachPassword } from '@/lib/actions'
import { PasswordField } from '@/components/PasswordField'
import { AddCoachForm } from './AddCoachForm'

export const metadata = { title: 'Coach Access' }
export const dynamic = 'force-dynamic'

export default async function CoachAccessPage() {
  const me = await requireOwner()
  const coaches = await listStaff()

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://greenhopelacrosse.com'
  const loginUrl = `${site}/staff`

  return (
    <div className="max-w-4xl">
      <h1 className="text-xl font-black mb-1">Coach Access</h1>
      <p className="text-gray-500 text-sm mb-6">
        Coaches sign in at <strong>{loginUrl}</strong> and see only what you tick for them. You sign
        in at <strong>/admin</strong> and see everything. Parents and players use the Team Hub code,
        which is separate from both.
      </p>

      {me.bootstrap && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 mb-6 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm text-amber-900">
            <span className="font-bold">Nobody is the owner yet.</span> Until someone is, anyone who
            signs in gets full access. Claim it and everyone else becomes a coach.
          </p>
          <form action={claimOwnership}>
            <button type="submit" className="btn btn-maroon text-sm">
              Make me the owner
            </button>
          </form>
        </div>
      )}

      <AddCoachForm loginUrl={loginUrl} />

      <h2 className="font-bold text-gray-700 mb-3">Coaching staff ({coaches.length})</h2>
      {coaches.length === 0 ? (
        <div className="card p-6 text-sm text-gray-500">
          No coaches yet. Add one above and hand them the temporary password.
        </div>
      ) : (
        <div className="space-y-3">
          {coaches.map((c) => (
            <div key={c.email} className="card p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
                <div>
                  <div className="font-bold flex items-center gap-2">
                    {c.name}
                    {c.isOwner && (
                      <span
                        className="text-xs font-bold px-2 py-0.5 rounded-full"
                        style={{ background: '#fde8ea', color: 'var(--gh-maroon)' }}
                      >
                        Owner
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500">{c.email}</div>
                </div>
                {!c.isOwner && (
                  <form action={removeCoachAccount}>
                    <input type="hidden" name="email" value={c.email} />
                    <button type="submit" className="text-xs font-bold text-red-600 hover:text-red-800">
                      Remove coach
                    </button>
                  </form>
                )}
              </div>

              {c.isOwner ? (
                <p className="text-sm text-gray-500">Owners reach every page. Nothing to tick.</p>
              ) : (
                <form action={setCoachAccess} className="space-y-3">
                  <input type="hidden" name="email" value={c.email} />
                  <div className="grid sm:grid-cols-3 gap-2">
                    {GRANTABLE.map((s) => (
                      <label key={s.key} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          name="permissions"
                          value={s.key}
                          defaultChecked={c.permissions.includes(s.key)}
                        />
                        {s.label}
                      </label>
                    ))}
                  </div>
                  <div className="flex items-end gap-3 flex-wrap">
                    <div>
                      <label className="field-label">Evaluation role</label>
                      <select name="role" defaultValue={c.role} className="field">
                        <option value="assistant">Assistant</option>
                        <option value="head">Head</option>
                      </select>
                    </div>
                    <button type="submit" className="btn btn-primary text-sm">
                      Save access
                    </button>
                  </div>
                </form>
              )}

              {!c.isOwner && (
                <form
                  action={setCoachPassword}
                  className="flex items-end gap-3 flex-wrap mt-4 pt-4 border-t border-gray-100"
                >
                  <input type="hidden" name="email" value={c.email} />
                  <div className="min-w-[240px]">
                    <PasswordField
                      name="password"
                      label="Set a new password"
                      placeholder="At least 8 characters"
                      minLength={8}
                      autoComplete="new-password"
                    />
                  </div>
                  <button type="submit" className="btn btn-ghost text-sm">
                    Change password
                  </button>
                </form>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
