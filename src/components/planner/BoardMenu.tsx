'use client'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  BOARD_COLORS,
  BOARD_FONTS,
  DASH_STYLES,
  END_CAPS,
  tokenStyle,
  type Board,
  type BoardPath,
  type BoardText,
  type BoardToken,
  type TextAlign,
} from '@/lib/planner'

export type Selection = { type: 'token' | 'path' | 'text'; id: string } | null

/**
 * The menu you get on a right-click, or on a long press on a phone.
 *
 * It opens where the finger or the cursor is, over the field, the way a format
 * menu does in a word processor — not as a strip bolted under the board that a
 * coach has to look away to reach. Everything about the thing under the pointer
 * is in it: the type controls for a word, the line controls for a line, the
 * colour and letters for a player.
 *
 * It flips itself to stay on screen, so a long press in the bottom corner of a
 * phone opens upwards rather than off the glass.
 */

const MENU_W = 320

function Row({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {label && <span className="text-[0.65rem] font-black uppercase tracking-wider text-gray-400 w-12 shrink-0">{label}</span>}
      {children}
    </div>
  )
}

export function BoardMenu({
  board,
  selection,
  at,
  onChange,
  onClose,
}: {
  board: Board
  selection: Selection
  /** Where the press happened, in viewport pixels. */
  at: { x: number; y: number }
  onChange: (next: Board) => void
  onClose: () => void
}) {
  const card = useRef<HTMLDivElement>(null)
  const [place, setPlace] = useState({ left: at.x, top: at.y })

  // Measure once it is on the glass, then nudge it back inside the window.
  useLayoutEffect(() => {
    const el = card.current
    if (!el) return
    const w = el.offsetWidth || MENU_W
    const h = el.offsetHeight
    const pad = 8
    setPlace({
      left: Math.max(pad, Math.min(at.x, window.innerWidth - w - pad)),
      top: at.y + h + pad > window.innerHeight ? Math.max(pad, at.y - h - 8) : at.y + 8,
    })
  }, [at.x, at.y, selection?.id, selection?.type])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!selection) return null

  const token = selection.type === 'token' ? board.tokens.find((t) => t.id === selection.id) : undefined
  const path = selection.type === 'path' ? board.paths.find((p) => p.id === selection.id) : undefined
  const text = selection.type === 'text' ? (board.texts ?? []).find((t) => t.id === selection.id) : undefined
  if (!token && !path && !text) return null

  const patchToken = (next: Partial<BoardToken>) =>
    onChange({ ...board, tokens: board.tokens.map((t) => (t.id === token!.id ? { ...t, ...next } : t)) })
  const patchPath = (next: Partial<BoardPath>) =>
    onChange({ ...board, paths: board.paths.map((p) => (p.id === path!.id ? { ...p, ...next } : p)) })
  const patchText = (next: Partial<BoardText>) =>
    onChange({
      ...board,
      texts: (board.texts ?? []).map((t) => (t.id === text!.id ? { ...t, ...next } : t)),
    })

  const remove = () => {
    if (token) onChange({ ...board, tokens: board.tokens.filter((t) => t.id !== token.id) })
    else if (path) onChange({ ...board, paths: board.paths.filter((p) => p.id !== path.id) })
    else if (text) onChange({ ...board, texts: (board.texts ?? []).filter((t) => t.id !== text.id) })
    onClose()
  }

  const current = token ? (token.color ?? tokenStyle(token.kind).fill) : path ? path.color : text?.color
  const setColor = (c: string) =>
    token ? patchToken({ color: c }) : path ? patchPath({ color: c }) : patchText({ color: c })

  const title = token ? 'Player' : path ? 'Line' : 'Text'

  const chip = (active: boolean, extra: React.CSSProperties = {}) => ({
    background: active ? 'var(--gh-green)' : '#fff',
    color: active ? '#fff' : '#4b5563',
    borderColor: active ? 'var(--gh-green)' : '#e5e7eb',
    ...extra,
  })
  const chipClass = 'px-2 py-1 rounded-lg text-xs font-bold border transition-colors'

  return (
    <>
      {/* Catches the click that closes the menu. */}
      <button
        type="button"
        aria-label="Close menu"
        onClick={onClose}
        onContextMenu={(e) => {
          e.preventDefault()
          onClose()
        }}
        className="fixed inset-0 z-40 cursor-default"
      />

      <div
        ref={card}
        role="menu"
        aria-label={`${title} options`}
        onContextMenu={(e) => e.preventDefault()}
        className="fixed z-50 rounded-xl border border-gray-200 bg-white shadow-2xl p-3 space-y-2.5"
        style={{ left: place.left, top: place.top, width: MENU_W, maxHeight: '70vh', overflowY: 'auto' }}
      >
        <div className="flex items-center gap-2">
          <span className="text-[0.65rem] font-black tracking-wider uppercase text-gray-400">{title}</span>
          <button type="button" onClick={remove} className="ml-auto text-xs font-bold text-[var(--gh-maroon)]">
            Delete
          </button>
          <button type="button" onClick={onClose} aria-label="Close" className="text-xs font-bold text-gray-400 px-1">
            ×
          </button>
        </div>

        {text && (
          <>
            <textarea
              value={text.text}
              onChange={(e) => patchText({ text: e.target.value })}
              rows={2}
              autoFocus
              className="field !py-1.5 text-sm w-full"
              placeholder="Type the call"
            />

            <Row label="Font">
              <select
                value={text.font ?? 'sans'}
                onChange={(e) => patchText({ font: e.target.value })}
                className="field !py-1 text-sm flex-1"
              >
                {BOARD_FONTS.map((f) => (
                  <option key={f.key} value={f.key} style={{ fontFamily: f.stack }}>
                    {f.label}
                  </option>
                ))}
              </select>
            </Row>

            <Row label="Size">
              <button
                type="button"
                aria-label="Smaller"
                onClick={() => patchText({ size: Math.max(1.5, Math.round((text.size - 0.5) * 10) / 10) })}
                className={chipClass}
                style={chip(false)}
              >
                −
              </button>
              <input
                type="number"
                min={1.5}
                max={12}
                step={0.5}
                value={text.size}
                onChange={(e) =>
                  patchText({ size: Math.min(12, Math.max(1.5, Number(e.target.value) || 1.5)) })
                }
                aria-label="Text size"
                className="field !py-1 !w-16 text-sm tabular-nums"
              />
              <button
                type="button"
                aria-label="Bigger"
                onClick={() => patchText({ size: Math.min(12, Math.round((text.size + 0.5) * 10) / 10) })}
                className={chipClass}
                style={chip(false)}
              >
                +
              </button>

            </Row>

            <Row label="Style">
              <button
                type="button"
                onClick={() => patchText({ bold: !text.bold })}
                aria-label="Bold"
                aria-pressed={!!text.bold}
                className={chipClass}
                style={chip(!!text.bold, { fontWeight: 900 })}
              >
                B
              </button>
              <button
                type="button"
                onClick={() => patchText({ italic: !text.italic })}
                aria-label="Italic"
                aria-pressed={!!text.italic}
                className={chipClass}
                style={chip(!!text.italic, { fontStyle: 'italic' })}
              >
                I
              </button>
              <button
                type="button"
                onClick={() => patchText({ underline: !text.underline })}
                aria-label="Underline"
                aria-pressed={!!text.underline}
                className={chipClass}
                style={chip(!!text.underline, { textDecoration: 'underline' })}
              >
                U
              </button>
            </Row>

            <Row label="Align">
              {(
                [
                  { key: 'start', label: 'Left' },
                  { key: 'middle', label: 'Centre' },
                  { key: 'end', label: 'Right' },
                ] as { key: TextAlign; label: string }[]
              ).map((a) => (
                <button
                  key={a.key}
                  type="button"
                  onClick={() => patchText({ align: a.key })}
                  className={chipClass}
                  style={chip((text.align ?? 'middle') === a.key)}
                >
                  {a.label}
                </button>
              ))}
            </Row>
          </>
        )}

        {token && (
          <Row label="Letters">
            <input
              value={token.label}
              onChange={(e) => patchToken({ label: e.target.value.slice(0, 4) })}
              className="field !py-1 !w-24 text-sm"
              placeholder="A, 27…"
            />
            {token.color && (
              <button
                type="button"
                onClick={() => patchToken({ color: undefined })}
                className="text-xs font-semibold text-gray-400"
              >
                Back to {tokenStyle(token.kind).label.toLowerCase()}
              </button>
            )}
          </Row>
        )}

        {path && (
          <>
            <Row label="Weight">
              <input
                type="range"
                min={0.3}
                max={3}
                step={0.1}
                value={path.width ?? 0.7}
                onChange={(e) => patchPath({ width: Number(e.target.value) })}
                className="flex-1 accent-[var(--gh-green)]"
              />
              <span className="text-xs tabular-nums text-gray-400 w-7 text-right">
                {(path.width ?? 0.7).toFixed(1)}
              </span>
            </Row>

            <Row label="Style">
              {DASH_STYLES.map((d) => (
                <button
                  key={d.key}
                  type="button"
                  onClick={() => patchPath({ dash: d.dash })}
                  className={chipClass}
                  style={chip((path.dash ?? '') === d.dash)}
                >
                  {d.label}
                </button>
              ))}
            </Row>

            {(['startCap', 'endCap'] as const).map((which) => (
              <Row key={which} label={which === 'startCap' ? 'Start' : 'End'}>
                {END_CAPS.map((c) => {
                  const value = which === 'startCap' ? (path.startCap ?? 'none') : (path.endCap ?? 'arrow')
                  return (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() => patchPath({ [which]: c.key } as Partial<BoardPath>)}
                      className={chipClass}
                      style={chip(value === c.key)}
                    >
                      {c.label}
                    </button>
                  )
                })}
              </Row>
            ))}
          </>
        )}

        <Row label="Colour">
          {BOARD_COLORS.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setColor(c.key)}
              title={c.label}
              aria-label={c.label}
              className="w-6 h-6 rounded-full border-2 transition-transform hover:scale-110"
              style={{
                background: c.key,
                borderColor: current?.toLowerCase() === c.key.toLowerCase() ? '#17222e' : 'rgba(0,0,0,.12)',
              }}
            />
          ))}
          <input
            type="color"
            value={current ?? '#17222e'}
            onChange={(e) => setColor(e.target.value)}
            className="w-6 h-6 rounded border border-gray-200 bg-white p-0"
            aria-label="Any other colour"
            title="Any other colour"
          />
        </Row>
      </div>
    </>
  )
}
