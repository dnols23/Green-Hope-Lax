'use client'
import {
  BOARD_COLORS,
  DASH_STYLES,
  END_CAPS,
  tokenStyle,
  type Board,
  type BoardPath,
  type BoardText,
  type BoardToken,
} from '@/lib/planner'

export type Selection = { type: 'token' | 'path' | 'text'; id: string } | null

/**
 * What you get when you select something on the board.
 *
 * Every drawing tool ever made lets you pick a line and change it; this one
 * did not, so a pass was blue and 0.7 yards wide and that was the end of the
 * conversation. Colour, weight, dash and both ends for a line; colour and
 * letters for a disc; the words, size and weight for a label.
 */
export function BoardInspector({
  board,
  selection,
  onChange,
  onClose,
}: {
  board: Board
  selection: Selection
  onChange: (next: Board) => void
  onClose: () => void
}) {
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

  const label = token ? 'Player' : path ? 'Line' : 'Label'
  const chip = 'px-2 py-1 rounded-lg text-xs font-bold border transition-colors'

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 space-y-3 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="text-xs font-black tracking-wide uppercase text-gray-400">{label}</span>
        <button type="button" onClick={remove} className="ml-auto text-xs font-bold text-[var(--gh-maroon)]">
          Delete
        </button>
        <button type="button" onClick={onClose} className="text-xs font-bold text-gray-400" aria-label="Close">
          ×
        </button>
      </div>

      {/* Colour — for anything at all */}
      <div className="flex flex-wrap items-center gap-1.5">
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
        <label className="ml-1 inline-flex items-center gap-1 text-xs text-gray-500">
          <input
            type="color"
            value={current ?? '#17222e'}
            onChange={(e) => setColor(e.target.value)}
            className="w-6 h-6 rounded border border-gray-200 bg-white p-0"
            aria-label="Any other colour"
          />
          Any
        </label>
      </div>

      {token && (
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-gray-500">Letters</label>
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
              Back to {tokenStyle(token.kind).label.toLowerCase()} colour
            </button>
          )}
        </div>
      )}

      {path && (
        <>
          <div className="flex items-center gap-3">
            <label className="text-xs font-bold text-gray-500 w-14">Weight</label>
            <input
              type="range"
              min={0.3}
              max={3}
              step={0.1}
              value={path.width ?? 0.7}
              onChange={(e) => patchPath({ width: Number(e.target.value) })}
              className="flex-1 accent-[var(--gh-green)]"
            />
            <span className="text-xs tabular-nums text-gray-400 w-8 text-right">
              {(path.width ?? 0.7).toFixed(1)}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-bold text-gray-500 w-14">Style</span>
            {DASH_STYLES.map((d) => {
              const active = (path.dash ?? '') === d.dash
              return (
                <button
                  key={d.key}
                  type="button"
                  onClick={() => patchPath({ dash: d.dash })}
                  className={chip}
                  style={{
                    background: active ? 'var(--gh-green)' : '#fff',
                    color: active ? '#fff' : '#4b5563',
                    borderColor: active ? 'var(--gh-green)' : '#e5e7eb',
                  }}
                >
                  {d.label}
                </button>
              )
            })}
          </div>

          {(['startCap', 'endCap'] as const).map((which) => (
            <div key={which} className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-bold text-gray-500 w-14">
                {which === 'startCap' ? 'Start' : 'End'}
              </span>
              {END_CAPS.map((c) => {
                const value = which === 'startCap' ? (path.startCap ?? 'none') : (path.endCap ?? 'arrow')
                const active = value === c.key
                return (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => patchPath({ [which]: c.key } as Partial<BoardPath>)}
                    className={chip}
                    style={{
                      background: active ? 'var(--gh-green)' : '#fff',
                      color: active ? '#fff' : '#4b5563',
                      borderColor: active ? 'var(--gh-green)' : '#e5e7eb',
                    }}
                  >
                    {c.label}
                  </button>
                )
              })}
            </div>
          ))}
        </>
      )}

      {text && (
        <>
          <textarea
            value={text.text}
            onChange={(e) => patchText({ text: e.target.value })}
            rows={2}
            className="field !py-1.5 text-sm"
            placeholder="Type the call"
          />
          <div className="flex items-center gap-3">
            <label className="text-xs font-bold text-gray-500 w-14">Size</label>
            <input
              type="range"
              min={1.5}
              max={10}
              step={0.5}
              value={text.size}
              onChange={(e) => patchText({ size: Number(e.target.value) })}
              className="flex-1 accent-[var(--gh-green)]"
            />
            <button
              type="button"
              onClick={() => patchText({ bold: !text.bold })}
              className={chip}
              style={{
                background: text.bold ? 'var(--gh-green)' : '#fff',
                color: text.bold ? '#fff' : '#4b5563',
                borderColor: text.bold ? 'var(--gh-green)' : '#e5e7eb',
                fontWeight: 900,
              }}
            >
              B
            </button>
            <button
              type="button"
              onClick={() => patchText({ italic: !text.italic })}
              className={chip}
              style={{
                background: text.italic ? 'var(--gh-green)' : '#fff',
                color: text.italic ? '#fff' : '#4b5563',
                borderColor: text.italic ? 'var(--gh-green)' : '#e5e7eb',
                fontStyle: 'italic',
              }}
            >
              I
            </button>
          </div>
        </>
      )}
    </div>
  )
}
