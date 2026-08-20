import Link from 'next/link'
import { requireSection } from '@/lib/permissions'
import { listRosters, rostersReady } from '@/lib/rosters'
import { createRoster } from '@/lib/actions'

export const metadata = { title: 'Rosters' }
export const dynamic = 'force-dynamic'

export default async function RostersPage() {
  await requireSection('rosters')

  if (!(await rostersReady())) {
    return (
      <div className="max-w-2xl">
        <h1 className="text-xl font-black mb-1">Rosters</h1>
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 mt-4">
          <p className="text-sm text-amber-900 font-bold mb-1">Rosters aren&rsquo;t switched on yet.</p>
          <p className="text-sm text-amber-900">
            Run <code>supabase/migrations/0013_player_lists.sql</code> in the Supabase SQL editor and
            this page starts working. Nothing else on the site is affected.
          </p>
        </div>
      </div>
    )
  }

  const rosters = await listRosters(true)
  const live = rosters.filter((r) => !r.is_archived)
  const archived = rosters.filter((r) => r.is_archived)

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-xl font-black mb-1">Rosters</h1>
        <p className="text-gray-500 text-sm">
          Your own lists — a season squad, a tryout group, fall ball. Coaches evaluate through these,
          and none of them reach the{' '}
          <Link href="/roster" target="_blank" className="text-[var(--gh-green)] font-semibold">
            public roster ↗
          </Link>{' '}
          unless you publish one. Open a roster and tick <b>Publish this roster to the public site</b>
          {' '}to make it the public list.
        </p>
      </div>

      <section className="card p-5">
        <h2 className="font-bold text-gray-700 mb-4">New roster</h2>
        <form action={createRoster} className="grid sm:grid-cols-3 gap-3 items-end">
          <div className="sm:col-span-2">
            <label className="field-label">Name *</label>
            <input name="name" required className="field" placeholder="2026 Tryouts" />
          </div>
          <div>
            <label className="field-label">Season</label>
            <input name="season" className="field" placeholder="2025-2026" />
          </div>
          <div className="sm:col-span-3">
            <label className="field-label">Notes</label>
            <input name="notes" className="field" placeholder="Who this list is for…" />
          </div>
          <div>
            <button type="submit" className="btn btn-primary">Create roster</button>
          </div>
        </form>
      </section>

      <section>
        <h2 className="font-bold text-gray-700 mb-3">Your rosters ({live.length})</h2>
        {live.length === 0 ? (
          <div className="card p-6 text-sm text-gray-500">
            No rosters yet. Create one above, then paste your players into it.
          </div>
        ) : (
          <div className="space-y-2">
            {live.map((r) => (
              <Link key={r.id} href={`/admin/rosters/${r.id}`} className="card p-4 flex items-center justify-between gap-3 hover:shadow-md transition-shadow">
                <div>
                  <div className="font-bold flex items-center gap-2 flex-wrap">
                    {r.name}
                    {r.is_public && <span className="badge badge-win">On the public site</span>}
                  </div>
                  <div className="text-xs text-gray-500">
                    {[r.season, r.notes].filter(Boolean).join(' · ') || 'No season set'}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-2xl font-black" style={{ color: 'var(--gh-green)' }}>{r.memberCount}</div>
                  <div className="text-xs text-gray-400">players</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {archived.length > 0 && (
        <section>
          <h2 className="font-bold text-gray-700 mb-3">Archived ({archived.length})</h2>
          <div className="space-y-2">
            {archived.map((r) => (
              <Link key={r.id} href={`/admin/rosters/${r.id}`} className="card p-3 flex items-center justify-between gap-3 opacity-70">
                <span className="font-semibold text-sm">{r.name}</span>
                <span className="text-xs text-gray-400">{r.memberCount} players</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
