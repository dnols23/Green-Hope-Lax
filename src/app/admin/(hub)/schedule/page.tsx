import { createClient } from '@/lib/supabase-server'
import { upsertGame, deleteGame } from '@/lib/actions'
import { DeleteButton } from '@/components/admin/DeleteButton'
import type { Game } from '@/lib/types'
import { GAME_AUDIENCES, audienceLabel, normalizeAudience } from '@/lib/schedule'
import { formatShortDate } from '@/lib/format'
import { requireTeam } from '@/lib/permissions'
import Link from 'next/link'
import { teamLabel, withTeam, type Team } from '@/lib/teams'

export const metadata = { title: 'Manage Schedule' }

// datetime-local needs "YYYY-MM-DDTHH:mm"
function toLocalInput(iso: string) {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function GameFields({ g, team }: { g?: Game; team: Team }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      <div>
        <label className="field-label">Date &amp; time *</label>
        <input type="datetime-local" name="game_date" required defaultValue={g ? toLocalInput(g.game_date) : ''} className="field" />
      </div>
      {/* Which team is playing. It rides hidden rather than as a select: you are
          already on one team's schedule, and a game filed to the other one is
          a game nobody finds again. */}
      <input type="hidden" name="level" value={g?.level ?? team} />
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
      <div>
        <label className="field-label">Who sees it</label>
        <select name="audience" defaultValue={normalizeAudience((g as { audience?: string } | undefined)?.audience)} className="field">
          {GAME_AUDIENCES.map((a) => (
            <option key={a.key} value={a.key}>{a.label}</option>
          ))}
        </select>
        <p className="text-xs text-gray-500 mt-1">
          {GAME_AUDIENCES.map((a) => `${a.label}: ${a.description}`).join(' ')}
        </p>
      </div>
      <div className="sm:col-span-2 lg:col-span-3">
        <label className="field-label">Notes</label>
        <input name="notes" defaultValue={g?.notes ?? ''} className="field" />
      </div>
    </div>
  )
}

export default async function AdminSchedulePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { team, locked } = await requireTeam('schedule', (await searchParams).team)
  const supabase = await createClient()
  const { data } = await supabase.from('games').select('*').order('game_date', { ascending: false })
  /* Filtered here rather than in the query, so a site whose owner has not run
     0035 yet still shows its schedule instead of failing on a column that isn't
     there. A game with no level reads as varsity, which is what it was. */
  const games = ((data as Game[]) ?? []).filter((g) => (g.level ?? 'varsity') === team)

  return (
    <div>
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <h1 className="text-xl font-black">
          {team === 'varsity' ? 'Schedule & Results' : `${teamLabel(team)} Schedule & Results`}
        </h1>
        {!locked && (
          <Link
            href={withTeam('/admin/schedule', team === 'varsity' ? 'jv' : 'varsity')}
            className="text-xs font-bold px-2 py-0.5 rounded-full border border-gray-200 text-gray-500 hover:border-[var(--gh-green)] hover:text-[var(--gh-green)]"
          >
            {team === 'varsity' ? 'JV' : 'Varsity'} &rarr;
          </Link>
        )}
      </div>

      <div className="card p-5 mb-6">
        <h2 className="font-bold text-gray-700 mb-4">Add {teamLabel(team)} game</h2>
        <form action={upsertGame} className="space-y-4">
          <GameFields team={team} />
          <button type="submit" className="btn btn-primary">Add game</button>
        </form>
      </div>

      <div className="space-y-2">
        {games.map((g) => (
          <details key={g.id} className="card p-4">
            <summary className="flex items-center justify-between cursor-pointer list-none gap-3">
              <span className="font-semibold">
                {formatShortDate(g.game_date)} — {g.home_away === 'away' ? '@' : 'vs'} {g.opponent}
                {g.status === 'final' && g.team_score != null && (
                  <span className="ml-2 text-gray-500">({g.team_score}–{g.opp_score})</span>
                )}
                {normalizeAudience((g as { audience?: string }).audience) !== 'public' && (
                  <span className="badge badge-sched ml-2">
                    {audienceLabel((g as { audience?: string }).audience)}
                  </span>
                )}
              </span>
              <DeleteButton id={g.id} action={deleteGame} />
            </summary>
            <form action={upsertGame} className="mt-4 space-y-4">
              <input type="hidden" name="id" value={g.id} />
              <GameFields g={g} team={team} />
              <button type="submit" className="btn btn-primary">Save changes</button>
            </form>
          </details>
        ))}
      </div>
    </div>
  )
}
