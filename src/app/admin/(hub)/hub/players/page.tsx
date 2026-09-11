import Link from 'next/link'
import { requireSection } from '@/lib/permissions'
import { createServiceClient } from '@/lib/supabase-server'
import { listRosters } from '@/lib/rosters'
import { listPlayerAccess, playerAccessReady } from '@/lib/playerAccess'
import { latestDrillSets, drillSetsReady } from '@/lib/drillSets'
import { compileScores, type Evaluation } from '@/lib/evaluations'
import { createPlayerInvite, revokePlayerInvite, generateDrillSet } from '@/lib/actions'
import { positionGroup, POSITION_LABELS } from '@/lib/prescribe'
import { formatShortDate } from '@/lib/format'
import type { Player } from '@/lib/types'
import { GenerateAll } from './GenerateAll'
import { InviteLink } from './InviteLink'

export const metadata = { title: 'Players' }
export const dynamic = 'force-dynamic'

export default async function PlayersPage() {
  await requireSection('hub')

  if (!(await playerAccessReady()) || !(await drillSetsReady())) {
    return (
      <div className="max-w-2xl">
        <h1 className="text-xl font-black mb-1">Players</h1>
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 mt-4">
          <p className="text-sm text-amber-900 font-bold mb-1">Player links aren&rsquo;t switched on yet.</p>
          <p className="text-sm text-amber-900">
            Run <code>supabase/migrations/0020_player_access.sql</code> in the Supabase SQL editor
            and this page starts working.
          </p>
        </div>
      </div>
    )
  }

  const svc = createServiceClient()
  const [{ data: playerRows }, { data: evalRows }, access, sets, rosters] = await Promise.all([
    svc.from('players').select('*').order('team').order('sort_order'),
    svc.from('evaluations').select('*'),
    listPlayerAccess(),
    latestDrillSets(),
    listRosters(),
  ])
  const players = (playerRows ?? []) as Player[]
  const evals = (evalRows ?? []) as Evaluation[]
  const scores = compileScores(evals)
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://greenhopelacrosse.com'

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h1 className="text-xl font-black mb-1">Players</h1>
        <p className="text-gray-500 text-sm">
          Each player gets one link. Following it signs them in as themselves — their evaluation,
          their drill set, and any practice plan you&rsquo;ve published to players. No password for
          them to forget.
        </p>
      </div>

      {rosters.length > 0 && <GenerateAll rosters={rosters.map((r) => ({ id: r.id, name: r.name }))} />}

      <div className="card divide-y divide-gray-100">
        {players.map((p) => {
          const token = access[p.id]
          const live = token && !token.revokedAt
          const set = sets[p.id]
          const score = scores.get(p.id)
          return (
            <div key={p.id} className="p-3 flex items-center gap-3 flex-wrap">
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-sm">
                  {p.number ? `#${p.number} ` : ''}{p.name}
                  <span className="text-xs text-gray-400 ml-2">
                    {POSITION_LABELS[positionGroup(p.position)]}
                  </span>
                </div>
                <div className="text-xs text-gray-500">
                  {score ? `Rated ${score.average} by ${score.count}` : 'Not evaluated yet'}
                  {set ? ` · ${set.items.length} drills, ${formatShortDate(set.createdAt)}` : ' · no drill set'}
                  {live && token.lastSeenAt ? ` · opened ${formatShortDate(token.lastSeenAt)}` : ''}
                  {live && !token.lastSeenAt ? ' · link not opened yet' : ''}
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
                {live ? (
                  <>
                    <InviteLink url={`${site}/team/join/${token.token}`} />
                    <form action={revokePlayerInvite}>
                      <input type="hidden" name="player_id" value={p.id} />
                      <button type="submit" className="text-xs font-bold text-gray-400 hover:text-red-700">
                        Revoke
                      </button>
                    </form>
                  </>
                ) : (
                  <form action={createPlayerInvite}>
                    <input type="hidden" name="player_id" value={p.id} />
                    <button type="submit" className="btn btn-ghost !py-1 !px-2.5 text-xs">
                      {token ? 'New link' : 'Make link'}
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
