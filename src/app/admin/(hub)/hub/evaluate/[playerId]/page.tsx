import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase-server'
import { getCurrentCoach } from '@/lib/coach'
import { upsertEvaluation } from '@/lib/actions'
import { EVAL_CATEGORIES, EVAL_SECTIONS, PLAYING_TIME_OPTIONS, readRating, type Evaluation } from '@/lib/evaluations'
import { RatingSlider } from '@/components/admin/RatingSlider'
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

        {/* Skill ratings — grouped, 0–100 sliders */}
        {EVAL_SECTIONS.map((section) => (
          <div key={section}>
            <div className="section-label mb-2">{section}</div>
            <div className="space-y-3">
              {EVAL_CATEGORIES.filter((c) => c.section === section).map((c) => {
                const saved = readRating(ev?.ratings?.[c.key])
                return (
                  <RatingSlider
                    key={c.key}
                    name={`cat_${c.key}`}
                    label={c.label}
                    defaultScore={saved?.score}
                    defaultNote={saved?.note}
                  />
                )
              })}
            </div>
          </div>
        ))}

        {/* Overall */}
        <div className="border-t pt-4">
          <div className="section-label mb-2">Overall</div>
          <RatingSlider name="overall" label="Overall rating" defaultScore={ev?.overall ?? undefined} />
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

        <div className="sticky bottom-0 -mx-5 -mb-5 px-5 py-3 bg-white border-t rounded-b-xl">
          <button type="submit" className="btn btn-primary w-full sm:w-auto">
            {ev ? 'Update evaluation' : 'Save evaluation'}
          </button>
        </div>
      </form>
    </div>
  )
}

