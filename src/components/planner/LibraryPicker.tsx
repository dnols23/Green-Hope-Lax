'use client'
import { useEffect, useState } from 'react'
import { clipLength, type Board, type BoardClip } from '@/lib/planner'

/**
 * Pull something off the shelf.
 *
 * A play installed in September should be in March's game plan without being
 * redrawn, so anywhere a field can go — a practice block, a note, a game plan —
 * this offers everything in the Library: the plays, the recordings of them
 * being drawn, and the screenshots.
 *
 * The shelf is fetched when the picker opens rather than loaded with the page:
 * most notes never pull a play in, and boards are not small.
 */

export interface PickedPlay {
  board: Board
  clip: BoardClip | null
  name: string
}

interface Shelf {
  plays: { id: string; name: string; board: Board; clip: BoardClip | null }[]
  shots: { id: string; title: string; url: string }[]
}

export function LibraryPicker({
  onPlay,
  onShot,
  onClose,
}: {
  onPlay: (picked: PickedPlay) => void
  onShot: (url: string, title: string) => void
  onClose: () => void
}) {
  const [shelf, setShelf] = useState<Shelf | null>(null)
  const [problem, setProblem] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    fetch('/api/library')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('no'))))
      .then((data: Shelf) => live && setShelf(data))
      .catch(() => live && setProblem('The Library would not open. Try again.'))
    return () => {
      live = false
    }
  }, [])

  const empty = shelf && shelf.plays.length === 0 && shelf.shots.length === 0

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 mt-2">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[0.65rem] font-black tracking-[0.15em] uppercase text-gray-400">
          From the Library
        </span>
        <button
          type="button"
          onClick={onClose}
          className="ml-auto text-xs font-semibold text-gray-400 hover:text-gray-700"
        >
          Close
        </button>
      </div>

      {problem && <p className="text-sm text-gray-500">{problem}</p>}
      {!shelf && !problem && <p className="text-sm text-gray-400">Opening the Library…</p>}
      {empty && (
        <p className="text-sm text-gray-400">
          Nothing on the shelf yet. Draw a play on the Playboard, or hit Screenshot there.
        </p>
      )}

      {shelf && shelf.plays.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {shelf.plays.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onPlay({ board: p.board, clip: p.clip, name: p.name })}
              className="px-3 py-1.5 rounded-full border border-gray-200 bg-white text-sm font-semibold hover:border-[var(--gh-green)] hover:text-[var(--gh-green)]"
            >
              {p.name}
              {p.clip && (
                <span className="text-[0.65rem] font-black text-gray-400 ml-1.5">
                  ▶ {(clipLength(p.clip) / 1000).toFixed(0)}s
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {shelf && shelf.shots.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {shelf.shots.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onShot(s.url, s.title)}
              title={s.title}
              className="rounded-lg border border-gray-200 bg-white overflow-hidden hover:border-[var(--gh-green)]"
            >
              {/* Our own bucket, and a flat PNG — nothing to resize. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.url} alt={s.title} className="w-full block" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
