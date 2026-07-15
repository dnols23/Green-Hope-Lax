import Link from 'next/link'
import { requireHeadCoach } from '@/lib/coach'
import { createServiceClient } from '@/lib/supabase-server'
import { setCoachRole } from '@/lib/actions'
import type { CoachAccount } from '@/lib/evaluations'

export const metadata = { title: 'Coaches & Roles' }

export default async function CoachesRoles() {
  await requireHeadCoach() // assistants → 404

  const svc = createServiceClient()
  const { data } = await svc.from('coach_accounts').select('*').order('role', { ascending: true }).order('display_name', { ascending: true })
  const coaches = (data as CoachAccount[]) ?? []

  return (
    <div className="max-w-2xl">
      <Link href="/admin/hub" className="text-sm font-bold text-[var(--gh-green)]">← Coaches Hub</Link>
      <div className="flex items-center gap-2 mt-2 mb-1">
        <h1 className="text-xl font-black">Coaches &amp; Roles</h1>
        <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: '#fde8ea', color: 'var(--gh-maroon)' }}>Head coach only</span>
      </div>
      <p className="text-gray-500 text-sm mb-6">
        Label your coaches and set who’s Head vs Assistant. The <strong>Head</strong> coach sees the compiled board;
        assistants only see their own evaluations.
      </p>

      {/* Add a coach */}
      <div className="card p-5 mb-6">
        <h2 className="font-bold text-gray-700 mb-1">Add a coach</h2>
        <p className="text-xs text-gray-400 mb-4">
          First create their login in Supabase → Authentication (email <code>username@ghfalcons.local</code>), then add them here.
        </p>
        <form action={setCoachRole} className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="field-label">Login email</label>
            <input name="email" required placeholder="coachsmith@ghfalcons.local" className="field" />
          </div>
          <div>
            <label className="field-label">Display name</label>
            <input name="display_name" placeholder="Coach Smith" className="field" />
          </div>
          <div>
            <label className="field-label">Role</label>
            <select name="role" defaultValue="assistant" className="field">
              <option value="assistant">Assistant Coach</option>
              <option value="head">Head Coach</option>
            </select>
          </div>
          <div className="flex items-end">
            <button type="submit" className="btn btn-primary">Add coach</button>
          </div>
        </form>
      </div>

      {/* Existing coaches */}
      <h2 className="font-bold text-gray-700 mb-3">Coaches ({coaches.length})</h2>
      {coaches.length === 0 ? (
        <div className="card p-6 text-sm text-gray-500">No coach accounts yet. Add one above.</div>
      ) : (
        <div className="space-y-2">
          {coaches.map((c) => (
            <form key={c.email} action={setCoachRole} className="card p-3 flex items-center gap-3 flex-wrap">
              <input type="hidden" name="email" value={c.email} />
              <div className="min-w-0 flex-1">
                <input name="display_name" defaultValue={c.display_name} className="field !py-1.5 font-semibold" />
                <div className="text-xs text-gray-400 mt-1">{c.email}</div>
              </div>
              <select name="role" defaultValue={c.role} className="field !py-1.5 max-w-[10rem]">
                <option value="assistant">Assistant</option>
                <option value="head">Head Coach</option>
              </select>
              <button type="submit" className="btn btn-ghost !py-1.5 !px-3 text-sm">Save</button>
            </form>
          ))}
        </div>
      )}
    </div>
  )
}
