'use client'
import { useState } from 'react'
import type { Board } from '@/lib/planner'

const DEPTH = 100
/** Edits with the same key this close together are one step — a word being typed, a slider being dragged. */
const COALESCE_MS = 1200

interface State {
  past: Board[]
  future: Board[]
  /** What the last step was, and when, so the next one can fold into it. */
  key: string | null
  at: number
}

/**
 * Undo and redo for one board.
 *
 * The board itself belongs to whoever renders the editor; this keeps only the
 * boards it has been, so a step back is handing the owner the previous one.
 *
 * A step is one thing the coach did, not one thing the pointer did. A drag
 * sends the owner a new board on every move (a recording needs every one of
 * them) but is recorded here once, when it starts, as the board before it — so
 * a cone dragged across the field comes back in one press, and the press after
 * that takes the cone off. Before this, every pixel of a drag was a step of its
 * own, fifty of them filled the history, and the cone that had been added
 * dropped off the bottom of it: that was why undo "didn't work" on cones.
 */
export function useHistory(board: Board, onChange: ((next: Board) => void) | undefined) {
  const [h, setH] = useState<State>({ past: [], future: [], key: null, at: 0 })

  /**
   * Record `before` as the board to come back to. With a key, a second step of
   * the same kind close behind the first folds into it.
   */
  function record(before: Board, key?: string, windowMs = COALESCE_MS) {
    const now = Date.now()
    setH((s) => {
      if (key && s.key === key && now - s.at < windowMs) return { ...s, at: now }
      return { past: [...s.past, before].slice(-DEPTH), future: [], key: key ?? null, at: now }
    })
  }

  /** Make a change and record it in one go. */
  function commit(next: Board, key?: string, windowMs?: number) {
    if (next === board) return
    record(board, key, windowMs)
    onChange?.(next)
  }

  function undo() {
    if (!h.past.length) return
    const previous = h.past[h.past.length - 1]
    setH({ past: h.past.slice(0, -1), future: [board, ...h.future].slice(0, DEPTH), key: null, at: 0 })
    onChange?.(previous)
  }

  function redo() {
    if (!h.future.length) return
    const next = h.future[0]
    setH({ past: [...h.past, board].slice(-DEPTH), future: h.future.slice(1), key: null, at: 0 })
    onChange?.(next)
  }

  /** Stop the next step folding into the last — a new drag is a new step. */
  function seal() {
    setH((s) => (s.key ? { ...s, key: null } : s))
  }

  /** Take back the step just recorded — a drag that turned out to be a pinch. */
  function unrecord(key: string) {
    setH((s) => (s.key === key && s.past.length ? { ...s, past: s.past.slice(0, -1), key: null } : s))
  }

  return {
    record,
    commit,
    undo,
    redo,
    seal,
    unrecord,
    canUndo: h.past.length > 0,
    canRedo: h.future.length > 0,
  }
}
