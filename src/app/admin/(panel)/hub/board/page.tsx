import Link from 'next/link'
import { requireHeadCoach } from '@/lib/coach'
import { createServiceClient } from '@/lib/supabase-server'
import { EVAL_CATEGORIES, ratingsAverage, type Evaluation } from '@/lib/evaluations'
import { TEAM_LABELS, type Player, type TeamGroup } from '@/lib/types'
import { BoardTable, type BoardRow } from './BoardTable'

export const metadata = { title: 'Team Evaluation Board' }

const SEASON = '2026'
const round1 = (n: number) => Math.round(n * 10) / 10

export default async function EvaluationBoard() {
  await requireHeadCoach() // assistants → 404

  const svc = createServiceClient()
  const { data: evalRows } = await svc.from('evaluations').select('*').eq('season', SEASON)
  const evals = (evalRows as Evaluation[]) ?? []
  const { data: playerRows } = await svc.from('players').select('id, name, number, team, position')
  const pMap = new Map((playerRows ?? []).map((p: Pick<Player, 'id' | 'name' | 'number' | 'team' | 'position'>) => [p.id, p]))

  // Group evaluations by player and compile averages across evaluators.
  const byPlayer = new Map<string, Evaluation[]>()
  for (const e of evals) {
    if (!byPlayer.has(e.player_id)) byPlayer.set(e.player_id, [])
    byPlayer.get(e.player_id)!.push(e)
  }

  const rows: BoardRow[] = []
  for (const [playerId, list] of byPlayer) {
    const p = pMap.get(playerId)
    if (!p) continue
    const catAvg: Record<string, number> = {}
    for (const c of EVAL_CATEGORIES) {
      const vals = list.map((e) => e.ratings?.[c.key]).filter((v): v is number => typeof v === 'number' && v > 0)
      if (vals.length) catAvg[c.key] = round1(vals.reduce((a, b) => a + b, 0) / vals.length)
    }
    const overalls = list.map((e) => (e.overall && e.overall > 0 ? e.overall : ratingsAverage(e.ratings))).filter((v) => v > 0)
    const overallAvg = overalls.length ? round1(overalls.reduce((a, b) => a + b, 0) / overalls.length) : 0
    rows.push({
      playerId,
      name: p.name,
      number: p.number,
      team: p.team,
      teamLabel: TEAM_LABELS[p.team as TeamGroup],
      position: p.position,
      count: list.length,
      overallAvg,
      catAvg,
      evaluators: list.map((e) => ({
        name: e.evaluator_name,
        overall: e.overall,
        ratings: e.ratings ?? {},
        strengths: e.strengths,
        areas: e.areas_to_improve,
        notes: e.notes,
        playing_time: e.playing_time,
      })),
    })
  }

  return (
    <div>
      <Link href="/admin/hub" className="text-sm font-bold text-[var(--gh-green)]">← Coaches Hub</Link>
      <div className="flex items-center gap-2 mt-2 mb-1">
        <h1 className="text-xl font-black">Team Evaluation Board</h1>
        <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: '#fde8ea', color: 'var(--gh-maroon)' }}>Head coach only</span>
      </div>
      <p className="text-gray-500 text-sm mb-6">Compiled scores across every coach. Tap a player to see each coach’s ratings and notes.</p>

      {rows.length === 0 ? (
        <div className="card p-6 text-sm text-gray-500">
          No evaluations submitted yet. Once coaches start evaluating players, their compiled scores will appear here.
        </div>
      ) : (
        <BoardTable rows={rows} />
      )}
    </div>
  )
}
