import Link from 'next/link'
import { requireSection } from '@/lib/permissions'
import { ensureJoinToken, listParents, parentHubReady } from '@/lib/parentAccess'
import { getSheet, listSheets, spotsLeft } from '@/lib/signupSheets'
import { NewSheetForm } from '@/components/parents/NewSheetForm'
import { JoinLinkPanel } from '@/components/parents/JoinLinkPanel'
import { DeleteButton } from '@/components/admin/DeleteButton'
import { deleteParent, newJoinLink, removeSheet, toggleSheet, toggleTeamParent } from '@/lib/parentActions'
import { formatDateTime, formatShortDate } from '@/lib/format'

export const metadata = { title: 'Parent Hub' }
export const dynamic = 'force-dynamic'

export default async function AdminParentsPage() {
  await requireSection('parents')

  if (!(await parentHubReady())) {
    return (
      <div className="card p-6">
        <h1 className="text-xl font-black mb-2">Parent Hub</h1>
        <p className="text-gray-600">
          Run <code className="font-mono text-sm">0024_parent_hub.sql</code> in Supabase and this
          screen comes to life.
        </p>
      </div>
    )
  }

  const [token, parents, sheets] = await Promise.all([ensureJoinToken(), listParents(), listSheets(true)])
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://greenhopelacrosse.com'
  const joinUrl = token ? `${base}/parents/join/${token}` : ''

  const withCounts = await Promise.all(
    sheets.map(async (s) => {
      const full = await getSheet(s.id)
      return {
        sheet: s,
        left: full ? spotsLeft(full) : 0,
        taken: full ? full.slots.reduce((n, sl) => n + sl.claims.length, 0) : 0,
        claims: full?.slots.flatMap((sl) => sl.claims.map((c) => ({ ...c, slot: sl.label }))) ?? [],
      }
    })
  )

  const teamParents = parents.filter((p) => p.is_team_parent)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-black mb-1">Parent Hub</h1>
        <p className="text-gray-500 text-sm">
          The parents&rsquo; side of the program:{' '}
          <Link href="/parents" target="_blank" className="text-[var(--gh-green)] font-semibold">
            /parents ↗
          </Link>
          . Sign-up sheets, and nothing else for now.
        </p>
      </div>

      {/* ── The link that goes in the team email ── */}
      <section className="card p-5">
        <h2 className="font-bold text-gray-700 mb-1">The link for your team email</h2>
        <p className="text-sm text-gray-500 mb-3">
          Paste this into the email. A parent follows it once, types their name, and is in from
          then on — on that device, without a password. Anyone who forwards it can get in too,
          so if it travels further than you meant, make a new one: everybody already registered
          keeps their access.
        </p>
        {joinUrl ? (
          <JoinLinkPanel joinUrl={joinUrl} />
        ) : (
          <p className="text-sm text-[var(--gh-maroon)]">Could not read the link. Check Supabase.</p>
        )}
        <form action={newJoinLink} className="mt-3">
          <button type="submit" className="btn btn-ghost">Make a new link</button>
        </form>
      </section>

      {/* ── Create a sheet ── */}
      <section className="card p-5">
        <h2 className="font-bold text-gray-700 mb-4">New sign-up sheet</h2>
        <NewSheetForm from="admin" />
      </section>

      {/* ── Sheets ── */}
      <section>
        <h2 className="font-bold text-gray-700 mb-3">Sign-ups ({sheets.length})</h2>
        <div className="space-y-2">
          {withCounts.length === 0 && (
            <p className="card p-5 text-sm text-gray-500">No sign-up sheets yet.</p>
          )}
          {withCounts.map(({ sheet, left, taken, claims }) => (
            <details key={sheet.id} className="card p-4">
              <summary className="flex items-center justify-between cursor-pointer list-none gap-3">
                <span className="font-semibold">
                  {sheet.title}
                  <span className="ml-2 text-xs text-gray-400">
                    {sheet.event_date ? formatShortDate(sheet.event_date) : 'no date'} · {taken} filled ·{' '}
                    {left} open
                  </span>
                </span>
                <span className="flex items-center gap-3">
                  <form action={toggleSheet}>
                    <input type="hidden" name="id" value={sheet.id} />
                    <input type="hidden" name="open" value={String(!sheet.is_open)} />
                    <button
                      type="submit"
                      className="text-xs font-bold px-2.5 py-1 rounded-full border"
                      style={
                        sheet.is_open
                          ? { background: '#dcfce7', color: '#15803d', borderColor: '#86efac' }
                          : { background: '#f3f4f6', color: '#6b7280', borderColor: '#d1d5db' }
                      }
                    >
                      {sheet.is_open ? '● Open' : '○ Closed'}
                    </button>
                  </form>
                  <DeleteButton id={sheet.id} action={removeSheet} />
                </span>
              </summary>

              <div className="mt-4">
                {claims.length === 0 ? (
                  <p className="text-sm text-gray-500">Nobody has signed up yet.</p>
                ) : (
                  <div className="table-scroll">
                    <table className="data-table">
                      <thead>
                        <tr><th>Spot</th><th>Who</th><th>Email</th><th>Note</th><th>Signed up</th></tr>
                      </thead>
                      <tbody>
                        {claims.map((c) => (
                          <tr key={c.id}>
                            <td className="font-semibold">{c.slot}</td>
                            <td className="whitespace-nowrap">{c.name}</td>
                            <td>
                              {c.email ? (
                                <a href={`mailto:${c.email}`} className="text-[var(--gh-green)]">{c.email}</a>
                              ) : '—'}
                            </td>
                            <td className="text-gray-600">{c.note || '—'}</td>
                            <td className="whitespace-nowrap text-gray-500">{formatDateTime(c.created_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <Link
                  href={`/parents/s/${sheet.id}`}
                  target="_blank"
                  className="inline-block mt-3 text-sm font-semibold text-[var(--gh-green)]"
                >
                  See it as a parent does ↗
                </Link>
              </div>
            </details>
          ))}
        </div>
      </section>

      {/* ── Parents ── */}
      <section>
        <h2 className="font-bold text-gray-700 mb-1">
          Parents ({parents.length})
          {teamParents.length > 0 && (
            <span className="ml-2 text-xs font-normal text-gray-400">
              {teamParents.length} team parent{teamParents.length === 1 ? '' : 's'}
            </span>
          )}
        </h2>
        <p className="text-xs text-gray-500 mb-3">
          A <strong>team parent</strong> can create sign-up sheets from inside the hub, so that
          job stops coming back to you.
        </p>
        {parents.length === 0 ? (
          <p className="card p-5 text-sm text-gray-500">
            Nobody has followed the link yet. Send the email above.
          </p>
        ) : (
          <div className="card table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Parent</th><th>Email</th><th>Phone</th><th>Player</th><th>Joined</th>
                  <th>Team parent</th><th className="col-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {parents.map((p) => (
                  <tr key={p.id}>
                    <td className="font-semibold whitespace-nowrap">{p.name}</td>
                    <td><a href={`mailto:${p.email}`} className="text-[var(--gh-green)]">{p.email}</a></td>
                    <td className="whitespace-nowrap">{p.phone ?? '—'}</td>
                    <td className="whitespace-nowrap">{p.player_name ?? '—'}</td>
                    <td className="whitespace-nowrap text-gray-500">{formatShortDate(p.created_at)}</td>
                    <td>
                      <form action={toggleTeamParent}>
                        <input type="hidden" name="id" value={p.id} />
                        <input type="hidden" name="on" value={String(!p.is_team_parent)} />
                        <button
                          type="submit"
                          className="text-xs font-bold px-2.5 py-1 rounded-full border"
                          style={
                            p.is_team_parent
                              ? { background: '#dcfce7', color: '#15803d', borderColor: '#86efac' }
                              : { background: '#f3f4f6', color: '#6b7280', borderColor: '#d1d5db' }
                          }
                        >
                          {p.is_team_parent ? '★ Team parent' : '☆ Make team parent'}
                        </button>
                      </form>
                    </td>
                    <td className="col-actions">
                      <DeleteButton id={p.id} action={deleteParent} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
