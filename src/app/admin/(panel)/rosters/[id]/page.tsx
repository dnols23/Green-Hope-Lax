import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireSection } from '@/lib/permissions'
import { getRoster, rosterMembers } from '@/lib/rosters'
import { renameRoster, removePlayerFromRoster, deleteRoster } from '@/lib/actions'
import { DeleteButton } from '@/components/admin/DeleteButton'
import { TEAM_LABELS, type TeamGroup } from '@/lib/types'
import { ImportPlayers } from './ImportPlayers'

export const dynamic = 'force-dynamic'

export default async function RosterDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireSection('rosters')
  const { id } = await params

  const roster = await getRoster(id)
  if (!roster) notFound()
  const players = await rosterMembers(id)

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <Link href="/admin/rosters" className="text-sm font-bold text-[var(--gh-green)]">← Rosters</Link>
        <div className="flex items-center gap-2 mt-2 mb-1 flex-wrap">
          <h1 className="text-xl font-black">{roster.name}</h1>
          {roster.is_public && <span className="badge badge-win">Public</span>}
          {roster.is_archived && <span className="badge badge-sched">Archived</span>}
        </div>
        <p className="text-gray-500 text-sm">
          {players.length} {players.length === 1 ? 'player' : 'players'}
          {roster.season ? ` · ${roster.season}` : ''}
          {roster.notes ? ` · ${roster.notes}` : ''}
        </p>
      </div>

      <ImportPlayers listId={roster.id} />

      <section>
        <h2 className="font-bold text-gray-700 mb-3">On this roster ({players.length})</h2>
        {players.length === 0 ? (
          <div className="card p-6 text-sm text-gray-500">
            Nobody yet. Paste your list above to fill it.
          </div>
        ) : (
          <div className="card table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th><th>Player</th><th>Position</th><th>Grad</th><th>Team</th><th>Public</th>
                  <th className="col-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {players.map((p) => (
                  <tr key={p.id}>
                    <td className="font-black tabular-nums" style={{ color: 'var(--gh-green)' }}>{p.number ?? '–'}</td>
                    <td className="font-semibold whitespace-nowrap">{p.name}</td>
                    <td>{p.position ?? '—'}</td>
                    <td>{p.class_year ?? '—'}</td>
                    <td className="text-gray-500 text-xs">{TEAM_LABELS[p.team as TeamGroup]}</td>
                    <td>
                      <span className={`badge ${p.is_active ? 'badge-win' : 'badge-sched'}`}>
                        {p.is_active ? 'Public' : 'Hidden'}
                      </span>
                    </td>
                    <td className="col-actions">
                      <div className="flex items-center gap-3">
                        <Link href={`/admin/hub/evaluate/${p.id}`} className="text-xs font-bold text-[var(--gh-green)]">
                          Evaluate
                        </Link>
                        <form action={removePlayerFromRoster}>
                          <input type="hidden" name="list_id" value={roster.id} />
                          <input type="hidden" name="player_id" value={p.id} />
                          <button type="submit" className="text-xs font-bold text-gray-400 hover:text-red-700">
                            Remove
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {players.length > 0 && (
          <p className="text-xs text-gray-400 mt-2">
            &ldquo;Remove&rdquo; takes them off this roster only — the player and their evaluations stay.
            &ldquo;Hidden&rdquo; means they don&rsquo;t appear on the public roster page; change that on{' '}
            <Link href="/admin/roster" className="font-semibold text-[var(--gh-green)]">Roster</Link>.
          </p>
        )}
      </section>

      <details className="card p-4">
        <summary className="cursor-pointer list-none font-bold text-gray-700 flex items-center gap-2">
          <span className="caret text-sm">▸</span> Roster settings
        </summary>
        <div className="mt-4 pt-4 border-t border-gray-100 space-y-4">
          <form action={renameRoster} className="grid sm:grid-cols-3 gap-3 items-end">
            <input type="hidden" name="id" value={roster.id} />
            <div className="sm:col-span-2">
              <label className="field-label">Name</label>
              <input name="name" required defaultValue={roster.name} className="field" />
            </div>
            <div>
              <label className="field-label">Season</label>
              <input name="season" defaultValue={roster.season ?? ''} className="field" />
            </div>
            <div className="sm:col-span-2">
              <label className="field-label">Notes</label>
              <input name="notes" defaultValue={roster.notes ?? ''} className="field" />
            </div>
            <div>
              <label className="field-label">Status</label>
              <select name="is_archived" defaultValue={String(roster.is_archived)} className="field">
                <option value="false">Active</option>
                <option value="true">Archived</option>
              </select>
            </div>
            <div className="sm:col-span-3">
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  name="is_public"
                  value="true"
                  defaultChecked={roster.is_public}
                  className="mt-0.5"
                />
                <span>
                  <b>Publish this roster to the public site</b>
                  <span className="block text-xs text-gray-500">
                    Everyone on it appears on the public roster page. Untick and they come off.
                  </span>
                </span>
              </label>
            </div>
            <div className="sm:col-span-3">
              <button type="submit" className="btn btn-primary">Save roster</button>
            </div>
          </form>

          <div className="border-t border-gray-100 pt-4 flex items-center justify-between gap-3 flex-wrap">
            <p className="text-xs text-gray-500">
              Deleting a roster removes the list only. Every player and evaluation stays.
            </p>
            <DeleteButton id={roster.id} action={deleteRoster} label="Delete roster" />
          </div>
        </div>
      </details>
    </div>
  )
}
