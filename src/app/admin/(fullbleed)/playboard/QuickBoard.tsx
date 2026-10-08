'use client'
import Link from 'next/link'
import { useEffect, useRef, useState, useTransition } from 'react'
import { FieldBoard } from '@/components/planner/FieldBoard'
import { ClipPlayer } from '@/components/planner/ClipPlayer'
import { savePlayAction, deletePlayAction, saveShotAction } from '@/lib/actions'
import { addPlayToPlaybook } from '@/lib/playbookActions'
import { teamLabel, withTeam, type Team } from '@/lib/teams'
import type { PlaybookSpot } from '@/lib/playbookData'
import { clipLength } from '@/lib/planner'
import { EMPTY_BOARD, MAX_PLAY_STEPS, readBoard, type Board, type BoardClip, type BoardFrame, type PlayStep } from '@/lib/planner'
import { ProgressionPanel } from './Progression'

/**
 * The board you grab in a pinch.
 *
 * A coach on a sideline with thirty seconds does not want a practice plan, a
 * block and a drill — he wants a field and a marker. This is that: it opens
 * drawable, it goes full screen on one tap, and the board you were last working
 * on is still on the glass.
 *
 * Named plays go to the program, not to this browser: one drawn on the laptop
 * on Sunday has to open on the phone at practice on Monday, and every coach has
 * to be able to pull up the one the head coach drew. Only the unnamed scratch
 * board stays local, because a half-drawn thought is nobody else's business.
 *
 * Record catches the drawing as it happens — every change to the board, with
 * how far into the take it was — so the play saves as something that runs
 * rather than something that sits there. Screenshot saves a still of the field
 * to the Library, where any practice plan, note or game plan can pull it in.
 */

const SCRATCH = 'gh-playboard-v1'
/* What the board on the glass is: its name, and the saved play it is (if any).
   Kept beside the drawing, so coming back to the board brings back the title
   too, not just the lines. */
const SCRATCH_META = 'gh-playboard-open-v1'

interface OpenMeta {
  name: string
  openId: string | null
  openName: string
  /** The progression being built, and which step is on the board. */
  steps?: PlayStep[] | null
  active?: number
}

function loadMeta(plays: SavedPlay[], board: Board): OpenMeta {
  try {
    const m = JSON.parse(localStorage.getItem(SCRATCH_META) ?? 'null') as Partial<OpenMeta> | null
    if (!m) {
      // Nothing kept yet (a board from before titles were kept): if the drawing
      // is exactly a saved play, it is that play.
      const same = plays.find((p) => JSON.stringify(p.board) === JSON.stringify(board))
      return same
        ? { name: same.name, openId: same.id, openName: same.name, steps: same.steps, active: 0 }
        : { name: '', openId: null, openName: '' }
    }
    const name = typeof m?.name === 'string' ? m.name : ''
    // A play deleted since is no longer one to update; the name stays as typed.
    const openId = typeof m?.openId === 'string' && plays.some((p) => p.id === m.openId) ? m.openId : null
    const steps = Array.isArray(m?.steps)
      ? m.steps.flatMap((x) => {
          const b = readBoard((x as PlayStep | null)?.board)
          return b ? [{ board: b, note: typeof x?.note === 'string' ? x.note : '' }] : []
        }).slice(0, MAX_PLAY_STEPS)
      : null
    const active = steps?.length ? Math.min(Math.max(0, Number(m?.active) || 0), steps.length - 1) : 0
    return {
      name,
      openId,
      openName: openId && typeof m?.openName === 'string' ? m.openName : '',
      steps: steps?.length ? steps : null,
      active,
    }
  } catch {
    return { name: '', openId: null, openName: '' }
  }
}

export interface SavedPlay {
  id: string
  name: string
  board: Board
  clip: BoardClip | null
  /** A progression: the play as a run of steps. */
  steps: PlayStep[] | null
  createdBy: string | null
}

function loadScratch(): Board {
  try {
    const raw = localStorage.getItem(SCRATCH)
    return (raw ? readBoard(JSON.parse(raw)) : null) ?? EMPTY_BOARD
  } catch {
    return EMPTY_BOARD
  }
}

/** A play asked for in the address (?play=…), from the Library's Open button. */
function askedFor(plays: SavedPlay[]): SavedPlay | null {
  try {
    const id = new URLSearchParams(window.location.search).get('play')
    return (id && plays.find((p) => p.id === id)) || null
  } catch {
    return null
  }
}

