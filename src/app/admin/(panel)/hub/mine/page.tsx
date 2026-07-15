import Link from 'next/link'
import { getCurrentCoach } from '@/lib/coach'
import { createServiceClient } from '@/lib/supabase-server'
import { deleteEvaluation } from '@/lib/actions'
import { DeleteButton } from '@/components/admin/DeleteButton'
import { ratingsAverage, type Evaluation } from '@/lib/evaluations'
import type { Player } from '@/lib/types'

export const metadata = { title: 'My Evaluations' }

const SEASON = '2026'

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default async function MyEvaluations() {
  const coach = await getCurrentCoach()
  const svc = createServiceClient()

  const { data: evalRows } = coach
    ? await svc.from('evaluations').select('*').eq('evaluator_email', coach.email).eq('season', SEASON).order('updated_at', { ascending: false })
    : { data: [] }
  const evals = (evalRows as Evaluation[]) ?? []

  const { data: playerRows } = await svc.from('players').select('id, name, number, position')
  const players = new Map((playerRows ?? []).map((p: Pick<Player, 'id' | 'name' | 'number' | 'position'>) => [p.id, p]))

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-1">
        <div>
          <Link href="/admin/hub" className="text-sm font-bold text-[var(--gh-green)]">← Coaches Hub</Link>
          <h1 className="text-xl font-black mt-2">My Evaluations</h1>
        </div>
        <Link href="/admin/hub/evaluate" className="btn btn-primary">+ Evaluate a player</Link>
      </div>
      <p className="text-gray-500 text-sm mb-6">The evaluations you’ve submitted this season. Only you and the head coach can see them.</p>

      {evals.length === 0 ? (
        <div className="card p-6 text-sm text-gray-500">
          You haven’t evaluated anyone yet. <Link href="/admin/hub/evaluate" className="text-[var(--gh-green)] font-semibold">Start an evaluation →</Link>
        </div>
      ) : (
        <div className="card divide-y">
          {evals.map((e) => {
            const p = players.get(e.player_id)
            const score = e.overall ?? Math.round(ratingsAverage(e.ratings) * 10) / 10
            return (
              <div key={e.id} className="flex items-center gap-3 p-4 flex-wrap">
                <span className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center font-black text-white text-sm"
                  style={{ background: 'var(--gh-green)' }}>{p?.number ?? '–'}</span>
                <div className="min-w-0 flex-1">
                  <div className="font-bold truncate">{p?.name ?? 'Unknown player'}</div>
                  <div className="text-xs text-gray-500">
                    {p?.position ?? '—'}{e.playing_time ? ` · ${e.playing_time}` : ''} · updated {fmt(e.updated_at)}
                  </div>
                </div>
                <span className="text-sm font-black" style={{ color: 'var(--gh-green)' }}>
                  {score ? `${score}/5` : '—'} <span className="text-gray-400 font-normal text-xs">overall</span>
                </span>
                <Link href={`/admin/hub/evaluate/${e.player_id}`} className="btn btn-ghost !py-1.5 !px-3 text-sm">Edit</Link>
                <DeleteButton id={e.id} action={deleteEvaluation} />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
