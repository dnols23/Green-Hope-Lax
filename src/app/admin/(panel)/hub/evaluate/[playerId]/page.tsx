import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase-server'
import { getCurrentCoach } from '@/lib/coach'
import { upsertEvaluation } from '@/lib/actions'
import { EVAL_CATEGORIES, SCALE, PLAYING_TIME_OPTIONS, type Evaluation } from '@/lib/evaluations'
import type { Player } from '@/lib/types'

export const metadata = { title: 'Evaluate' }

const SEASON = '2026'

export default async function EvaluateForm({
  params,
  searchParams,
}: {
  params: Promise<{ playerId: string }>
  searchParams: Promise<{ saved?: string }>
}) {
  const { playerId } = await params
  const { saved } = await searchParams
  const coach = await getCurrentCoach()

  const svc = createServiceClient()
  const { data: playerRow } = await svc.from('players').select('*').eq('id', playerId).maybeSingle()
  const player = playerRow as Player | null
  if (!player) notFound()

  const { data: existingRow } = coach
    ? await svc.from('evaluations').select('*').eq('player_id', playerId).eq('evaluator_email', coach.email).eq('season', SEASON).maybeSingle()
    : { data: null }
  const ev = existingRow as Evaluation | null

  return (
    <div className="max-w-2xl">
      <Link href="/admin/hub/evaluate" className="text-sm font-bold text-[var(--gh-green)]">← All players</Link>

      <div className="flex items-center gap-3 mt-2 mb-1">
        <span className="shrink-0 w-11 h-11 rounded-full flex items-center justify-center font-black text-white"
          style={{ background: 'var(--gh-green)' }}>{player.number ?? '–'}</span>
        <div>
          <h1 className="text-xl font-black leading-tight">{player.name}</h1>
          <div className="text-xs text-gray-500">{[player.position, player.class_year].filter(Boolean).join(' · ') || '—'}</div>
        </div>
      </div>
      <p className="text-gray-500 text-sm mb-5">
        {ev ? 'Updating your evaluation.' : 'Your evaluation.'} Only you and the head coach can see it.
      </p>

      {saved && (
        <div className="bg-green-50 border border-green-200 text-green-800 text-sm rounded-lg px-3 py-2 mb-4 font-semibold">
          Evaluation saved ✓
        </div>
      )}

      <form action={upsertEvaluation} className="card p-5 space-y-5">
        <input type="hidden" name="player_id" value={player.id} />
        <input type="hidden" name="season" value={SEASON} />

        <div>
          <label className="field-label">Position</label>
          <input name="position" defaultValue={ev?.position ?? player.position ?? ''} className="field max-w-xs" />
        </div>

        {/* Skill ratings */}
        <div>
          <div className="field-label mb-2">Skill ratings <span className="text-gray-400 font-normal">(1 = {SCALE.labels[1]}, 5 = {SCALE.labels[5]})</span></div>
          <div className="divide-y">
            {EVAL_CATEGORIES.map((c) => (
              <div key={c.key} className="flex items-center justify-between gap-3 py-2.5 flex-wrap">
                <span className="font-semibold text-sm">{c.label}</span>
                <Rating name={`cat_${c.key}`} value={ev?.ratings?.[c.key]} />
              </div>
            ))}
          </div>
        </div>

        {/* Overall */}
        <div className="flex items-center justify-between gap-3 flex-wrap border-t pt-4">
          <span className="font-black">Overall</span>
          <Rating name="overall" value={ev?.overall ?? undefined} />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="field-label">Strengths</label>
            <textarea name="strengths" rows={3} defaultValue={ev?.strengths ?? ''} className="field" placeholder="What stands out…" />
          </div>
          <div>
            <label className="field-label">Areas to improve</label>
            <textarea name="areas_to_improve" rows={3} defaultValue={ev?.areas_to_improve ?? ''} className="field" placeholder="Where to develop…" />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="field-label">Playing-time recommendation</label>
            <select name="playing_time" defaultValue={ev?.playing_time ?? ''} className="field">
              <option value="">— select —</option>
              {PLAYING_TIME_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Notes</label>
            <textarea name="notes" rows={3} defaultValue={ev?.notes ?? ''} className="field" placeholder="Anything else…" />
          </div>
        </div>

        <button type="submit" className="btn btn-primary">{ev ? 'Update evaluation' : 'Save evaluation'}</button>
      </form>
    </div>
  )
}

// 1–5 segmented rating control (native radios; works without client JS).
function Rating({ name, value }: { name: string; value?: number }) {
  return (
    <div className="inline-flex gap-1.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <label key={n} className="relative cursor-pointer" title={SCALE.labels[n]}>
          <input type="radio" name={name} value={n} defaultChecked={value === n} className="peer sr-only" />
          <span className="peer-checked:bg-[var(--gh-green)] peer-checked:text-white peer-checked:border-transparent inline-flex items-center justify-center rounded-lg border font-black w-11 h-11 sm:w-10 sm:h-10 text-base transition-colors"
            style={{ borderColor: 'var(--border)' }}>{n}</span>
        </label>
      ))}
    </div>
  )
}
