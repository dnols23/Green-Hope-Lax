'use client'
import { useState } from 'react'
import { FieldBoard } from './FieldBoard'
import {
  NOTE_BLOCK_KINDS,
  chartMax,
  emptyNoteBlock,
  type NoteBlock,
  type NoteBlockKind,
} from '@/lib/noteBlocks'
import type { Board } from '@/lib/planner'

/**
 * A note you build rather than fill in.
 *
 * Sections, paragraphs, checklists, charts, and a field with a play drawn on
 * it. The field is why this exists: a play drawn into a note is on the sideline
 * in March, and a paragraph describing that play is not — so a board block
 * carries its own Full screen button and opens as the thing itself.
 */
export function NoteEditor({
  blocks,
  onChange,
}: {
  blocks: NoteBlock[]
  onChange: (next: NoteBlock[]) => void
}) {
  const [openBoard, setOpenBoard] = useState<string | null>(null)

  const patch = (id: string, next: Partial<NoteBlock>) =>
    onChange(blocks.map((b) => (b.id === id ? ({ ...b, ...next } as NoteBlock) : b)))

  const add = (kind: NoteBlockKind) => {
    const block = emptyNoteBlock(kind)
    onChange([...blocks, block])
    if (kind === 'board') setOpenBoard(block.id)
  }

  const move = (id: string, by: number) => {
    const from = blocks.findIndex((b) => b.id === id)
    const to = from + by
    if (from < 0 || to < 0 || to >= blocks.length) return
    const next = [...blocks]
    next.splice(to, 0, next.splice(from, 1)[0])
    onChange(next)
  }

  const remove = (id: string) => onChange(blocks.filter((b) => b.id !== id))

  return (
    <div className="space-y-3">
      {blocks.map((b, i) => (
        <div key={b.id} className="group relative rounded-lg border border-transparent hover:border-gray-200 p-2 -m-2">
          {/* The controls stay out of the way until you go near the block. */}
          <div className="absolute right-2 top-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
            <button type="button" onClick={() => move(b.id, -1)} disabled={i === 0}
              aria-label="Move up" className="text-xs text-gray-400 hover:text-gray-700 disabled:opacity-30 px-1">↑</button>
            <button type="button" onClick={() => move(b.id, 1)} disabled={i === blocks.length - 1}
              aria-label="Move down" className="text-xs text-gray-400 hover:text-gray-700 disabled:opacity-30 px-1">↓</button>
            <button type="button" onClick={() => remove(b.id)}
              aria-label="Delete block" className="text-xs text-gray-400 hover:text-[var(--gh-maroon)] px-1">×</button>
          </div>

          {b.kind === 'heading' && (
            <input
              value={b.text}
              onChange={(e) => patch(b.id, { text: e.target.value })}
              placeholder="Section"
              className="w-full bg-transparent border-0 p-0 text-lg font-black focus:outline-none focus:ring-0"
            />
          )}

          {b.kind === 'text' && (
            <textarea
              value={b.text}
              onChange={(e) => patch(b.id, { text: e.target.value })}
              rows={Math.max(3, b.text.split('\n').length + 1)}
              placeholder="Write here."
              className="w-full bg-transparent border-0 p-0 resize-y focus:outline-none focus:ring-0 text-[0.95rem] leading-relaxed"
            />
          )}

          {b.kind === 'list' && (
            <div className="space-y-1 pr-16">
              {b.items.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={item.done}
                    onChange={(e) =>
                      patch(b.id, {
                        items: b.items.map((x, j) => (j === idx ? { ...x, done: e.target.checked } : x)),
                      })
                    }
                    className="w-4 h-4 accent-[var(--gh-green)] shrink-0"
                  />
                  <input
                    value={item.text}
                    onChange={(e) =>
                      patch(b.id, {
                        items: b.items.map((x, j) => (j === idx ? { ...x, text: e.target.value } : x)),
                      })
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        const items = [...b.items]
                        items.splice(idx + 1, 0, { text: '', done: false })
                        patch(b.id, { items })
                      }
                      if (e.key === 'Backspace' && item.text === '' && b.items.length > 1) {
                        e.preventDefault()
                        patch(b.id, { items: b.items.filter((_, j) => j !== idx) })
                      }
                    }}
                    placeholder="Something to get through"
                    className={`flex-1 bg-transparent border-0 p-0 focus:outline-none focus:ring-0 text-sm ${
                      item.done ? 'line-through text-gray-400' : ''
                    }`}
                  />
                </div>
              ))}
              <p className="text-xs text-gray-300">Enter for the next one</p>
            </div>
          )}

          {b.kind === 'chart' && (
            <div className="pr-16">
              <input
                value={b.label}
                onChange={(e) => patch(b.id, { label: e.target.value })}
                placeholder="What is this a chart of?"
                className="w-full bg-transparent border-0 p-0 font-bold focus:outline-none focus:ring-0 mb-2"
              />
              <div className="space-y-1">
                {b.rows.map((row, idx) => {
                  const max = chartMax(b.rows)
                  return (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        value={row.label}
                        onChange={(e) =>
                          patch(b.id, { rows: b.rows.map((x, j) => (j === idx ? { ...x, label: e.target.value } : x)) })
                        }
                        placeholder="Label"
                        className="w-28 shrink-0 bg-transparent border-0 p-0 text-sm focus:outline-none focus:ring-0"
                      />
                      <div className="flex-1 h-4 rounded-sm bg-gray-100 overflow-hidden">
                        <div
                          className="h-full rounded-sm transition-all"
                          style={{ width: `${(Math.abs(row.value) / max) * 100}%`, background: 'var(--gh-green)' }}
                        />
                      </div>
                      <input
                        type="number"
                        value={row.value}
                        onChange={(e) =>
                          patch(b.id, {
                            rows: b.rows.map((x, j) => (j === idx ? { ...x, value: Number(e.target.value) || 0 } : x)),
                          })
                        }
                        className="w-16 shrink-0 bg-transparent border-0 p-0 text-sm text-right tabular-nums focus:outline-none focus:ring-0"
                      />
                      <button
                        type="button"
                        onClick={() => patch(b.id, { rows: b.rows.filter((_, j) => j !== idx) })}
                        aria-label="Remove row"
                        className="text-xs text-gray-300 hover:text-[var(--gh-maroon)]"
                      >
                        ×
                      </button>
                    </div>
                  )
                })}
              </div>
              <button
                type="button"
                onClick={() => patch(b.id, { rows: [...b.rows, { label: '', value: 0 }] })}
                className="text-xs font-bold text-[var(--gh-green)] mt-1"
              >
                + row
              </button>
            </div>
          )}

          {b.kind === 'board' && (
            <div className="pr-16">
              <div className="flex items-center gap-2 mb-2">
                <input
                  value={b.label}
                  onChange={(e) => patch(b.id, { label: e.target.value })}
                  placeholder="Name this play"
                  className="flex-1 bg-transparent border-0 p-0 font-bold focus:outline-none focus:ring-0"
                />
                <button
                  type="button"
                  onClick={() => setOpenBoard(openBoard === b.id ? null : b.id)}
                  className="text-xs font-bold text-[var(--gh-green)]"
                >
                  {openBoard === b.id ? 'Collapse' : 'Open the field'}
                </button>
              </div>
              {openBoard === b.id ? (
                <FieldBoard board={b.board} onChange={(next: Board) => patch(b.id, { board: next })} />
              ) : (
                <button
                  type="button"
                  onClick={() => setOpenBoard(b.id)}
                  className="w-full rounded-lg border border-dashed border-gray-300 py-6 text-sm text-gray-500 hover:border-[var(--gh-green)] hover:text-[var(--gh-green)]"
                >
                  {b.board.tokens.length > 0
                    ? `${b.board.tokens.length} on the field — tap to open`
                    : 'Tap to draw the play'}
                </button>
              )}
            </div>
          )}
        </div>
      ))}

      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-100">
        <span className="text-xs font-bold uppercase tracking-wide text-gray-400">Add</span>
        {NOTE_BLOCK_KINDS.map((k) => (
          <button
            key={k.key}
            type="button"
            onClick={() => add(k.key)}
            className="text-sm font-semibold px-2.5 py-1 rounded-lg border border-gray-200 hover:border-[var(--gh-green)] hover:text-[var(--gh-green)]"
          >
            {k.label}
          </button>
        ))}
      </div>
    </div>
  )
}
