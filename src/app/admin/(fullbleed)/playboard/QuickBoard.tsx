'use client'
import { useEffect, useState } from 'react'
import { FieldBoard } from '@/components/planner/FieldBoard'
import { EMPTY_BOARD, readBoard, type Board } from '@/lib/planner'

/**
 * The board you grab in a pinch.
 *
 * A coach on a sideline with thirty seconds does not want a practice plan, a
 * block and a drill — he wants a field and a marker. This is that: it opens
 * drawable, it goes full screen on one tap, and whatever was on it is still
 * there next time.
 *
 * Plays are kept in this browser rather than the database on purpose. A play
 * drawn at 3:29 for the next two minutes is not team data, and nothing should
 * stand between the thought and the field.
 */

const CURRENT = 'gh-playboard-v1'
const SAVED = 'gh-playboard-saved-v1'

interface SavedPlay {
  id: string
  name: string
  board: Board
}

function loadCurrent(): Board {
  try {
    const raw = localStorage.getItem(CURRENT)
    return (raw ? readBoard(JSON.parse(raw)) : null) ?? EMPTY_BOARD
  } catch {
    return EMPTY_BOARD
  }
}

function loadSaved(): SavedPlay[] {
  try {
    const raw = JSON.parse(localStorage.getItem(SAVED) ?? '[]') as SavedPlay[]
    return Array.isArray(raw)
      ? raw
          .map((p) => ({ id: String(p?.id ?? ''), name: String(p?.name ?? ''), board: readBoard(p?.board) ?? EMPTY_BOARD }))
          .filter((p) => p.id && p.name)
      : []
  } catch {
    return []
  }
}

export default function QuickBoard() {
  // Read straight into state. This component is only ever loaded in the
  // browser (see PlayboardClient), so localStorage is there on the first
  // render and the board comes back already holding last night's play.
  const [board, setBoard] = useState<Board>(loadCurrent)
  const [plays, setPlays] = useState<SavedPlay[]>(loadSaved)
  const [name, setName] = useState('')

  useEffect(() => {
    try {
      localStorage.setItem(CURRENT, JSON.stringify(board))
    } catch {
      // A full or blocked store is not a reason to stop drawing.
    }
  }, [board])

  function persist(next: SavedPlay[]) {
    setPlays(next)
    try {
      localStorage.setItem(SAVED, JSON.stringify(next))
    } catch {
      // Same again: the board on screen still works.
    }
  }

  function save() {
    const label = name.trim()
    if (!label) return
    const existing = plays.find((p) => p.name.toLowerCase() === label.toLowerCase())
    const play: SavedPlay = { id: existing?.id ?? `p${Date.now()}`, name: label, board }
    persist(existing ? plays.map((p) => (p.id === play.id ? play : p)) : [play, ...plays])
    setName('')
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
        <button type="button" onClick={save} disabled={!name.trim()} className="btn btn-primary !py-1.5 text-sm">
          Save
        </button>
        <span className="text-xs text-gray-400 ml-auto">Kept on this device</span>
      </div>

      {plays.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {plays.map((p) => (
            <span key={p.id} className="inline-flex items-center rounded-full border border-gray-200 bg-white text-sm">
              <button
                type="button"
                onClick={() => setBoard(p.board)}
                className="px-3 py-1 font-semibold hover:text-[var(--gh-green)]"
              >
                {p.name}
              </button>
              <button
                type="button"
                onClick={() => persist(plays.filter((x) => x.id !== p.id))}
                aria-label={`Delete ${p.name}`}
                className="pr-2.5 pl-1 text-gray-300 hover:text-[var(--gh-maroon)]"
              >
                ×
              </button>
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
