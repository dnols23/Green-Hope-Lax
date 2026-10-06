'use client'
import { useState, type ReactNode } from 'react'
import {
  BOARD_FONTS,
  DASH_STYLES,
  END_CAPS,
  LINE_PRESETS,
  TOKEN_MARKS,
  isPlayerKind,
  pathLook,
  shapeLook,
  tokenStyle,
  type EndCap,
  type LineCap,
  type LinePattern,
  type TextAlign,
  type TokenKind,
  type TokenMark,
} from '@/lib/planner'
import { ColorPicker } from './ColorPicker'
import { Icon, type IconName } from './Icon'
import { clean, type Mappers } from './items'
import { Chip, MenuItem, MenuLabel, MenuRow, MenuRule, Popover, anchorOf, type Anchor } from './Popover'
import type { Editor, LinePen, ShapePen, TextPen } from './types'

type Which = 'color' | 'fill' | 'line' | 'ends' | 'text' | 'token' | 'arrange'

/** A button on the bar: an icon, with a stripe of the colour it sets when it sets one. */
function BarButton({
  icon,
  label,
  onClick,
  swatch,
  active,
  danger,
  children,
}: {
  icon?: IconName
  label: string
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void
  swatch?: string | null
  active?: boolean
  danger?: boolean
  children?: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-expanded={active}
      className={`relative h-9 min-w-9 px-1.5 rounded-lg border inline-flex items-center justify-center gap-1 text-xs font-bold shrink-0 ${
        danger ? 'text-[var(--gh-maroon)]' : 'text-gray-700'
      }`}
      style={{ background: active ? '#eef6f1' : '#fff', borderColor: active ? 'var(--gh-green)' : '#e5e7eb' }}
    >
      {icon && <Icon name={icon} size={17} />}
      {children}
      {swatch !== undefined && (
        <span
          className="absolute left-1.5 right-1.5 bottom-1 h-1 rounded-full"
          style={{
            background: swatch ?? 'repeating-linear-gradient(45deg,#ef4444 0 2px,#fff 2px 4px)',
            boxShadow: '0 0 0 1px rgba(0,0,0,.15)',
          }}
        />
      )}
    </button>
  )
}

const r1 = (n: number) => Math.round(n * 10) / 10

/**
 * The properties of whatever is selected, in one row under the tools — the
 * contextual bar a drawing program shows. With nothing selected and a drawing
 * tool in hand, the same controls set the pen the next thing is drawn with.
 * With neither, it says what the tool in hand does.
 *
 * The row is always there, so picking something never shoves the field down
 * under the finger that is about to drag it.
 */
