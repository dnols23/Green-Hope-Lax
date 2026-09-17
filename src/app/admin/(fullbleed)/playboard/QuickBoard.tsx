'use client'
import { useEffect, useRef, useState, useTransition } from 'react'
import { FieldBoard } from '@/components/planner/FieldBoard'
import { savePlayAction, deletePlayAction } from '@/lib/actions'
import { EMPTY_BOARD, readBoard, type Board } from '@/lib/planner'

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
 */

const SCRATCH = 'gh-playboard-v1'

export interface SavedPlay {
  id: string
  name: string
  board: Board
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
    startSaving(async () => {
      await savePlayAction(data)
      setName('')
    })
  }

  function open(play: SavedPlay) {
    setBoard(play.board)
    setOpenId(play.id)
    setName(play.name)
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
          onClick={() => { setBoard(EMPTY_BOARD); setOpenId(null); setName('') }}
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

      <div className="flex-1 min-h-0">
        <FieldBoard board={board} onChange={setBoard} />
      </div>
    </div>
  )
}
