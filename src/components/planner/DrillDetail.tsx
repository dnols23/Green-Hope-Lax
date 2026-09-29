'use client'
import { useState, useTransition } from 'react'
import NumberField from '@/components/NumberField'
import { saveDrillBoard, saveDrillDetails } from '@/lib/actions'
import { EMPTY_BOARD, type Board } from '@/lib/planner'
import { FieldBoard } from './FieldBoard'
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
  drill: fromBank,
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
  /* The write-up can be filled in right here and goes back to the drill bank.
     What was just saved shows at once, before the bank catches up. */
  const [drill, setDrill] = useState(fromBank)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({ setup: '', description: '', context: '', link: '', linkLabel: '' })
  const [saving, startSaving] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const empty = ![drill.setup, drill.description, drill.context, drill.link].some((v) => v?.trim()) && !drill.board


  function edit() {
    setDraft({
      setup: drill.setup ?? '',
      description: drill.description ?? '',
      context: drill.context ?? '',
      link: drill.link ?? '',
      linkLabel: drill.link_label ?? '',
    })
    setError(null)
    setEditing(true)
  }

  function save() {
    setError(null)
    startSaving(async () => {
      const res = await saveDrillDetails(drill.id, draft)
      if (!res.ok) {
        setError(res.error)
        return
      }
      setDrill((d) => ({
        ...d,
        setup: draft.setup.trim() || null,
        description: draft.description.trim() || null,
        context: draft.context.trim() || null,
        link: draft.link.trim() || null,
        link_label: draft.linkLabel.trim() || null,
      }))
      setEditing(false)
    })
  }

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
        {empty && <span className="text-xs font-semibold text-[var(--gh-maroon)]">No details yet</span>}
        {drill.board && <span className="badge badge-sched">Diagram</span>}
        {drill.link && <span className="badge badge-sched">Video</span>}
        {on && (
          <span className="badge badge-conf">
            {comp?.own ? 'Competition' : shown.label}
          </span>
        )}
        <span className="ml-auto text-xs text-gray-400">{drill.name}</span>
      </summary>

      <div className="px-3 pb-3 pt-1 space-y-3 border-t border-gray-200">
        {editing ? (
          <div className="space-y-2.5 pt-2">
            <DetailBox label="Setup" value={draft.setup} rows={2} placeholder="Two lines at X, balls at the front of each, goalie in" onChange={(v) => setDraft((d) => ({ ...d, setup: v }))} />
            <DetailBox label="How it runs" value={draft.description} rows={3} placeholder="Step by step: who goes, where, when it ends" onChange={(v) => setDraft((d) => ({ ...d, description: v }))} />
            <DetailBox label="Why we run it" value={draft.context} rows={2} placeholder="What good looks like; what to coach" onChange={(v) => setDraft((d) => ({ ...d, context: v }))} />
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_12rem] gap-2">
              <label className="block">
                <span className="section-label">Video link</span>
                <input
                  type="url"
                  inputMode="url"
                  value={draft.link}
                  onChange={(e) => setDraft((d) => ({ ...d, link: e.target.value }))}
                  placeholder="https://"
                  className="field !py-1.5 text-sm mt-1"
                />
              </label>
              <label className="block">
                <span className="section-label">Link says</span>
                <input
                  value={draft.linkLabel}
                  onChange={(e) => setDraft((d) => ({ ...d, linkLabel: e.target.value }))}
                  placeholder="Watch it"
                  className="field !py-1.5 text-sm mt-1"
                />
              </label>
            </div>
            {error && <p className="text-sm font-semibold text-red-700" role="alert">{error}</p>}
            <div className="flex items-center gap-2">
              <button type="button" onClick={save} disabled={saving} className="btn btn-primary !py-1.5 text-sm disabled:opacity-60">
                {saving ? 'Saving…' : 'Save to the drill'}
              </button>
              <button type="button" onClick={() => setEditing(false)} className="btn btn-ghost !py-1.5 text-sm">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex justify-end -mb-1 pt-1">
              <button type="button" onClick={edit} className="btn btn-ghost !py-1 text-xs">
                {empty ? '+ Add details' : '✎ Edit details'}
              </button>
            </div>
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
          </>
        )}

        {/* ── The drill on the field ── */}
        <DrillDiagram drill={drill} onSaved={(board) => setDrill((d) => ({ ...d, board }))} />

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

/**
 * A drill's field diagram, drawn where the drill is being looked at — in a
 * practice or in the bank — and saved to the drill, so every plan has it.
 */
export function DrillDiagram({ drill, onSaved }: { drill: Drill; onSaved?: (board: Board | null) => void }) {
  const [board, setBoard] = useState(drill.board)
  const [drawing, setDrawing] = useState(false)
  const [sketch, setSketch] = useState<Board>(EMPTY_BOARD)
  const [boardError, setBoardError] = useState<string | null>(null)
  const [saving, startSaving] = useTransition()

  function saveBoard(drawn: Board | null) {
    // A field with nothing on it is no diagram, which is how it is stored.
    const next = drawn && (drawn.tokens.length || drawn.paths.length || drawn.texts.length || drawn.view) ? drawn : null
    setBoardError(null)
    startSaving(async () => {
      const res = await saveDrillBoard(drill.id, next)
      if (!res.ok) {
        setBoardError(res.error)
        return
      }
      setBoard(next)
      onSaved?.(next)
      setDrawing(false)
    })
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <div className="section-label">Field diagram</div>
        {!drawing && (
          <button
            type="button"
            onClick={() => {
              setSketch(board ?? EMPTY_BOARD)
              setBoardError(null)
              setDrawing(true)
            }}
            className="btn btn-ghost !py-1 text-xs ml-auto"
          >
            {board ? '✎ Edit the diagram' : '+ Draw it'}
          </button>
        )}
      </div>
      {drawing ? (
        <div className="space-y-2">
          <FieldBoard board={sketch} onChange={setSketch} title={drill.name} />
          {boardError && <p className="text-sm font-semibold text-red-700" role="alert">{boardError}</p>}
          <div className="flex items-center gap-2 flex-wrap">
            <button type="button" onClick={() => saveBoard(sketch)} disabled={saving} className="btn btn-primary !py-1.5 text-sm disabled:opacity-60">
              {saving ? 'Saving…' : 'Save to the drill'}
            </button>
            <button type="button" onClick={() => setDrawing(false)} className="btn btn-ghost !py-1.5 text-sm">
              Cancel
            </button>
            {board && (
              <button
                type="button"
                onClick={() => saveBoard(null)}
                disabled={saving}
                className="ml-auto text-xs font-bold text-gray-400 hover:text-red-700"
              >
                Take the diagram off
              </button>
            )}
          </div>
        </div>
      ) : board ? (
        <FieldBoard board={board} readOnly title={drill.name} />
      ) : (
        <p className="text-sm text-gray-400">Not drawn yet.</p>
      )}
    </div>
  )
}

function DetailBox({
  label,
  value,
  rows,
  placeholder,
  onChange,
}: {
  label: string
  value: string
  rows: number
  placeholder: string
  onChange: (v: string) => void
}) {
  return (
    <label className="block">
      <span className="section-label">{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        className="field !py-1.5 text-sm mt-1"
      />
    </label>
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
