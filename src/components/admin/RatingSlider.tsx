'use client'
import { useId, useState } from 'react'
import { RATING_GRADIENT, SCALE, TIERS, tierFor } from '@/lib/evaluations'

/**
 * One skill on the evaluation form: a 0–100 slider over a gradient that runs
 * from developing to collegiate, a badge showing the score and what tier it
 * lands in, and an optional note.
 *
 * The badge recolours as the coach drags, so the judgement reads as a level
 * rather than a number they have to translate.
 */
export function RatingSlider({
  name,
  label,
  defaultScore,
  defaultNote,
  selfRating,
}: {
  name: string
  label: string
  defaultScore?: number
  defaultNote?: string
  /** The player's own score for this skill, when they've self-assessed. */
  selfRating?: number
}) {
  const [score, setScore] = useState<number>(defaultScore ?? 50)
  const tier = tierFor(score)
  const id = useId()

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <label htmlFor={id} className="font-bold text-sm block">{label}</label>
          {selfRating != null && (
            <span className="text-xs text-gray-500">
              Player self-rating: {selfRating} · {tierFor(selfRating).label}
            </span>
          )}
        </div>
        <span
          className="text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap tabular-nums"
          style={{ background: tier.soft, color: tier.ink }}
        >
          {score} · {tier.label}
        </span>
      </div>

      <input
        id={id}
        name={name}
        type="range"
        min={SCALE.min}
        max={SCALE.max}
        value={score}
        onChange={(e) => setScore(Number(e.target.value))}
        className="rating-range"
        style={{ background: RATING_GRADIENT }}
        aria-label={`${label} rating, ${score} out of 100, ${tier.label}`}
      />

      <div className="flex justify-between mt-1.5">
        {TIERS.map((t) => (
          <span
            key={t.key}
            className="text-[10px] font-bold uppercase tracking-wider"
            style={{ color: t.key === tier.key ? t.ink : 'var(--text-muted)' }}
          >
            {t.label}
          </span>
        ))}
      </div>

      <input
        name={`note_${name.replace(/^cat_/, '')}`}
        defaultValue={defaultNote ?? ''}
        placeholder="Note (optional)"
        className="field mt-3"
      />
    </div>
  )
}
