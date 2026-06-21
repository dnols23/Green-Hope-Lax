import { createClient } from '@/lib/supabase-server'
import { upsertGame, deleteGame } from '@/lib/actions'
import { DeleteButton } from '@/components/admin/DeleteButton'
import type { Game } from '@/lib/types'

export const metadata = { title: 'Manage Schedule' }

// datetime-local needs "YYYY-MM-DDTHH:mm"
function toLocalInput(iso: string) {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function GameFields({ g }: { g?: Game }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      <div>
        <label className="field-label">Date &amp; time *</label>
        <input type="datetime-local" name="game_date" required defaultValue={g ? toLocalInput(g.game_date) : ''} className="field" />
      </div>
      <div>
        <label className="field-label">Opponent *</label>
        <input name="opponent" required defaultValue={g?.opponent ?? ''} className="field" />
      </div>
      <div>
        <label className="field-label">Home / Away *</label>
        <select name="home_away" defaultValue={g?.home_away ?? 'home'} className="field">
          <option value="home">Home</option>
          <option value="away">Away</option>
          <option value="neutral">Neutral</option>
        </select>
      </div>
      <div>
        <label className="field-label">Location</label>
        <input name="location" defaultValue={g?.location ?? ''} className="field" />
      </div>
      <div>
        <label className="field-label">Status *</label>
        <select name="status" defaultValue={g?.status ?? 'scheduled'} className="field">
          <option value="scheduled">Scheduled</option>
          <option value="final">Final</option>
          <option value="postponed">Postponed</option>
          <option value="canceled">Canceled</option>
        </select>
      </div>
      <div>
        <label className="field-label">Falcons score</label>
        <input type="number" name="team_score" min="0" defaultValue={g?.team_score ?? ''} className="field" />
      </div>
      <div>
        <label className="field-label">Opponent score</label>
        <input type="number" name="opp_score" min="0" defaultValue={g?.opp_score ?? ''} className="field" />
      </div>
      <div>
        <label className="field-label">Conference game?</label>
        <select name="is_conference" defaultValue={String(g?.is_conference ?? true)} className="field">
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
      </div>
      <div className="sm:col-span-2 lg:col-span-3">
        <label className="field-label">Notes</label>
        <input name="notes" defaultValue={g?.notes ?? ''} className="field" />
      </div>
    </div>
  )
}

export default async function AdminSchedulePage() {
  const supabase = await createClient()
  const { data } = await supabase.from('games').select('*').order('game_date', { ascending: false })
  const games = (data as Game[]) ?? []

  return (
    <div>
      <h1 className="text-xl font-black mb-4">Schedule &amp; Results</h1>

      <div className="card p-5 mb-6">
        <h2 className="font-bold text-gray-700 mb-4">Add Game</h2>
        <form action={upsertGame} className="space-y-4">
          <GameFields />
          <button type="submit" className="btn btn-primary">Add game</button>
        </form>
      </div>

      <div className="space-y-2">
        {games.map((g) => (
          <details key={g.id} className="card p-4">
            <summary className="flex items-center justify-between cursor-pointer list-none gap-3">
              <span className="font-semibold">
                {new Date(g.game_date).toLocaleDateString()} — {g.home_away === 'away' ? '@' : 'vs'} {g.opponent}
                {g.status === 'final' && g.team_score != null && (
                  <span className="ml-2 text-gray-500">({g.team_score}–{g.opp_score})</span>
                )}
              </span>
              <DeleteButton id={g.id} action={deleteGame} />
            </summary>
            <form action={upsertGame} className="mt-4 space-y-4">
              <input type="hidden" name="id" value={g.id} />
              <GameFields g={g} />
              <button type="submit" className="btn btn-primary">Save changes</button>
            </form>
          </details>
        ))}
      </div>
    </div>
  )
}
