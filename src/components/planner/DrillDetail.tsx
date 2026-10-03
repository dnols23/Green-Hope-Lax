'use client'
import { useState, useTransition } from 'react'
import NumberField from '@/components/NumberField'
import { saveDrillBoard, saveDrillCompetitions, saveDrillDetails } from '@/lib/actions'
import { EMPTY_BOARD, boardIsBlank, newId, type Board } from '@/lib/planner'
import { FieldBoard } from './FieldBoard'
import {
  COMP_FORMATS,
  CONSEQUENCES,
  consequenceOf,
  formatOf,
  rollComp,
  rollConsequence,
  sameComp,
  type BlockComp,
  type CompFormat,
  type Consequence,
  type SavedComp,
} from '@/lib/compete'
import { addConsequence } from '@/lib/competitionActions'
import type { Drill } from '@/lib/drills'

/**
 * What the drill is, folded away until somebody wants it.
 *
 * A practice plan is a list of names and minutes, which is enough for the coach
 * who wrote it and nothing at all for the one running it for the first time.
 * Open this and the drill explains itself: how it goes out, how it runs, what
 * it is for, the video and the diagram. How the block is being won is its own
 * section (BlockCompetition), outside the drill.
 */
export function DrillDetail({ drill: fromBank }: { drill: Drill }) {
  /* The write-up can be filled in right here and goes back to the drill bank.
     What was just saved shows at once, before the bank catches up. */
  const [drill, setDrill] = useState(fromBank)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({ setup: '', context: '', variations: '', link: '', linkLabel: '' })
  const [saving, startSaving] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const empty = ![drill.setup, drill.description, drill.context, drill.variations, drill.link].some((v) => v?.trim()) && !drill.board


  function edit() {
    setDraft({
      setup: drill.setup ?? '',
      context: drill.context ?? '',
      variations: drill.variations ?? '',
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
        context: draft.context.trim() || null,
        variations: draft.variations.trim() || null,
        link: draft.link.trim() || null,
        link_label: draft.linkLabel.trim() || null,
      }))
      setEditing(false)
    })
  }

  return (
    <details className="mt-2 rounded-lg border border-gray-200 bg-gray-50">
      <summary className="cursor-pointer list-none px-3 py-2 flex items-center gap-2 flex-wrap text-sm">
        <span className="caret text-xs text-gray-400">▸</span>
        <span className="font-bold text-gray-700">What this drill is</span>
        {empty && <span className="text-xs font-semibold text-[var(--gh-maroon)]">No details yet</span>}
        {drill.board && <span className="badge badge-sched">Diagram</span>}
        {drill.link && <span className="badge badge-sched">Video</span>}
        <span className="ml-auto text-xs text-gray-400">{drill.name}</span>
      </summary>

      <div className="px-3 pb-3 pt-1 space-y-3 border-t border-gray-200">
        {editing ? (
          <div className="space-y-2.5 pt-2">
            <DetailBox label="Setup" value={draft.setup} rows={2} placeholder="Two lines at X, balls at the front of each, goalie in" onChange={(v) => setDraft((d) => ({ ...d, setup: v }))} />
            <DetailBox label="Variations" value={draft.variations} rows={2} placeholder="Harder, easier, live, weak hand only…" onChange={(v) => setDraft((d) => ({ ...d, variations: v }))} />
            <DetailBox label="Context" value={draft.context} rows={2} placeholder="What good looks like; what to coach" onChange={(v) => setDraft((d) => ({ ...d, context: v }))} />
            <div>
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
              <label className="block mt-2">
                <span className="section-label">Link name (optional)</span>
                <input
                  value={draft.linkLabel}
                  onChange={(e) => setDraft((d) => ({ ...d, linkLabel: e.target.value }))}
                  maxLength={80}
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
            <Part label="Variations" body={drill.variations} fallback="No variations written yet." />
            <Part label="Context" body={drill.context} fallback="Nobody has written down what it is for yet." />

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
      </div>
    </details>
  )
}

/**
 * How a block is being won, and the score — its own section, outside the
 * drill. With a drill picked, what worked can be saved to the drill and its
 * saved competitions come first.
 */
export function BlockCompetition({
  drill,
  comp,
  sides,
  seed,
  formats = COMP_FORMATS,
  consequences = CONSEQUENCES,
  onComp,
}: {
  /** The block's main drill, if it has one. */
  drill: Drill | null
  comp: BlockComp | null | undefined
  /** The squads this practice is split into. */
  sides: string[]
  /** Keeps the rolled competition the same from one day to the next. */
  seed: string
  /** The staff's competitions; the built-ins until they have some. */
  formats?: CompFormat[]
  /** What the losers can be made to do: the built-ins and the staff's own. */
  consequences?: Consequence[]
  onComp: (next: BlockComp | null) => void
}) {
  // How many times he has asked for a different one.
  const [nonce, setNonce] = useState(0)
  const [saving, startSaving] = useTransition()
  // Competitions kept on the drill because they worked.
  const [kept, setKept] = useState<SavedComp[]>(drill?.competitions ?? [])
  const [keepError, setKeepError] = useState<string | null>(null)
  const isKept = !!comp && kept.some((k) => sameComp(k, comp))

  function writeKept(next: SavedComp[]) {
    setKeepError(null)
    startSaving(async () => {
      if (!drill) return
      const res = await saveDrillCompetitions(drill.id, next)
      if (!res.ok) {
        setKeepError(res.error)
        return
      }
      setKept(next)
    })
  }
  const keep = () => {
    if (!drill || !comp || isKept || (!comp.key && !comp.own?.trim())) return
    writeKept([
      ...kept,
      {
        id: newId('c'),
        key: comp.key,
        ...(comp.own?.trim() ? { own: comp.own.trim() } : {}),
        ...(comp.penalty ? { penalty: comp.penalty } : {}),
        savedAt: new Date().toISOString(),
      },
    ])
  }
  const use = (k: SavedComp) =>
    onComp({
      key: k.key,
      ...(k.own ? { own: k.own } : {}),
      penalty: k.penalty ?? comp?.penalty ?? rollConsequence(seed, 0, consequences).key,
      scores: sides.map(() => 0),
    })

  const chosen = comp?.key ? formatOf(comp.key, formats) : null
  const suggestion = rollComp(seed, drill?.category, nonce, formats)
  // The ones that suit this drill first, then the rest.
  const suits = (f: CompFormat) => f.fits !== 'any' && !!drill && f.fits.includes(drill.category)
  const ordered = [...formats.filter(suits), ...formats.filter((f) => !suits(f))]
  const [picking, setPicking] = useState(false)
  const shown = chosen ?? suggestion
  const on = !!comp

  const setScore = (i: number, n: number) => {
    if (!comp) return
    const scores = sides.map((_, k) => (k === i ? n : comp.scores[k] ?? 0))
    onComp({ ...comp, scores })
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
      {/* ── Make it a competition ── */}
      <div>
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <div className="section-label">Competition</div>
          {!on ? (
            <button
              type="button"
              onClick={() =>
                onComp({ key: suggestion.key, penalty: rollConsequence(seed, 0, consequences).key, scores: sides.map(() => 0) })
              }
              className="btn btn-ghost !py-1 text-xs"
            >
              Make it a competition
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  const next = rollComp(seed, drill?.category, nonce + 1, formats)
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
            <span className="font-bold text-gray-700">{suggestion.label}.</span> {suggestion.summary || suggestion.how}
          </p>
        ) : (
          <div className="space-y-2">
            {/* What it is, in a sentence, and every other choice a tap away. */}
            <div className="rounded-lg border border-gray-200 bg-white">
              <button
                type="button"
                onClick={() => setPicking((v) => !v)}
                aria-expanded={picking}
                className="w-full text-left px-3 py-2 flex items-start gap-2"
              >
                <span className="flex-1 min-w-0 text-sm">
                  <span className="font-bold text-gray-800">{comp?.key ? shown.label : 'Our own'}</span>
                  {comp?.key && shown.summary && <span className="text-gray-600"> — {shown.summary}</span>}
                </span>
                <span className="text-xs font-bold text-[var(--gh-green)] shrink-0 mt-0.5">{picking ? 'Close' : 'Change'}</span>
              </button>
              {picking && (
                <ul className="border-t border-gray-100 max-h-72 overflow-y-auto" role="listbox" aria-label="Competition">
                  {ordered.map((f) => {
                    const current = comp?.key === f.key && !comp?.own
                    return (
                      <li key={f.key}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={current}
                          onClick={() => {
                            onComp({ ...comp!, key: f.key, own: undefined })
                            setPicking(false)
                          }}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${current ? 'bg-[#e6f2ec]' : ''}`}
                        >
                          <span className="font-bold text-gray-800">{f.label}</span>
                          {suits(f) && <span className="ml-1.5 text-[0.6rem] font-black uppercase tracking-wide text-[var(--gh-green)]">Suits this drill</span>}
                          <span className="block text-gray-600">{f.summary || f.how}</span>
                        </button>
                      </li>
                    )
                  })}
                  <li>
                    <button
                      type="button"
                      onClick={() => {
                        onComp({ ...comp!, key: '', own: comp?.own ?? '' })
                        setPicking(false)
                      }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 border-t border-gray-100"
                    >
                      <span className="font-bold text-gray-800">Something I&rsquo;ll write myself</span>
                    </button>
                  </li>
                </ul>
              )}
            </div>

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
                      aria-label={`${side} score`}
                    />
                  </label>
                ))}
              </div>
            </div>

            <LosersPicker
              list={consequences}
              value={comp?.penalty}
              seed={seed}
              onChange={(penalty) => onComp({ ...comp!, penalty })}
            />

            {drill && (
            <button
              type="button"
              onClick={keep}
              disabled={isKept || saving || (!comp?.key && !comp?.own?.trim())}
              className="btn btn-ghost !py-1 text-xs disabled:opacity-60"
            >
              {isKept ? '★ Saved to this drill' : '☆ Save to this drill'}
            </button>
            )}
          </div>
        )}

        {/* ── The ones that worked ── */}
        {kept.length > 0 && (
          <div className="mt-3">
            <div className="text-[0.6rem] font-black uppercase tracking-wider text-gray-400 mb-1">
              Saved for this drill
            </div>
            <ul className="space-y-1.5">
              {kept.map((k) => {
                const f = formatOf(k.key, formats)
                const current = !!comp && sameComp(k, comp)
                return (
                  <li key={k.id} className="flex items-start gap-2 rounded-lg border border-gray-200 bg-white px-2.5 py-2">
                    <div className="flex-1 min-w-0 text-sm">
                      <span className="font-bold text-gray-700">{f?.label ?? 'Our own'}.</span>{' '}
                      <span className="text-gray-600">{k.own ?? (f?.summary || f?.how)}</span>
                      {k.penalty && consequenceOf(k.penalty, consequences) && (
                        <span className="block text-xs text-gray-500">Losers: {consequenceOf(k.penalty, consequences)?.label}</span>
                      )}
                    </div>
                    {current ? (
                      <span className="shrink-0 text-xs font-bold text-[var(--gh-green)] self-center">In use</span>
                    ) : (
                      <button type="button" onClick={() => use(k)} className="btn btn-ghost !py-0.5 !px-2.5 text-xs shrink-0">
                        Use
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => writeKept(kept.filter((x) => x.id !== k.id))}
                      disabled={saving}
                      className="shrink-0 w-7 h-7 -my-0.5 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                      aria-label="Take it off this drill"
                    >
                      ×
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
        {keepError && <p className="text-sm font-semibold text-red-700 mt-2" role="alert">{keepError}</p>}
      </div>
    </div>
  )
}

/**
 * What the losing side does. Picked for the competition, changeable, or none;
 * a new one can be added to everybody's list right from here.
 */
function LosersPicker({
  list: given,
  value,
  seed,
  onChange,
}: {
  list: Consequence[]
  value?: string
  seed: string
  onChange: (key: string | undefined) => void
}) {
  const [added, setAdded] = useState<Consequence[]>([])
  const list = [...given, ...added.filter((a) => !given.some((g) => g.key === a.key))]
  const [open, setOpen] = useState(false)
  const [nonce, setNonce] = useState(1)
  const [adding, setAdding] = useState(false)
  const [label, setLabel] = useState('')
  const [summary, setSummary] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, startSaving] = useTransition()
  const current = consequenceOf(value, list)

  function add() {
    setError(null)
    startSaving(async () => {
      const res = await addConsequence(label, summary)
      if (!res.ok) {
        setError(res.error)
        return
      }
      setAdded((a) => [...a, res.item])
      onChange(res.item.key)
      setLabel('')
      setSummary('')
      setAdding(false)
      setOpen(false)
    })
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <div className="text-[0.6rem] font-black uppercase tracking-wider text-gray-400">Losers</div>
        {current && (
          <button
            type="button"
            onClick={() => {
              onChange(rollConsequence(seed, nonce, list).key)
              setNonce((n) => n + 1)
            }}
            className="text-xs font-bold text-gray-500 hover:text-gray-800"
          >
            ↻ Another
          </button>
        )}
      </div>
      <div className="rounded-lg border border-gray-200 bg-white">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="w-full text-left px-3 py-2 flex items-start gap-2"
        >
          <span className="flex-1 min-w-0 text-sm">
            {current ? (
              <>
                <span className="font-bold text-gray-800">{current.label}</span>
                {current.summary && <span className="text-gray-600"> — {current.summary}</span>}
              </>
            ) : (
              <span className="text-gray-500">No consequence</span>
            )}
          </span>
          <span className="text-xs font-bold text-[var(--gh-green)] shrink-0 mt-0.5">{open ? 'Close' : 'Change'}</span>
        </button>
        {open && (
          <div className="border-t border-gray-100">
            <ul className="max-h-64 overflow-y-auto" role="listbox" aria-label="Consequence">
              {list.map((c) => (
                <li key={c.key}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={c.key === value}
                    onClick={() => {
                      onChange(c.key)
                      setOpen(false)
                    }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${c.key === value ? 'bg-[#e6f2ec]' : ''}`}
                  >
                    <span className="font-bold text-gray-800">{c.label}</span>
                    {!c.builtIn && <span className="ml-1.5 text-[0.6rem] font-black uppercase tracking-wide text-gray-400">Ours</span>}
                    <span className="block text-gray-600">{c.summary}</span>
                  </button>
                </li>
              ))}
              <li>
                <button
                  type="button"
                  onClick={() => {
                    onChange(undefined)
                    setOpen(false)
                  }}
                  className="w-full text-left px-3 py-2 text-sm text-gray-500 hover:bg-gray-50 border-t border-gray-100"
                >
                  No consequence
                </button>
              </li>
            </ul>
            <div className="border-t border-gray-100 px-3 py-2">
              {adding ? (
                <div className="space-y-2">
                  <input
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    maxLength={60}
                    placeholder="Name — e.g. Pinnie pickup"
                    aria-label="Name"
                    className="field !py-1.5 text-sm"
                  />
                  <input
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    maxLength={200}
                    placeholder="What the losers do, in a sentence"
                    aria-label="What the losers do"
                    className="field !py-1.5 text-sm"
                  />
                  {error && <p className="text-xs font-semibold text-red-700" role="alert">{error}</p>}
                  <div className="flex gap-2">
                    <button type="button" onClick={add} disabled={saving || !label.trim()} className="btn btn-primary !py-1 text-xs disabled:opacity-60">
                      {saving ? 'Adding…' : 'Add to the list'}
                    </button>
                    <button type="button" onClick={() => setAdding(false)} className="btn btn-ghost !py-1 text-xs">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" onClick={() => setAdding(true)} className="text-sm font-bold text-[var(--gh-green)]">
                  + New consequence
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * A drill's field diagram, drawn where the drill is being looked at — in a
 * practice or in the bank — and saved to the drill, so every plan has it.
 */
export function DrillDiagram({ drill, onSaved }: { drill: Drill; onSaved?: (board: Board | null) => void }) {
  return (
    <DiagramField
      board={drill.board}
      title={drill.name}
      save={async (next) => {
        const res = await saveDrillBoard(drill.id, next)
        if (res.ok) onSaved?.(next)
        return res
      }}
    />
  )
}

/** A field diagram that belongs to something — a drill, a competition — and saves to it. */
export function DiagramField({
  board: initial,
  title,
  save,
}: {
  board: Board | null | undefined
  title: string
  save: (next: Board | null) => Promise<{ ok: true } | { ok: false; error: string }>
}) {
  const [board, setBoard] = useState(initial ?? null)
  const [drawing, setDrawing] = useState(false)
  const [sketch, setSketch] = useState<Board>(EMPTY_BOARD)
  const [boardError, setBoardError] = useState<string | null>(null)
  const [saving, startSaving] = useTransition()

  function saveBoard(drawn: Board | null) {
    // A field with nothing on it is no diagram, which is how it is stored.
    const next = drawn && !boardIsBlank(drawn) ? drawn : null
    setBoardError(null)
    startSaving(async () => {
      const res = await save(next)
      if (!res.ok) {
        setBoardError(res.error)
        return
      }
      setBoard(next)
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
          <FieldBoard board={sketch} onChange={setSketch} title={title} />
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
        <FieldBoard board={board} readOnly title={title} />
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