export function PropsBar({ ed }: { ed: Editor }) {
  const [open, setOpen] = useState<{ which: Which; anchor: Anchor } | null>(null)
  const toggle = (w: Which) => (e: React.MouseEvent<HTMLButtonElement>) =>
    setOpen(which === w ? null : { which: w, anchor: anchorOf(e.currentTarget) })
  const close = () => setOpen(null)

  const { items, tool } = ed
  const sel = items.length > 0
  const paths = items.flatMap((x) => (x.type === 'path' ? [x.it] : []))
  const shapes = items.flatMap((x) => (x.type === 'shape' ? [x.it] : []))
  const texts = items.flatMap((x) => (x.type === 'text' ? [x.it] : []))
  const tokens = items.flatMap((x) => (x.type === 'token' ? [x.it] : []))
  const pen = sel ? null : tool.t === 'line' ? 'line' : tool.t === 'shape' ? 'shape' : tool.t === 'text' ? 'text' : null
  const showPath = paths.length > 0 || pen === 'line'
  const showShape = shapes.length > 0 || pen === 'shape'
  const showText = texts.length > 0 || pen === 'text'
  const showToken = tokens.length > 0

  /** Change the selection, or the pen when nothing is selected. */
  function apply(m: Mappers, p: { line?: Partial<LinePen>; shape?: Partial<ShapePen>; text?: Partial<TextPen> }, key: string) {
    if (sel) {
      ed.patch(m, key)
      // The line just drawn, restyled with the line tool still in hand: the
      // next one is drawn the same way.
      if (tool.t === 'line' && p.line && paths.length === items.length) ed.setLinePen(p.line)
    } else if (pen === 'line' && p.line) ed.setLinePen(p.line)
    else if (pen === 'shape' && p.shape) ed.setShapePen(p.shape)
    else if (pen === 'text' && p.text) ed.setTextPen(p.text)
  }

  // ── Current values: the first selected thing of each kind, else the pen ──

  const first = items[0]
  const color = first
    ? first.type === 'path'
      ? pathLook(first.it).color
      : first.type === 'shape'
        ? shapeLook(first.it).stroke
        : first.type === 'text'
          ? first.it.color
          : (first.it.color ?? tokenStyle(first.it.kind).fill)
    : pen === 'line'
      ? ed.linePen.color
      : pen === 'shape'
        ? ed.shapePen.stroke
        : ed.textPen.color
  const setColor = (c: string | undefined) => {
    if (!c) return
    apply(
      {
        path: (x) => ({ ...x, color: c }),
        shape: (x) => ({ ...x, stroke: c }),
        text: (x) => ({ ...x, color: c }),
        token: (x) => clean({ ...x, color: c }),
      },
      { line: { color: c }, shape: { stroke: c }, text: { color: c } },
      'color',
    )
  }

  const shape0 = shapes[0]
  const text0 = texts[0]
  const fill = shape0 ? shape0.fill : text0 ? text0.bg : pen === 'shape' ? ed.shapePen.fill : ed.textPen.bg
  const fillOpacity = shape0 ? (shape0.fillOpacity ?? 1) : text0 ? (text0.bgOpacity ?? 1) : pen === 'shape' ? ed.shapePen.fillOpacity : 1
  const setFill = (c: string | undefined) =>
    apply(
      {
        shape: (x) => clean({ ...x, fill: c, fillOpacity: c ? (x.fillOpacity ?? (x.fill ? 1 : 0.25)) : undefined }),
        text: (x) => clean({ ...x, bg: c, bgOpacity: c ? x.bgOpacity : undefined }),
      },
      { shape: { fill: c }, text: { bg: c } },
      'fill',
    )
  const setFillOpacity = (n: number) =>
    apply(
      {
        shape: (x) => clean({ ...x, fillOpacity: n >= 0.999 ? undefined : r2(n) }),
        text: (x) => clean({ ...x, bgOpacity: n >= 0.999 ? undefined : r2(n) }),
      },
      { shape: { fillOpacity: r2(n) } },
      'fillOpacity',
    )

  const path0 = paths[0]
  const look = path0 ? pathLook(path0) : null
  const width = path0 ? look!.width : shape0 ? shapeLook(shape0).strokeWidth : pen === 'shape' ? ed.shapePen.strokeWidth : ed.linePen.width
  const dash = path0 ? look!.dash : shape0 ? shapeLook(shape0).dash : pen === 'shape' ? ed.shapePen.dash : ed.linePen.dash
  const pattern = path0 ? look!.pattern : ed.linePen.pattern
  const startCap = path0 ? look!.startCap : ed.linePen.startCap
  const endCap = path0 ? look!.endCap : ed.linePen.endCap

  // A menu whose button has gone (the selection changed under it) is closed.
  const can: Record<Which, boolean> = {
    color: sel || !!pen,
    fill: showShape || showText,
    line: showPath || showShape,
    ends: showPath,
    text: showText,
    token: showToken,
    arrange: sel,
  }
  const which = open && can[open.which] && ed.drafting === 0 ? open.which : null

  const hint =
    tool.t === 'stamp'
      ? `Tap the field to put down ${tool.title} — each tap is one more`
      : tool.t === 'place'
        ? `Tap the cage you're attacking for ${tool.title} — or anywhere`
        : tool.t === 'line'
          ? tool.geo === 'free'
            ? 'Draw with a finger or the mouse'
            : tool.geo === 'straight'
              ? 'Drag from where it starts to where it goes'
              : 'Tap each point · tap the last one again to finish'
          : tool.t === 'shape'
            ? tool.kind === 'polygon'
              ? 'Tap each corner · tap the first to close'
              : 'Drag out the shape — Shift keeps it square'
            : tool.t === 'text'
              ? 'Tap where the words go'
              : 'Tap something to change it · drag on the grass to box a group'

  const typeLabel = sel
    ? items.length > 1
      ? `${items.length} picked`
      : { path: 'Line', shape: 'Shape', text: 'Words', token: isPlayerKind(tokens[0]?.kind ?? 'cone') ? 'Player' : tokenStyle(tokens[0]?.kind ?? 'cone').label }[first!.type]
    : null

  return (
    <div className="flex items-center gap-1 min-h-10 mb-1.5 overflow-x-auto overflow-y-hidden [scrollbar-width:none] shrink-0">
      {ed.drafting > 0 ? (
        <>
          <span className="text-xs font-bold text-gray-500 px-1 shrink-0">
            {ed.drafting} {ed.drafting === 1 ? 'point' : 'points'}
          </span>
          <BarButton icon="check" label="Finish" onClick={ed.finishDraft}>
            <span>Finish</span>
          </BarButton>
          <BarButton icon="close" label="Cancel" onClick={ed.cancelDraft} />
          <span className="text-[0.7rem] text-gray-400 truncate px-1">{hint}</span>
        </>
      ) : !sel && !pen ? (
        <span className="text-xs font-semibold px-1 truncate" style={{ color: tool.t === 'select' ? '#9ca3af' : 'var(--gh-green)' }}>
          {hint}
        </span>
      ) : (
        <>
          {typeLabel && <span className="text-[0.65rem] font-black uppercase tracking-wider text-gray-400 px-1 shrink-0 hidden sm:inline">{typeLabel}</span>}
          {!sel && <span className="text-[0.65rem] font-black uppercase tracking-wider text-gray-400 px-1 shrink-0 hidden sm:inline">Pen</span>}
          <BarButton icon="pen" label={showShape && !showPath ? 'Outline colour' : 'Colour'} swatch={color} active={which === 'color'} onClick={toggle('color')} />
          {(showShape || showText) && (
            <BarButton icon="bucket" label={showShape ? 'Fill' : 'Highlight'} swatch={fill ?? null} active={which === 'fill'} onClick={toggle('fill')} />
          )}
          {(showPath || showShape) && <BarButton icon="weight" label="Line style" active={which === 'line'} onClick={toggle('line')} />}
          {showPath && <BarButton icon="arrow2" label="Ends" active={which === 'ends'} onClick={toggle('ends')} />}
          {showText && (
            <BarButton label="Text style" active={which === 'text'} onClick={toggle('text')}>
              <span className="text-sm font-black px-0.5">Aa</span>
            </BarButton>
          )}
          {showToken && (
            <BarButton
              icon={tokens.some((t) => isPlayerKind(t.kind)) ? 'players' : 'zoomIn'}
              label={tokens.some((t) => isPlayerKind(t.kind)) ? 'Player: letters, side, look, size' : 'Size'}
              active={which === 'token'}
              onClick={toggle('token')}
            />
          )}
          {sel && (
            <>
              <BarButton icon="layers" label="Arrange" active={which === 'arrange'} onClick={toggle('arrange')} />
              <BarButton icon="duplicate" label="Duplicate (Ctrl/⌘ D)" onClick={ed.duplicate} />
              <BarButton icon="trash" label="Delete" danger onClick={ed.remove} />
            </>
          )}
          {!sel && <span className="text-[0.7rem] text-gray-400 truncate px-1">{hint}</span>}
        </>
      )}

      {which === 'color' && (
        <Popover anchor={open!.anchor} onClose={close} label="Colour" width={330}>
          <ColorPicker value={color} onChange={setColor} title={showShape && !showPath ? 'Outline' : 'Colour'} />
          {tokens.some((t) => t.color) && (
            <button
              type="button"
              onClick={() => ed.patch({ token: (t) => clean({ ...t, color: undefined }) }, 'color')}
              className="mt-1 min-h-9 px-2 text-xs font-bold text-gray-500 hover:text-gray-800"
            >
              Back to the team colour
            </button>
          )}
        </Popover>
      )}

      {which === 'fill' && (
        <Popover anchor={open!.anchor} onClose={close} label="Fill" width={330}>
          <ColorPicker value={fill} onChange={setFill} allowNone opacity={fillOpacity} onOpacity={fill ? setFillOpacity : undefined} title={showShape ? 'Fill' : 'Highlight'} />
        </Popover>
      )}

      {which === 'line' && (
        <Popover anchor={open!.anchor} onClose={close} label="Line style" width={330}>
          <MenuRow label="Weight">
            <input
              type="range"
              min={showShape && !showPath ? 0 : 0.2}
              max={3}
              step={0.1}
              value={width}
              onChange={(e) => {
                const n = Number(e.target.value)
                apply(
                  { path: (x) => ({ ...x, width: n }), shape: (x) => ({ ...x, strokeWidth: n }) },
                  { line: { width: n }, shape: { strokeWidth: n } },
                  'width',
                )
              }}
              className="flex-1 accent-[var(--gh-green)] min-h-9"
              aria-label="Line weight"
            />
            <span className="text-xs tabular-nums text-gray-400 w-7 text-right">{width.toFixed(1)}</span>
          </MenuRow>
          <MenuRow label="Dash">
            {DASH_STYLES.map((d) => (
              <Chip
                key={d.key}
                wide
                active={dash === d.dash}
                onClick={() => apply({ path: (x) => ({ ...x, dash: d.dash }), shape: (x) => clean({ ...x, dash: d.dash || undefined }) }, { line: { dash: d.dash }, shape: { dash: d.dash } }, 'dash')}
              >
                {d.label}
              </Chip>
            ))}
          </MenuRow>
          {showPath && (
            <>
              <MenuRow label="Path">
                {([undefined, 'wavy', 'zigzag'] as (LinePattern | undefined)[]).map((p) => (
                  <Chip
                    key={p ?? 'plain'}
                    wide
                    active={pattern === p}
                    onClick={() => apply({ path: (x) => clean({ ...x, pattern: p }) }, { line: { pattern: p } }, 'pattern')}
                  >
                    {p === 'wavy' ? '∿ Wavy' : p === 'zigzag' ? '⋀⋁ Zig-zag' : '— Plain'}
                  </Chip>
                ))}
              </MenuRow>
              {sel && (
                <MenuRow label="Bends">
                  <Chip wide active={!paths.every((x) => x.curve)} onClick={() => ed.patch({ path: (x) => clean({ ...x, curve: undefined }) }, 'curve')}>
                    Sharp corners
                  </Chip>
                  <Chip wide active={paths.every((x) => x.curve)} onClick={() => ed.patch({ path: (x) => clean({ ...x, curve: true }) }, 'curve')}>
                    Smooth curve
                  </Chip>
                </MenuRow>
              )}
              {sel && (
                <MenuRow label="Caps">
                  {(['round', 'butt', 'square'] as LineCap[]).map((c) => (
                    <Chip
                      key={c}
                      wide
                      active={(look?.lineCap ?? 'round') === c}
                      onClick={() => ed.patch({ path: (x) => clean({ ...x, lineCap: c === 'round' ? undefined : c }) }, 'linecap')}
                    >
                      {c === 'round' ? 'Round' : c === 'butt' ? 'Flat' : 'Square'}
                    </Chip>
                  ))}
                </MenuRow>
              )}
              {sel && (
                <MenuRow label="Solid">
                  <input
                    type="range"
                    min={10}
                    max={100}
                    step={5}
                    value={Math.round((look?.opacity ?? 1) * 100)}
                    onChange={(e) => {
                      const n = Number(e.target.value) / 100
                      ed.patch({ path: (x) => clean({ ...x, opacity: n >= 0.999 ? undefined : n }) }, 'opacity')
                    }}
                    className="flex-1 accent-[var(--gh-green)] min-h-9"
                    aria-label="How solid the line is"
                  />
                  <span className="text-xs tabular-nums text-gray-400 w-9 text-right">{Math.round((look?.opacity ?? 1) * 100)}%</span>
                </MenuRow>
              )}
              <MenuRule />
              <MenuLabel>Make it a…</MenuLabel>
              <div className="flex flex-wrap gap-1">
                {LINE_PRESETS.map((p) => (
                  <Chip
                    key={p.key}
                    wide
                    active={!sel && ed.linePen.preset === p.key}
                    onClick={() =>
                      apply(
                        { path: (x) => clean({ ...x, kind: p.kind, color: p.color, dash: p.dash, width: p.width, pattern: p.pattern, startCap: 'none', endCap: p.endCap }) },
                        { line: { preset: p.key, kind: p.kind, color: p.color, dash: p.dash, width: p.width, pattern: p.pattern, startCap: 'none', endCap: p.endCap } },
                        'preset',
                      )
                    }
                  >
                    <span className="inline-block w-3 h-1 rounded-full" style={{ background: p.color, boxShadow: '0 0 0 1px rgba(0,0,0,.15)' }} />
                    {p.label}
                  </Chip>
                ))}
              </div>
            </>
          )}
        </Popover>
      )}

      {which === 'ends' && (
        <Popover anchor={open!.anchor} onClose={close} label="Ends" width={330}>
          {(['startCap', 'endCap'] as const).map((which) => (
            <MenuRow key={which} label={which === 'startCap' ? 'Start' : 'End'}>
              {END_CAPS.map((c) => (
                <Chip
                  key={c.key}
                  title={c.label}
                  active={(which === 'startCap' ? startCap : endCap) === c.key}
                  onClick={() => apply({ path: (x) => ({ ...x, [which]: c.key }) }, { line: { [which]: c.key } as Partial<LinePen> }, 'cap')}
                >
                  <CapIcon cap={c.key} flip={which === 'startCap'} />
                </Chip>
              ))}
            </MenuRow>
          ))}
          {sel && (
            <MenuItem
              icon={<Icon name="turn" size={16} />}
              onClick={() =>
                ed.patch({
                  // The other way round: points reversed, the ends swapped with them.
                  path: (x) => {
                    const l = pathLook(x)
                    return { ...x, points: [...x.points].reverse(), startCap: l.endCap as EndCap, endCap: l.startCap as EndCap }
                  },
                })
              }
            >
              Point it the other way
            </MenuItem>
          )}
        </Popover>
      )}

      {which === 'text' && (
        <Popover anchor={open!.anchor} onClose={close} label="Text style" width={320}>
          <TextStyle ed={ed} apply={apply} />
        </Popover>
      )}

      {which === 'token' && tokens.length > 0 && (
        <Popover anchor={open!.anchor} onClose={close} label="Player" width={320}>
          {tokens.length === 1 && isPlayerKind(tokens[0].kind) && (
            <MenuRow label="Letters">
              <input
                value={tokens[0].label}
                onChange={(e) => ed.patch({ token: (t) => ({ ...t, label: e.target.value.slice(0, 4) }) }, 'label')}
                className="field !py-1 !w-24 text-sm min-h-9"
                placeholder="A, 27…"
                aria-label="Letters on the disc"
              />
            </MenuRow>
          )}
          {tokens.some((t) => isPlayerKind(t.kind)) && (
            <>
              <MenuRow label="Side">
                {(['offense', 'defense', 'goalie', 'coach'] as TokenKind[]).map((k) => (
                  <Chip key={k} wide active={tokens.every((t) => t.kind === k)} onClick={() => ed.patch({ token: (t) => (isPlayerKind(t.kind) ? { ...t, kind: k } : t) }, 'kind')}>
                    <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: tokenStyle(k).fill }} />
                    {tokenStyle(k).label}
                  </Chip>
                ))}
              </MenuRow>
              <MenuRow label="Drawn">
                {TOKEN_MARKS.map((m) => (
                  <Chip
                    key={m.key}
                    wide
                    active={tokens.every((t) => (t.mark ?? 'disc') === m.key)}
                    onClick={() => ed.patch({ token: (t) => clean({ ...t, mark: m.key === 'disc' ? undefined : (m.key as TokenMark) }) }, 'mark')}
                  >
                    {m.label}
                  </Chip>
                ))}
              </MenuRow>
            </>
          )}
          <MenuRow label="Size">
            <input
              type="range"
              min={0.4}
              max={3}
              step={0.1}
              value={tokens[0].size ?? 1}
              onChange={(e) => {
                const n = Number(e.target.value)
                ed.patch({ token: (t) => clean({ ...t, size: Math.abs(n - 1) < 0.001 ? undefined : n }) }, 'size')
              }}
              className="flex-1 accent-[var(--gh-green)] min-h-9"
              aria-label="Size"
            />
            <span className="text-xs tabular-nums text-gray-400 w-8 text-right">{(tokens[0].size ?? 1).toFixed(1)}×</span>
          </MenuRow>
        </Popover>
      )}

      {which === 'arrange' && <ArrangeMenu ed={ed} anchor={open!.anchor} onClose={close} />}
    </div>
  )
}