export default function QuickBoard({
  plays,
  ready,
  playbookTeams = [],
  spots = {},
}: {
  plays: SavedPlay[]
  ready: boolean
  /** The decks this coach may add to — empty for everyone but the head coach. */
  playbookTeams?: Team[]
  /** Play id → the playbook pages it is already on. */
  spots?: Record<string, PlaybookSpot[]>
}) {
  const [first] = useState(() => askedFor(plays))
  const [board, setBoard] = useState<Board>(() => first?.board ?? loadScratch())
  const [meta] = useState(() => (first ? null : loadMeta(plays, board)))
  const [name, setName] = useState(first?.name ?? meta?.name ?? '')
  const [openId, setOpenId] = useState<string | null>(first?.id ?? meta?.openId ?? null)
  /* The name the open play was saved under. Type a different one and Save
     makes a new play, so the playbook links below stop pointing at the old one. */
  const [openName, setOpenName] = useState(first?.name ?? meta?.openName ?? '')
  /* The progression, when the play is being built as steps. The board above is
     always the picked step; drawing on it changes that step. */
  const [steps, setSteps] = useState<PlayStep[] | null>(first ? first.steps : (meta?.steps ?? null))
  const [active, setActive] = useState(first ? 0 : (meta?.active ?? 0))
  const [added, setAdded] = useState<Record<string, PlaybookSpot[]>>({})
  const [said, setSaid] = useState<{ ok: boolean; text: string; href?: string; link?: string } | null>(null)
  const [saving, startSaving] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)

  /* The take. While recording, every change to the board lands in here with the
     millisecond it happened, which is the whole recording — no timer, no
     frames anybody has to think about. */
  const [recording, setRecording] = useState(false)
  const [clip, setClip] = useState<BoardClip | null>(first?.clip ?? null)
  const [watching, setWatching] = useState(false)
  const frames = useRef<BoardFrame[]>([])
  const startedAt = useRef(0)
  const [shot, setShot] = useState<string | null>(null)
  /* The recent saves, behind one button. A row of chips was fine at two plays
     and a wall at twenty. */
  const [openList, setOpenList] = useState(false)

  /** Every change to the board goes through here, so recording is simply on or off. */
  function change(next: Board) {
    setBoard(next)
    if (steps) setSteps(steps.map((x, i) => (i === active ? { ...x, board: next } : x)))
    if (recording) {
      const at = Date.now() - startedAt.current
      // A take is thirty seconds of drawing, not an afternoon. Past the cap the
      // recording stops growing rather than filling the browser's memory.
      if (frames.current.length < 600) frames.current.push({ at, board: next })
    }
  }

  function startRecording() {
    frames.current = [{ at: 0, board }]
    startedAt.current = Date.now()
    setClip(null)
    setWatching(false)
    setRecording(true)
  }

  function stopRecording() {
    setRecording(false)
    const taken = frames.current
    // One frame is a still, and the board already is that.
    if (taken.length < 2) {
      setClip(null)
      return
    }
    setClip({ frames: [...taken, { at: Date.now() - startedAt.current, board }] })
  }

  /** A picture of the field, straight into the Library. */
  async function keepShot(png: Blob) {
    setShot('Saving…')
    try {
      const data = new FormData()
      data.set('file', new File([png], 'board.png', { type: 'image/png' }))
      data.set('folder', 'library')
      const res = await fetch('/api/upload', { method: 'POST', body: data })
      const body = (await res.json()) as { url?: string; error?: string }
      if (!res.ok || !body.url) {
        setShot(body.error ?? 'That picture would not save.')
        return
      }
      const row = new FormData()
      row.set('url', body.url)
      row.set('title', name.trim() || 'Board screenshot')
      await saveShotAction(row)
      setShot('Saved to the Library')
    } catch {
      setShot('That picture would not save.')
    }
  }

  useEffect(() => {
    if (!openList) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenList(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openList])

  useEffect(() => {
    try {
      localStorage.setItem(SCRATCH, JSON.stringify(board))
    } catch {
      // A full or blocked store is not a reason to stop drawing.
    }
  }, [board])

  useEffect(() => {
    try {
      localStorage.setItem(SCRATCH_META, JSON.stringify({ name, openId, openName, steps, active } satisfies OpenMeta))
    } catch {
      // as above
    }
  }, [name, openId, openName, steps, active])

  /** The open play, if what is on the glass is still saved under its name. */
  const currentId = openId && openName === name.trim() ? openId : null
  const spotsFor = (id: string | null) => (id ? [...(spots[id] ?? []), ...(added[id] ?? [])] : [])
  const here = spotsFor(currentId)

  function save() {
    if (!name.trim() || !ready) return
    const data = new FormData()
    data.set('name', name.trim())
    data.set('board', JSON.stringify(board))
    if (clip) data.set('clip', JSON.stringify(clip))
    data.set('steps', steps && steps.length > 1 ? JSON.stringify(steps) : '')
    setSaid(null)
    startSaving(async () => {
      const r = await savePlayAction(data)
      if (r?.id) {
        setOpenId(r.id)
        setOpenName(name.trim())
        const books = (r.playbooks ?? []).map((t) => `${teamLabel(t)} playbook`).join(' and ')
        setSaid({
          ok: true,
          text: `Saved “${name.trim()}”${steps && steps.length > 1 ? `, all ${steps.length} steps` : ''}. ${
            books ? `The ${books} ${r.playbooks!.length > 1 ? 'are' : 'is'} up to date too.` : 'It’s under Open and in the Library.'
          }`,
        })
      } else setSaid({ ok: false, text: 'That didn’t save. Try again.' })
    })
  }

  /* The other button. The Library is a shelf; the playbook is what we run.
     Saves the play, gives it a page at the end of that team's playbook (or
     finds the one it already has), and stays here with a link to it. */
  function toPlaybook(team: Team) {
    if (!name.trim() || !ready) return
    setSaid(null)
    startSaving(async () => {
      const r = await addPlayToPlaybook({
        team,
        name: name.trim(),
        board: JSON.stringify(board),
        clip: clip ? JSON.stringify(clip) : null,
        steps: steps && steps.length > 1 ? JSON.stringify(steps) : null,
      })
      if (!r.ok) {
        setSaid({ ok: false, text: r.error })
        return
      }
      setOpenId(r.playId)
      setOpenName(name.trim())
      setAdded((x) => ({ ...x, [r.playId]: [...(x[r.playId] ?? []), { team: r.team, pageId: r.pageId }] }))
      const many = steps && steps.length > 1
      setSaid({
        ok: true,
        text: `“${name.trim()}” is in the ${teamLabel(r.team)} playbook${many ? `, ${steps.length} pages` : ''}.${r.note}`,
        href: withTeam(`/admin/playbook/${r.pageId}`, r.team),
        link: many ? 'Open the first page →' : 'Open its page →',
      })
    })
  }

  // ── Progression ─────────────────────────────────────────────────────────

  /** Put a step on the board. */
  function pick(i: number, list: PlayStep[] | null = steps) {
    if (!list?.[i]) return
    setActive(i)
    setBoard(list[i].board)
    setWatching(false)
  }

  function startProgression() {
    setSteps([{ board, note: '' }])
    setActive(0)
  }

  /** The next step starts as a copy of this one: move the players, draw what happens next. */
  function addStep() {
    if (!steps || steps.length >= MAX_PLAY_STEPS) return
    const next = [...steps.slice(0, active + 1), { board, note: '' }, ...steps.slice(active + 1)]
    setSteps(next)
    pick(active + 1, next)
  }

  function copyStep(i: number) {
    if (!steps || steps.length >= MAX_PLAY_STEPS) return
    const next = [...steps.slice(0, i + 1), { ...steps[i] }, ...steps.slice(i + 1)]
    setSteps(next)
    pick(i + 1, next)
  }

  function moveStep(i: number, to: number) {
    if (!steps || to < 0 || to >= steps.length) return
    const next = [...steps]
    const [s] = next.splice(i, 1)
    next.splice(to, 0, s)
    setSteps(next)
    // The picked step stays picked wherever it went.
    setActive(active === i ? to : active === to ? i : active)
  }

  function deleteStep(i: number) {
    if (!steps || steps.length < 2) return
    const next = steps.filter((_, k) => k !== i)
    setSteps(next)
    pick(Math.min(i === active ? i : active > i ? active - 1 : active, next.length - 1), next)
  }

  function noteStep(note: string) {
    if (steps) setSteps(steps.map((x, i) => (i === active ? { ...x, note } : x)))
  }

  /** Back to one play: the step on the board is what stays. */
  function endProgression() {
    if (steps && steps.length > 1 && !window.confirm(`Keep only step ${active + 1} and drop the other ${steps.length - 1}?`)) return
    setSteps(null)
    setActive(0)
  }

  function open(play: SavedPlay) {
    setBoard(play.board)
    setSteps(play.steps)
    setActive(0)
    setOpenId(play.id)
    setOpenName(play.name)
    setName(play.name)
    setSaid(null)
    setClip(play.clip)
    setWatching(false)
    setOpenList(false)
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="font-black text-lg mr-2">Playboard</h1>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); save() } }}
          placeholder="Name this play"
          className="field !py-1.5 !w-44 text-sm"
        />
        <button
          type="button"
          onClick={save}
          disabled={!name.trim() || saving || !ready}
          className="btn btn-primary !py-1.5 text-sm disabled:opacity-50"
        >
          {saving ? 'Saving…' : currentId ? 'Update' : 'Save'}
        </button>
        {playbookTeams.map((t) => {
          const label = playbookTeams.length > 1 ? `${teamLabel(t)} playbook` : 'Playbook'
          const spot = here.find((x) => x.team === t)
          return spot ? (
            <span key={t} className="inline-flex items-center gap-1">
              <Link
                href={withTeam(`/admin/playbook/${spot.pageId}`, t)}
                title={`Open its page in the ${teamLabel(t)} playbook`}
                className="btn btn-ghost !py-1.5 text-sm"
                style={{ color: 'var(--gh-green)', borderColor: 'var(--gh-green)' }}
              >
                ✓ In {label} ↗
              </Link>
              {/* A progression's pages are copies of its steps: this brings them up to date. */}
              {steps && steps.length > 1 && (
                <button
                  type="button"
                  onClick={() => toPlaybook(t)}
                  disabled={saving || !ready}
                  title={`Update the ${teamLabel(t)} playbook pages to match these steps`}
                  className="btn btn-ghost !py-1.5 !px-2.5 text-sm disabled:opacity-50"
                  aria-label={`Update the ${label} pages`}
                >
                  ↻
                </button>
              )}
            </span>
          ) : (
            <button
              key={t}
              type="button"
              onClick={() => toPlaybook(t)}
              disabled={!name.trim() || saving || !ready}
              title={name.trim() ? `Save it and add it to the ${teamLabel(t)} playbook` : 'Name the play first'}
              className="btn btn-ghost !py-1.5 text-sm disabled:opacity-50"
            >
              📘 Add to {label}
            </button>
          )
        })}
        <button
          type="button"
          onClick={() => {
            setBoard(EMPTY_BOARD)
            setSteps(null)
            setActive(0)
            setOpenId(null)
            setOpenName('')
            setSaid(null)
            setName('')
            setClip(null)
            setWatching(false)
            setRecording(false)
          }}
          className="btn btn-ghost !py-1.5 text-sm"
        >
          New
        </button>
        {/* Recent saves, one tap away, newest first. */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpenList(!openList)}
            aria-expanded={openList}
            disabled={plays.length === 0}
            className="btn btn-ghost !py-1.5 text-sm disabled:opacity-40"
            title={plays.length ? 'Open a play you saved' : 'Nothing saved yet'}
          >
            Open{plays.length > 0 && <span className="text-gray-400"> · {plays.length}</span>} ▾
          </button>

          {openList && (
            <>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setOpenList(false)}
                className="fixed inset-0 z-40 cursor-default"
              />
              <div
                className="absolute left-0 top-full mt-1 z-50 w-72 rounded-xl border border-gray-200 bg-white shadow-2xl overflow-hidden"
                style={{ maxHeight: '60vh', overflowY: 'auto' }}
              >
                <div className="px-3 pt-2 pb-1 text-[0.65rem] font-black tracking-wider uppercase text-gray-400">
                  Your plays · newest first
                </div>
                {plays.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-1 px-1.5 hover:bg-gray-50"
                    style={{ background: openId === p.id ? '#f0f4f1' : undefined }}
                  >
                    <button
                      type="button"
                      onClick={() => open(p)}
                      title={p.createdBy ? `Drawn by ${p.createdBy}` : undefined}
                      className="flex-1 text-left px-2 py-2 text-sm font-semibold truncate"
                    >
                      {p.name}
                      {p.clip && (
                        <span className="text-[0.65rem] font-black text-gray-400 ml-1.5">
                          ▶ {(clipLength(p.clip) / 1000).toFixed(0)}s
                        </span>
                      )}
                      {p.steps && (
                        <span className="text-[0.65rem] font-black text-gray-400 ml-1.5">{p.steps.length} steps</span>
                      )}
                      {Array.from(new Set(spotsFor(p.id).map((x) => x.team))).map((t) => (
                        <span key={t} className="ml-1.5 text-[0.6rem] font-black uppercase tracking-wide rounded px-1 py-0.5 bg-[#eef6f1] text-[var(--gh-green)]">
                          {teamLabel(t)}
                        </span>
                      ))}
                    </button>
                    <form
                      ref={formRef}
                      action={deletePlayAction}
                      onSubmit={() => { if (openId === p.id) setOpenId(null) }}
                    >
                      <input type="hidden" name="id" value={p.id} />
                      <button
                        type="submit"
                        aria-label={`Delete ${p.name}`}
                        className="px-2 py-2 text-gray-300 hover:text-[var(--gh-maroon)]"
                      >
                        ×
                      </button>
                    </form>
                  </div>
                ))}
                <Link
                  href="/admin/library"
                  onClick={() => setOpenList(false)}
                  className="block px-3 py-2.5 text-sm font-bold border-t border-gray-100"
                  style={{ color: 'var(--gh-green)' }}
                >
                  Everything in the Library →
                </Link>
              </div>
            </>
          )}
        </div>

        <Link
          href="/admin/library"
          className="btn btn-ghost !py-1.5 text-sm"
          title="Every play, every recording, every screenshot"
        >
          Library
        </Link>

        <span className="text-xs text-gray-400 ml-auto">
          {ready ? 'Saved plays open on any device, for every coach' : 'Run the plays SQL to save plays'}
        </span>
      </div>


      {said && (
        <p className={`text-sm font-semibold -mt-1 ${said.ok ? 'text-[var(--gh-green)]' : 'text-red-700'}`} role="status">
          {said.ok && '✓ '}
          {said.text}
          {said.href && (
            <Link href={said.href} className="ml-2 underline">
              {said.link}
            </Link>
          )}
        </p>
      )}
      {shot && <p className="text-xs text-gray-500 -mt-1">{shot}</p>}

      <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-4">
        <div className="flex-1 min-w-0 min-h-0">
        {steps && (
          <p className="text-xs font-bold text-[var(--gh-green)] mb-1">
            Step {active + 1} of {steps.length}
            {steps[active]?.note ? ` · ${steps[active].note}` : ''}
          </p>
        )}
        {watching && clip ? (
          <ClipPlayer clip={clip} autoPlay />
        ) : (
          <FieldBoard
            board={board}
            onChange={change}
            onShot={keepShot}
            extraTools={
              <>
                <button
                  type="button"
                  onClick={recording ? stopRecording : startRecording}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-bold border"
                  style={{
                    borderColor: recording ? 'var(--gh-maroon)' : '#e5e7eb',
                    background: recording ? 'var(--gh-maroon)' : '#fff',
                    color: recording ? '#fff' : '#6b7280',
                  }}
                  title={recording ? 'Stop recording this play' : 'Record the play as you draw it'}
                >
                  <span
                    className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle"
                    style={{ background: recording ? '#fff' : 'var(--gh-maroon)' }}
                  />
                  {recording ? 'Stop' : 'Record'}
                </button>
                {clip && !recording && (
                  <button
                    type="button"
                    onClick={() => setWatching(true)}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-bold border border-gray-200 bg-white hover:bg-gray-50"
                    title="Watch the take back"
                  >
                    Play it back
                  </button>
                )}
              </>
            }
          />
        )}
        </div>
        <ProgressionPanel
          steps={steps}
          active={active}
          onStart={startProgression}
          onPick={(i) => pick(i)}
          onAdd={addStep}
          onMove={moveStep}
          onCopy={copyStep}
          onDelete={deleteStep}
          onNote={noteStep}
          onEnd={endProgression}
        />
      </div>

      {watching && (
        <button
          type="button"
          onClick={() => setWatching(false)}
          className="btn btn-ghost !py-1.5 text-sm self-start"
        >
          Back to drawing
        </button>
      )}
    </div>
  )
}
