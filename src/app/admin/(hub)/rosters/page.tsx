import Link from 'next/link'
import { requireSection } from '@/lib/permissions'
import { listRosters, rostersReady, playersOnNoRoster } from '@/lib/rosters'
import { createRoster, setRosterPublic, setRosterArchived } from '@/lib/actions'
import { AdoptCard } from './AdoptCard'

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

  const [rosters, loose] = await Promise.all([listRosters(true), playersOnNoRoster()])
  const live = rosters.filter((r) => !r.is_archived)
  const archived = rosters.filter((r) => r.is_archived)
  // The public page still runs off the players marked active until a roster is
  // published, so say so rather than reporting an empty screen.
  const published = rosters.find((r) => r.is_public)
  // Players who exist but aren't on any roster — last season's squad, before it
  // was ever a roster, or anyone added straight to the player list.
  const unadopted = loose.length > 0

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-xl font-black mb-1">Rosters</h1>
        <p className="text-gray-500 text-sm">
          Your own lists — a season squad, a tryout group, an off-season group. Coaches evaluate
          through these, and none of them reach the{' '}
          <Link href="/roster" target="_blank" className="text-[var(--gh-green)] font-semibold">
            public roster ↗
          </Link>{' '}
          unless you publish them. Publish one and it is the roster; publish several and visitors
          pick between them by name.
        </p>
      </div>

      {!published && !unadopted && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm text-amber-900 font-bold mb-1">No roster is published.</p>
          <p className="text-sm text-amber-900">
            The public roster page is empty until you open a roster and tick{' '}
            <b>Publish this roster to the public site</b>. Everything you build here stays between
            the coaches and the Team Hub until then.
          </p>
        </div>
      )}

      {unadopted && <AdoptCard count={loose.length} published={Boolean(published)} />}

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
            {unadopted
              ? 'No rosters here yet — the public roster above is still a plain list of players. Adopt it, or create a separate one.'
              : 'No rosters yet. Create one above, then paste your players into it.'}
          </div>
        ) : (
          <div className="space-y-2">
            {live.map((r) => (
              <div key={r.id} className="card p-4 flex items-center justify-between gap-3">
                <Link href={`/admin/rosters/${r.id}`} className="min-w-0 flex-1 group">
                  <div className="font-bold flex items-center gap-2 flex-wrap group-hover:underline">
                    {r.name}
                    {r.is_public && <span className="badge badge-win">On the public site</span>}
                  </div>
                  <div className="text-xs text-gray-500">
                    {[r.season, r.notes].filter(Boolean).join(' · ') || 'No season set'}
                  </div>
                </Link>
                <div className="text-right shrink-0">
                  <div className="text-2xl font-black" style={{ color: 'var(--gh-green)' }}>{r.memberCount}</div>
                  <div className="text-xs text-gray-400">players</div>
                </div>
                {/* The two things you come to this page to change, on the page
                    rather than three clicks inside the roster. */}
                <div className="shrink-0 flex items-center gap-2">
                  <form action={setRosterPublic}>
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="public" value={r.is_public ? 'false' : 'true'} />
                    <button
                      type="submit"
                      className={`btn text-xs !py-1.5 !px-3 ${r.is_public ? 'btn-ghost' : 'btn-primary'}`}
                    >
                      {r.is_public ? 'Take off public site' : 'Publish'}
                    </button>
                  </form>
                  <form action={setRosterArchived}>
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="archived" value="true" />
                    <button
                      type="submit"
                      title={
                        r.is_public
                          ? 'Puts the season away and takes it off the public site. Nothing is deleted.'
                          : 'Puts the season away. It leaves the dropdowns; nothing is deleted.'
                      }
                      className="text-xs font-semibold text-gray-400 hover:text-gray-700"
                    >
                      Archive
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {archived.length > 0 && (
        <section>
          <h2 className="font-bold text-gray-700 mb-1">Seasons put away ({archived.length})</h2>
          <p className="text-xs text-gray-400 mb-3">
            Still here, still readable, out of every dropdown. Last year&rsquo;s evaluations and the
            plans that ran off these are untouched.
          </p>
          <div className="space-y-2">
            {archived.map((r) => (
              <div key={r.id} className="card p-3 flex items-center justify-between gap-3">
                <Link href={`/admin/rosters/${r.id}`} className="min-w-0 flex-1 hover:underline">
                  <span className="font-semibold text-sm text-gray-500">{r.name}</span>
                  {r.season && <span className="text-xs text-gray-400 ml-2">{r.season}</span>}
                </Link>
                <span className="text-xs text-gray-400 shrink-0">{r.memberCount} players</span>
                <form action={setRosterArchived} className="shrink-0">
                  <input type="hidden" name="id" value={r.id} />
                  <input type="hidden" name="archived" value="false" />
                  <button
                    type="submit"
                    className="text-xs font-semibold text-[var(--gh-green)]"
                    title="Back into the dropdowns"
                  >
                    Bring back
                  </button>
                </form>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
