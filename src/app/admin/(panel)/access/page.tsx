import { createServiceClient } from '@/lib/supabase-server'
import { requireOwner, GRANTABLE } from '@/lib/permissions'
import { setCoachAccess, removeCoachAccount } from '@/lib/actions'
import { AddCoachForm } from './AddCoachForm'

export const metadata = { title: 'Coach Access' }
export const dynamic = 'force-dynamic'

interface CoachRow {
  email: string
  display_name: string
  role: 'head' | 'assistant'
  is_owner: boolean
  permissions: string[] | null
}

export default async function CoachAccessPage() {
  const me = await requireOwner()

  const svc = createServiceClient()
  const { data } = await svc
    .from('coach_accounts')
    .select('*')
    .order('is_owner', { ascending: false })
    .order('display_name', { ascending: true })
  const coaches = (data as CoachRow[]) ?? []

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://greenhopelacrosse.com'
  const loginUrl = `${site}/staff`

  return (
    <div className="max-w-4xl">
      <h1 className="text-xl font-black mb-1">Coach Access</h1>
      <p className="text-gray-500 text-sm mb-6">
        Coaches sign in at <strong>{loginUrl}</strong> and see only what you tick here. You sign in
        at <strong>/admin</strong> and see everything. Parents and players use the Team Hub code,
        which is separate from both.
      </p>

      {me.bootstrap && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 mb-6">
          <p className="text-sm text-amber-900">
            <span className="font-bold">No owner is set yet.</span> Everyone signing in is being
            treated as the owner until one exists. Add yourself below (or mark your existing row as
            owner in Supabase) to lock this down.
          </p>
        </div>
      )}

      <AddCoachForm loginUrl={loginUrl} />

      <h2 className="font-bold text-gray-700 mb-3">Coaches ({coaches.length})</h2>
      {coaches.length === 0 ? (
        <div className="card p-6 text-sm text-gray-500">No coach accounts yet.</div>
      ) : (
        <div className="space-y-3">
          {coaches.map((c) => {
            const perms = Array.isArray(c.permissions) ? c.permissions : []
            return (
              <div key={c.email} className="card p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
                  <div>
                    <div className="font-bold flex items-center gap-2">
                      {c.display_name}
                      {c.is_owner && (
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
                  {!c.is_owner && (
                    <form action={removeCoachAccount}>
                      <input type="hidden" name="email" value={c.email} />
                      <button
                        type="submit"
                        className="text-xs font-bold text-red-600 hover:text-red-800"
                      >
                        Remove coach
                      </button>
                    </form>
                  )}
                </div>

                {c.is_owner ? (
                  <p className="text-sm text-gray-500">
                    Owners reach every section. Nothing to tick.
                  </p>
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
                            defaultChecked={perms.includes(s.key)}
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
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
