import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireSection } from '@/lib/permissions'
import { getRoster, rosterMembers } from '@/lib/rosters'
import { renameRoster, deleteRoster } from '@/lib/actions'
import { DeleteButton } from '@/components/admin/DeleteButton'
import { ImportPlayers } from './ImportPlayers'
import { RosterTable } from './RosterTable'
import { RosterTeamPick } from './RosterTeamPick'
import { createServiceClient } from '@/lib/supabase-server'
import { ROSTER_TEAMS_KEY, readRosterTeams } from '@/lib/depthChart'

export const dynamic = 'force-dynamic'

export default async function RosterDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireSection('rosters')
  const { id } = await params

  const roster = await getRoster(id)
  if (!roster) notFound()
  const [players, { data: rt }] = await Promise.all([
    rosterMembers(id),
    createServiceClient().from('app_settings').select('value').eq('key', ROSTER_TEAMS_KEY).maybeSingle(),
  ])
  const rosterTeam = readRosterTeams((rt as { value?: unknown } | null)?.value)[id] ?? null

  return (
    <div className="max-w-5xl space-y-4">
      <div>
        <Link href="/admin/rosters" className="text-sm font-bold text-[var(--gh-green)]">← Rosters</Link>
        <div className="flex items-center gap-2 mt-2 mb-1 flex-wrap">
          <h1 className="text-xl font-black">{roster.name}</h1>
          {roster.is_public && <span className="badge badge-win">Public</span>}
          {roster.is_archived && <span className="badge badge-sched">Archived</span>}
        </div>
        <p className="text-gray-500 text-sm mb-2">
          {players.length} {players.length === 1 ? 'player' : 'players'}
          {roster.season ? ` · ${roster.season}` : ''}
          {roster.notes ? ` · ${roster.notes}` : ''}
        </p>
        <RosterTeamPick rosterId={roster.id} team={rosterTeam} />
      </div>

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
                    Everyone on it appears on the public roster page. Publish more than one and
                    visitors pick between them by name — the lists stay separate.
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

      <details className="card p-4">
        <summary className="cursor-pointer list-none font-bold text-gray-700 flex items-center gap-2">
          <span className="caret text-sm">▸</span> Add players
          <span className="font-normal text-xs text-gray-400">paste a list, or pick a CSV</span>
        </summary>
        <div className="mt-4 pt-4 border-t border-gray-100">
          <ImportPlayers listId={roster.id} />
        </div>
      </details>

      <details open className="card p-4">
        <summary className="cursor-pointer list-none font-bold text-gray-700 flex items-center gap-2">
          <span className="caret text-sm">▸</span> Players on this roster ({players.length})
        </summary>
        <div className="mt-4 pt-4 border-t border-gray-100">
        {players.length === 0 ? (
          <div className="card p-6 text-sm text-gray-500">
            Nobody yet. Paste your list above to fill it.
          </div>
        ) : (
          <RosterTable
            listId={roster.id}
            players={players.map((p) => ({
              id: p.id,
              name: p.name,
              // Numbers and grad years can come back as numbers; the table edits them as text.
              number: p.number == null ? null : String(p.number),
              position: p.position,
              class_year: p.class_year == null ? null : String(p.class_year),
              team: p.team,
              is_active: p.is_active,
            }))}
          />
        )}
        {players.length > 0 && (
          <p className="text-xs text-gray-400 mt-2">
            Tap a name for the player’s profile, ✎ to rename. Tap any box to change it — it saves when you leave the box. &ldquo;Remove&rdquo; takes them off this roster only — the player and their evaluations stay.
            &ldquo;Hidden&rdquo; keeps them off the public roster page.
          </p>
        )}
        </div>
      </details>

    </div>
  )
}