const r2 = (n: number) => Math.round(n * 100) / 100

function TextStyle({
  ed,
  apply,
}: {
  ed: Editor
  apply: (m: Mappers, p: { text?: Partial<TextPen> }, key: string) => void
}) {
  const t0 = ed.items.find((x) => x.type === 'text')?.it as import('@/lib/planner').BoardText | undefined
  const size = t0 ? t0.size : ed.textPen.size
  const bold = t0 ? !!t0.bold : ed.textPen.bold
  const italic = t0 ? !!t0.italic : ed.textPen.italic
  const underline = t0 ? !!t0.underline : false
  const align: TextAlign = t0 ? (t0.align ?? 'middle') : ed.textPen.align
  const setSize = (n: number) => {
    const s = Math.max(1, Math.min(12, r1(n)))
    apply({ text: (x) => ({ ...x, size: s }) }, { text: { size: s } }, 'size')
  }
  return (
    <>
      {t0 && ed.items.length === 1 && (
        <MenuItem icon={<Icon name="text" size={16} />} keys="Enter" onClick={() => ed.editText(t0.id)}>
          Edit the words
        </MenuItem>
      )}
      <MenuRow label="Size">
        <Chip onClick={() => setSize(size - 0.5)} title="Smaller">−</Chip>
        <span className="text-sm tabular-nums w-10 text-center">{size.toFixed(1)}</span>
        <Chip onClick={() => setSize(size + 0.5)} title="Bigger">+</Chip>
        {[2.5, 4, 6, 9].map((n) => (
          <Chip key={n} active={size === n} onClick={() => setSize(n)} title={`Size ${n}`}>
            {n === 2.5 ? 'S' : n === 4 ? 'M' : n === 6 ? 'L' : 'XL'}
          </Chip>
        ))}
      </MenuRow>
      <MenuRow label="Style">
        <Chip active={bold} title="Bold" onClick={() => apply({ text: (x) => ({ ...x, bold: !bold }) }, { text: { bold: !bold } }, 'bold')}>
          <b className="font-black">B</b>
        </Chip>
        <Chip active={italic} title="Italic" onClick={() => apply({ text: (x) => ({ ...x, italic: !italic }) }, { text: { italic: !italic } }, 'italic')}>
          <i>I</i>
        </Chip>
        {t0 && (
          <Chip active={underline} title="Underline" onClick={() => apply({ text: (x) => ({ ...x, underline: !underline }) }, {}, 'underline')}>
            <u>U</u>
          </Chip>
        )}
      </MenuRow>
      <MenuRow label="Align">
        {(
          [
            { key: 'start', label: 'Left', icon: 'alignL' },
            { key: 'middle', label: 'Centre', icon: 'alignC' },
            { key: 'end', label: 'Right', icon: 'alignR' },
          ] as { key: TextAlign; label: string; icon: IconName }[]
        ).map((a) => (
          <Chip key={a.key} active={align === a.key} title={a.label} onClick={() => apply({ text: (x) => clean({ ...x, align: a.key === 'middle' ? undefined : a.key }) }, { text: { align: a.key } }, 'align')}>
            <Icon name={a.icon} size={15} />
          </Chip>
        ))}
      </MenuRow>
      {t0 && (
        <MenuRow label="Font">
          <select
            value={t0.font ?? 'sans'}
            onChange={(e) => apply({ text: (x) => clean({ ...x, font: e.target.value === 'sans' ? undefined : e.target.value }) }, {}, 'font')}
            className="field !py-1 text-sm flex-1 min-h-9"
            aria-label="Font"
          >
            {BOARD_FONTS.map((f) => (
              <option key={f.key} value={f.key} style={{ fontFamily: f.stack }}>
                {f.label}
              </option>
            ))}
          </select>
        </MenuRow>
      )}
    </>
  )
}

