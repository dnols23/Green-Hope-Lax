'use client'
import { useState } from 'react'
import { RatingSlider } from '@/components/admin/RatingSlider'
import { categoriesFor, sectionsFor, readRating, type Evaluation } from '@/lib/evaluations'
import { POSITION_GROUPS, POSITION_LABELS, positionGroup } from '@/lib/positions'

/**
 * The questions, and the position that decides which ones they are.
 *
 * Position sits with the sliders rather than above them because changing it
 * changes them: pick Goalie and the dodging and finishing questions go away and
 * arc, hands, reading the shooter and clearing take their place. A coach
 * correcting a roster typo mid-evaluation sees the right form immediately,
 * which is the only way the two can't drift apart.
 */
export function EvalSkills({
  ev,
  rosterPosition,
}: {
  ev: Evaluation | null
  rosterPosition: string | null
}) {
  const [position, setPosition] = useState<string>(
    positionGroup(ev?.position ?? rosterPosition)
  )

  const sections = sectionsFor(position)
  const categories = categoriesFor(position)

  return (
    <>
      <div>
        <label className="field-label">Position</label>
        <select
          name="position"
          value={position}
          onChange={(e) => setPosition(e.target.value)}
          className="field max-w-xs"
        >
          {POSITION_GROUPS.map((p) => (
            <option key={p} value={p}>{POSITION_LABELS[p]}</option>
          ))}
        </select>
        <p className="text-xs text-gray-400 mt-1">
          What he is being evaluated as. The questions below follow it.
        </p>
      </div>

      {sections.map((section) => (
        <div key={section}>
          <div className="section-label mb-2">{section}</div>
          <div className="space-y-3">
            {categories
              .filter((c) => c.section === section)
              .map((c) => {
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
    </>
  )
}
