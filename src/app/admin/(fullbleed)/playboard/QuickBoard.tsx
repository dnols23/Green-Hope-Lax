'use client'
import Link from 'next/link'
import { useEffect, useRef, useState, useTransition } from 'react'
import { FieldBoard } from '@/components/planner/FieldBoard'
import { ClipPlayer } from '@/components/planner/ClipPlayer'
import { savePlayAction, deletePlayAction, saveShotAction } from '@/lib/actions'
import { playToPlaybook } from '@/lib/playbookActions'
import { teamLabel, type Team } from '@/lib/teams'
import { clipLength } from '@/lib/planner'
import { EMPTY_BOARD, readBoard, type Board, type BoardClip, type BoardFrame } from '@/lib/planner'

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

export interface SavedPlay {
  id: string
  name: string
  board: Board
  clip: BoardClip | null
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

export default function QuickBoard({
  plays,
  ready,
  playbookTeams = [],
}: {
  plays: SavedPlay[]
  ready: boolean
  /** The decks this coach may add to — empty for everyone but the head coach. */
  playbookTeams?: Team[]
}) {
  const [board, setBoard] = useState<Board>(loadScratch)
  const [name, setName] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [saving, startSaving] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)

  /* The take. While recording, every change to the board lands in here with the
     millisecond it happened, which is the whole recording — no timer, no
     frames anybody has to think about. */
  const [recording, setRecording] = useState(false)
  const [clip, setClip] = useState<BoardClip | null>(null)
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

  function save() {
    if (!name.trim() || !ready) return
    const data = new FormData()
    data.set('name', name.trim())
    data.set('board', JSON.stringify(board))
    if (clip) data.set('clip', JSON.stringify(clip))
    startSaving(async () => {
      await savePlayAction(data)
      setName('')
    })
  }

  /* The other button. The Library is a shelf; the playbook is what we run — so
     sending a play there saves it and opens the page it now sits on, for the
     reads and the coaching points to go round it. */
  function toPlaybook(team: Team) {
    if (!name.trim() || !ready) return
    const data = new FormData()
    data.set('team', team)
    data.set('name', name.trim())
    data.set('board', JSON.stringify(board))
    if (clip) data.set('clip', JSON.stringify(clip))
    startSaving(() => playToPlaybook(data))
  }

  function open(play: SavedPlay) {
    setBoard(play.board)
    setOpenId(play.id)
    setName(play.name)
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
          {saving ? 'Saving…' : openId && plays.some((p) => p.id === openId && p.name === name.trim()) ? 'Update' : 'Save'}
        </button>
        {playbookTeams.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => toPlaybook(t)}
            disabled={!name.trim() || saving || !ready}
            title={`Save it and start a ${teamLabel(t)} playbook page`}
            className="btn btn-ghost !py-1.5 text-sm disabled:opacity-50"
          >
            📘 {playbookTeams.length > 1 ? `${teamLabel(t)} playbook` : 'Playbook'}
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            setBoard(EMPTY_BOARD)
            setOpenId(null)
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
                  Recent
                </div>
                {plays.slice(0, 12).map((p) => (
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


      {shot && <p className="text-xs text-gray-500 -mt-1">{shot}</p>}

      <div className="flex-1 min-h-0">
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