/** A small picture of an end shape. */
function CapIcon({ cap, flip }: { cap: EndCap; flip: boolean }) {
  const head =
    cap === 'arrow' ? <path d="M14 4 L22 8 L14 12 z" fill="currentColor" />
    : cap === 'open' ? <path d="M15 4 L21 8 L15 12" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    : cap === 'dot' ? <circle cx={19} cy={8} r={3} fill="currentColor" />
    : cap === 'circle' ? <circle cx={19} cy={8} r={2.8} fill="#fff" stroke="currentColor" strokeWidth={1.5} />
    : cap === 'bar' ? <rect x={18.5} y={1.5} width={3} height={13} fill="currentColor" />
    : cap === 'square' ? <rect x={16} y={5} width={6} height={6} fill="currentColor" />
    : null
  return (
    <svg viewBox="0 0 24 16" width={26} height={16} aria-hidden="true" style={{ transform: flip ? 'scaleX(-1)' : undefined }}>
      <path d={`M2 8 H ${cap === 'none' ? 22 : 17}`} stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" />
      {head}
    </svg>
  )
}

export function ArrangeMenu({ ed, anchor, onClose }: { ed: Editor; anchor: Anchor; onClose: () => void }) {
  const n = ed.items.length
  const grouped = ed.items.some((x) => x.it.group)
  const locked = ed.items.length > 0 && ed.items.every((x) => x.it.locked)
  return (
    <Popover anchor={anchor} onClose={onClose} label="Arrange" width={340}>
      <ArrangeItems ed={ed} n={n} grouped={grouped} locked={locked} onDone={onClose} />
    </Popover>
  )
}

