'use client'
import { useEffect, useRef, useState, useTransition } from 'react'
import { FieldBoard } from '@/components/planner/FieldBoard'
import { ClipPlayer } from '@/components/planner/ClipPlayer'
import { savePlayAction, deletePlayAction, saveShotAction } from '@/lib/actions'
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

export default function QuickBoard({ plays, ready }: { plays: SavedPlay[]; ready: boolean }) {
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

  function open(play: SavedPlay) {
    setBoard(play.board)
    setOpenId(play.id)
    setName(play.name)
    setClip(play.clip)
    setWatching(false)
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-3 p-4">
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
        <span className="text-xs text-gray-400 ml-auto">
          {ready ? 'Saved plays open on any device, for every coach' : 'Run the plays SQL to save plays'}
        </span>
      </div>

      {plays.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {plays.map((p) => (
            <span
              key={p.id}
              className="inline-flex items-center rounded-full border bg-white text-sm"
              style={{ borderColor: openId === p.id ? 'var(--gh-green)' : '#e5e7eb' }}
            >
              <button
                type="button"
                onClick={() => open(p)}
                title={p.createdBy ? `Drawn by ${p.createdBy}` : undefined}
                className="px-3 py-1 font-semibold hover:text-[var(--gh-green)]"
              >
                {p.name}
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
                  className="pr-2.5 pl-1 text-gray-300 hover:text-[var(--gh-maroon)]"
                >
                  ×
                </button>
              </form>
            </span>
          ))}
        </div>
      )}

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
