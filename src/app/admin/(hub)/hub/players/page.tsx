import Link from 'next/link'
import { RosterTabs } from '@/components/admin/RosterTabs'
import { requireSection } from '@/lib/permissions'
import { createServiceClient } from '@/lib/supabase-server'
import { listRosters } from '@/lib/rosters'
import { listHubAccounts } from '@/lib/hubAccounts'
import { latestDrillSets, drillSetsReady } from '@/lib/drillSets'
import { compileScores, type Evaluation } from '@/lib/evaluations'
import { generateDrillSet } from '@/lib/actions'
import { looksLikeYear, positionLabel } from '@/lib/positions'
import { formatShortDate } from '@/lib/format'
import type { Player } from '@/lib/types'
import { PlayerLink } from '@/components/admin/PlayerLink'
import { GenerateAll } from './GenerateAll'
import { SplitNameNotice } from '@/components/admin/SplitNameNotice'

export const metadata = { title: 'Players' }
export const dynamic = 'force-dynamic'

export default async function PlayersPage() {
  await requireSection('hub')

  if (!(await drillSetsReady())) {
    return (
      <div className="max-w-2xl">
        <RosterTabs active="players" />
        <h1 className="text-xl font-black mb-1">Players</h1>
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 mt-4">
          <p className="text-sm text-amber-900 font-bold mb-1">Drill sets aren&rsquo;t switched on yet.</p>
          <p className="text-sm text-amber-900">
            Run <code>supabase/migrations/0020_player_access.sql</code> in the Supabase SQL editor
            and this page starts working.
          </p>
        </div>
      </div>
    )
  }

  const svc = createServiceClient()
  const [{ data: playerRows }, { data: evalRows }, accounts, sets, rosters] = await Promise.all([
    svc.from('players').select('*').order('team').order('sort_order'),
    svc.from('evaluations').select('*'),
    listHubAccounts(),
    latestDrillSets(),
    listRosters(),
  ])
  const players = (playerRows ?? []) as Player[]
  const evals = (evalRows ?? []) as Evaluation[]
  const scores = compileScores(evals)
  // Who has joined their hub: the player himself, and any parent who named him.
  const joined = new Set((accounts ?? []).filter((a) => a.kind === 'player' && a.playerId).map((a) => a.playerId!))
  const parentsOf = (id: string) => (accounts ?? []).filter((a) => a.kind === 'parent' && a.playerIds.includes(id)).length

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <RosterTabs active="players" />
        <h1 className="text-xl font-black mb-1">Players</h1>
        <p className="text-gray-500 text-sm">
          Tap a name for the full profile. Players and parents join their hub with the team&rsquo;s
          join code.
        </p>
      </div>

      <SplitNameNotice />

      {rosters.length > 0 && <GenerateAll rosters={rosters.map((r) => ({ id: r.id, name: r.name }))} />}

      <div className="card divide-y divide-gray-100">
        {players.map((p) => {
          const inHub = joined.has(p.id)
          const parents = parentsOf(p.id)
          const set = sets[p.id]
          const score = scores.get(p.id)
          return (
            <div key={p.id} className="p-3 flex items-center gap-3 flex-wrap">
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-sm">
                  <PlayerLink id={p.id} name={p.name} number={p.number} />
                  <span className="text-xs text-gray-400 ml-2">
                    {[positionLabel(p.position), looksLikeYear(p.class_year) ? p.class_year : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </div>
                <div className="text-xs text-gray-500">
                  {score ? `Rated ${score.average} by ${score.count}` : 'Not evaluated yet'}
                  {set ? ` · ${set.items.length} drills, ${formatShortDate(set.createdAt)}` : ' · no drill set'}
                  {inHub ? ' · in the Team Hub' : ' · not in the Team Hub yet'}
                  {parents ? ` · ${parents} parent${parents === 1 ? '' : 's'} joined` : ''}
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                {score && (
                  <form action={generateDrillSet}>
                    <input type="hidden" name="player_id" value={p.id} />
                    <button type="submit" className="text-xs font-bold text-gray-500 hover:text-gray-800">
                      {set ? 'Re-make set' : 'Make drill set'}
                    </button>
                  </form>
                )}
              </div>
            </div>
          )
        })}
        {players.length === 0 && (
          <p className="p-6 text-sm text-gray-500">
            No players yet — add them in{' '}
            <Link href="/admin/roster" className="font-semibold text-[var(--gh-green)]">Roster</Link>.
          </p>
        )}
      </div>
    </div>
  )
}
