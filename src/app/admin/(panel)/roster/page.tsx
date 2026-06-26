import { createClient } from '@/lib/supabase-server'
import { upsertPlayer, deletePlayer } from '@/lib/actions'
import { DeleteButton } from '@/components/admin/DeleteButton'
import { PublishToggle } from '@/components/admin/PublishToggle'
import { TEAM_LABELS, type Player } from '@/lib/types'

export const metadata = { title: 'Manage Roster' }

function PlayerFields({ p }: { p?: Player }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      <div>
        <label className="field-label">Name *</label>
        <input name="name" required defaultValue={p?.name ?? ''} className="field" />
      </div>
      <div>
        <label className="field-label">Team *</label>
        <select name="team" defaultValue={p?.team ?? 'boys_varsity'} className="field">
          {Object.entries(TEAM_LABELS).filter(([v]) => v !== 'girls').map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>
      <div>
        <label className="field-label">Number</label>
        <input name="number" defaultValue={p?.number ?? ''} className="field" />
      </div>
      <div>
        <label className="field-label">Position</label>
        <input name="position" defaultValue={p?.position ?? ''} placeholder="Attack, Midfield…" className="field" />
      </div>
      <div>
        <label className="field-label">Class year</label>
        <input name="class_year" defaultValue={p?.class_year ?? ''} placeholder="2027" className="field" />
      </div>
      <div>
        <label className="field-label">Height</label>
        <input name="height" defaultValue={p?.height ?? ''} className="field" />
      </div>
      <div>
        <label className="field-label">Hometown</label>
        <input name="hometown" defaultValue={p?.hometown ?? ''} className="field" />
      </div>
      <div>
        <label className="field-label">Photo URL</label>
        <input name="photo_url" defaultValue={p?.photo_url ?? ''} className="field" />
      </div>
      <div>
        <label className="field-label">Sort order</label>
        <input type="number" name="sort_order" defaultValue={p?.sort_order ?? 0} className="field" />
      </div>
      <div>
        <label className="field-label">Active?</label>
        <select name="is_active" defaultValue={String(p?.is_active ?? true)} className="field">
          <option value="true">Yes</option>
          <option value="false">No (hidden)</option>
        </select>
      </div>
      <div className="sm:col-span-2 lg:col-span-3">
        <label className="field-label">Bio</label>
        <textarea name="bio" rows={2} defaultValue={p?.bio ?? ''} className="field" />
      </div>
    </div>
  )
}

export default async function AdminRosterPage() {
  const supabase = await createClient()
  const { data } = await supabase.from('players').select('*').order('team').order('sort_order')
  const players = (data as Player[]) ?? []

  return (
    <div>
      <h1 className="text-xl font-black mb-4">Roster</h1>

      <div className="card p-5 mb-6">
        <h2 className="font-bold text-gray-700 mb-4">Add Player</h2>
        <form action={upsertPlayer} className="space-y-4">
          <PlayerFields />
          <button type="submit" className="btn btn-primary">Add player</button>
        </form>
      </div>

      <div className="space-y-2">
        {players.map((p) => (
          <details key={p.id} className="card p-4">
            <summary className="flex items-center justify-between cursor-pointer list-none gap-3">
              <span className="font-semibold">
                {p.number && <span className="text-gray-400">#{p.number} </span>}
                {p.name}
                <span className="ml-2 text-xs text-gray-400">{TEAM_LABELS[p.team]}</span>
              </span>
              <span className="flex items-center gap-3">
                <PublishToggle entity="player" id={p.id} live={p.is_active} />
                <DeleteButton id={p.id} action={deletePlayer} />
              </span>
            </summary>
            <form action={upsertPlayer} className="mt-4 space-y-4">
              <input type="hidden" name="id" value={p.id} />
              <PlayerFields p={p} />
              <button type="submit" className="btn btn-primary">Save changes</button>
            </form>
          </details>
        ))}
      </div>
    </div>
  )
}
