import Link from 'next/link'
import { getPlayers } from '@/lib/queries'
import { getCurrentCoach } from '@/lib/coach'
import { createServiceClient } from '@/lib/supabase-server'
import { TEAM_LABELS, type Player, type TeamGroup } from '@/lib/types'

export const metadata = { title: 'Evaluate players' }

const SEASON = '2026'

export default async function EvaluatePicker() {
  const coach = await getCurrentCoach()
  const players = await getPlayers()

  // Which players has THIS coach already evaluated this season?
  const done = new Set<string>()
  if (coach) {
    const svc = createServiceClient()
    const { data } = await svc
      .from('evaluations')
      .select('player_id')
      .eq('evaluator_email', coach.email)
      .eq('season', SEASON)
    for (const e of (data as { player_id: string }[]) ?? []) done.add(e.player_id)
  }

  // Group by team, preserving roster order.
  const groups = new Map<TeamGroup, Player[]>()
  for (const p of players) {
    if (!groups.has(p.team)) groups.set(p.team, [])
    groups.get(p.team)!.push(p)
  }

  return (
    <div>
      <Link href="/admin/hub" className="text-sm font-bold text-[var(--gh-green)]">← Coaches Hub</Link>
      <h1 className="text-xl font-black mt-2 mb-1">Evaluate a player</h1>
      <p className="text-gray-500 text-sm mb-6">
        Pick a player to rate. A ✓ means you’ve already submitted yours — tap to update it.
      </p>

      {players.length === 0 ? (
        <div className="card p-6 text-sm text-gray-500">No players on the roster yet — add players in Roster first.</div>
      ) : (
        <div className="space-y-8">
          {[...groups.entries()].map(([team, list]) => (
            <section key={team}>
              <h2 className="font-black text-gray-700 mb-3">{TEAM_LABELS[team]}</h2>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((p) => (
                  <Link key={p.id} href={`/admin/hub/evaluate/${p.id}`}
                    className="card p-3 flex items-center gap-3 hover:shadow-md transition-shadow">
                    <span className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center font-black text-white text-sm"
                      style={{ background: 'var(--gh-green)' }}>{p.number ?? '–'}</span>
                    <span className="min-w-0 flex-1">
                      <span className="font-bold block truncate">{p.name}</span>
                      <span className="text-xs text-gray-500">{[p.position, p.class_year].filter(Boolean).join(' · ') || '—'}</span>
                    </span>
                    {done.has(p.id)
                      ? <span className="text-xs font-bold text-[var(--gh-green)]">✓ Done</span>
                      : <span className="text-xs font-semibold text-gray-400">Rate →</span>}
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