/** Order, line up, group and lock — shared by the bar's Arrange menu and the right-click menu. */
export function ArrangeItems({ ed, n, grouped, locked, onDone }: { ed: Editor; n: number; grouped: boolean; locked: boolean; onDone: () => void }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-x-1">
        <MenuItem icon={<Icon name="front" size={16} />} keys="⌘⇧]" onClick={() => ed.arrange('front')}>To front</MenuItem>
        <MenuItem icon={<Icon name="back" size={16} />} keys="⌘⇧[" onClick={() => ed.arrange('back')}>To back</MenuItem>
        <MenuItem icon={<Icon name="front" size={16} />} keys="⌘]" onClick={() => ed.arrange('forward')}>Forward</MenuItem>
        <MenuItem icon={<Icon name="back" size={16} />} keys="⌘[" onClick={() => ed.arrange('backward')}>Backward</MenuItem>
      </div>
      {n >= 2 && (
        <>
          <MenuLabel>Line up</MenuLabel>
          <div className="flex flex-wrap gap-1">
            {(
              [
                ['left', 'alignL', 'Left edges'],
                ['center', 'alignC', 'Centres, across'],
                ['right', 'alignR', 'Right edges'],
                ['top', 'alignT', 'Tops'],
                ['middle', 'alignM', 'Middles, down'],
                ['bottom', 'alignB', 'Bottoms'],
              ] as const
            ).map(([how, icon, label]) => (
              <Chip key={how} title={`Line up the ${label.toLowerCase()}`} onClick={() => ed.align(how)}>
                <Icon name={icon} size={16} />
              </Chip>
            ))}
            <Chip title="Space evenly across (3 or more)" disabled={n < 3} onClick={() => ed.distribute('x')}>
              <Icon name="distH" size={16} />
            </Chip>
            <Chip title="Space evenly down (3 or more)" disabled={n < 3} onClick={() => ed.distribute('y')}>
              <Icon name="distV" size={16} />
            </Chip>
          </div>
        </>
      )}
      <MenuRule />
      {n >= 2 && !grouped && (
        <MenuItem icon={<Icon name="group" size={16} />} keys="⌘G" onClick={() => { ed.group(); onDone() }}>
          Group — move them as one
        </MenuItem>
      )}
      {grouped && (
        <MenuItem icon={<Icon name="group" size={16} />} keys="⌘⇧G" onClick={() => { ed.ungroup(); onDone() }}>
          Ungroup
        </MenuItem>
      )}
      <MenuItem icon={<Icon name={locked ? 'unlock' : 'lock'} size={16} />} onClick={() => { ed.lock(!locked); onDone() }}>
        {locked ? 'Unlock' : 'Lock in place'}
      </MenuItem>
    </>
  )
}
