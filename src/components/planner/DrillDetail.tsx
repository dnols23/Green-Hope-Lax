'use client'
import { useState } from 'react'
import NumberField from '@/components/NumberField'
import { COMP_FORMATS, formatOf, rollComp, type BlockComp } from '@/lib/compete'
import type { Drill } from '@/lib/drills'

/**
 * What the drill is, folded away until somebody wants it.
 *
 * A practice plan is a list of names and minutes, which is enough for the coach
 * who wrote it and nothing at all for the one running it for the first time.
 * Open this and the drill explains itself: how it goes out, how it runs, what
 * it is for, and the video — then how it is being won, and the score.
 */
export function DrillDetail({
  drill,
  comp,
  sides,
  seed,
  onComp,
}: {
  drill: Drill
  comp: BlockComp | null | undefined
  /** The squads this practice is split into. */
  sides: string[]
  /** Keeps the rolled competition the same from one day to the next. */
  seed: string
  onComp: (next: BlockComp | null) => void
}) {
  // How many times he has asked for a different one.
  const [nonce, setNonce] = useState(0)

  const chosen = comp?.key ? formatOf(comp.key) : null
  const suggestion = rollComp(seed, drill.category, nonce)
  const shown = chosen ?? suggestion
  const on = !!comp

  const setScore = (i: number, n: number) => {
    if (!comp) return
    const scores = sides.map((_, k) => (k === i ? n : comp.scores[k] ?? 0))
    onComp({ ...comp, scores })
  }

  return (
    <details className="mt-2 rounded-lg border border-gray-200 bg-gray-50">
      <summary className="cursor-pointer list-none px-3 py-2 flex items-center gap-2 flex-wrap text-sm">
        <span className="caret text-xs text-gray-400">▸</span>
        <span className="font-bold text-gray-700">What this drill is</span>
        {drill.link && <span className="badge badge-sched">Video</span>}
        {on && (
          <span className="badge badge-conf">
            {comp?.own ? 'Competition' : shown.label}
          </span>
        )}
        <span className="ml-auto text-xs text-gray-400">{drill.name}</span>
      </summary>

      <div className="px-3 pb-3 pt-1 space-y-3 border-t border-gray-200">
        <Part label="Setup" body={drill.setup} fallback="Nobody has written the setup down yet." />
        <Part label="How it runs" body={drill.description} fallback="No run-through written yet." />
        <Part label="Why we run it" body={drill.context} fallback="Nobody has written down what it is for yet." />

        <div>
          <div className="section-label mb-1">Video</div>
          {drill.link ? (
            <a
              href={drill.link}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-bold text-[var(--gh-green)] hover:underline break-all"
            >
              ▶ {drill.link_label || 'Watch it'} →
            </a>
          ) : (
            <p className="text-sm text-gray-400">No video on this one yet.</p>
          )}
        </div>

        {/* ── Make it a competition ── */}
        <div className="border-t border-gray-200 pt-3">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <div className="section-label">Competition</div>
            {!on ? (
              <button
                type="button"
                onClick={() => onComp({ key: suggestion.key, scores: sides.map(() => 0) })}
                className="btn btn-ghost !py-1 text-xs"
              >
                Make it a competition
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    const next = rollComp(seed, drill.category, nonce + 1)
                    setNonce(nonce + 1)
                    onComp({ ...comp!, key: next.key, own: undefined })
                  }}
                  className="btn btn-ghost !py-1 text-xs"
                >
                  ↻ Another one
                </button>
                <button
                  type="button"
                  onClick={() => onComp(null)}
                  className="text-xs font-bold text-gray-400 hover:text-gray-700"
                >
                  Not this one
                </button>
              </>
            )}
          </div>

          {!on ? (
            <p className="text-sm text-gray-500">
              <span className="font-bold text-gray-700">{suggestion.label}.</span> {suggestion.how}
            </p>
          ) : (
            <div className="space-y-2">
              <select
                value={comp?.own ? '' : comp?.key ?? ''}
                onChange={(e) => onComp({ ...comp!, key: e.target.value, own: e.target.value ? undefined : comp?.own })}
                className="field !py-1.5 text-sm"
              >
                <option value="">Something I&rsquo;ll write myself</option>
                {COMP_FORMATS.map((f) => (
                  <option key={f.key} value={f.key}>{f.label}</option>
                ))}
              </select>

              {comp?.key ? (
                <p className="text-sm text-gray-600">{shown.how}</p>
              ) : (
                <input
                  value={comp?.own ?? ''}
                  onChange={(e) => onComp({ ...comp!, own: e.target.value })}
                  placeholder="How this one is won"
                  className="field !py-1.5 text-sm"
                />
              )}

              <div>
                <div className="text-[0.6rem] font-black uppercase tracking-wider text-gray-400 mb-1">
                  Score
                </div>
                <div className="flex gap-2 flex-wrap">
                  {sides.map((side, i) => (
                    <label key={side} className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-gray-600">{side}</span>
                      <NumberField
                        integer
                        min={0}
                        value={comp?.scores[i] ?? 0}
                        onValue={(n) => setScore(i, n)}
                        className="field !py-1 !w-16 text-sm tabular-nums"
                        aria-label={`${side} score for ${drill.name}`}
                      />
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </details>
  )
}

function Part({ label, body, fallback }: { label: string; body: string | null; fallback: string }) {
  return (
    <div>
      <div className="section-label mb-1">{label}</div>
      {body?.trim() ? (
        <p className="text-sm text-gray-700 whitespace-pre-wrap">{body}</p>
      ) : (
        <p className="text-sm text-gray-400">{fallback}</p>
      )}
    </div>
  )
}
