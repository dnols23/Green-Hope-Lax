'use client'
import { useState, type ReactNode } from 'react'
import { LINE_PRESETS, POSITION_TOKENS, SHAPE_KINDS, tokenStyle, type BoardHalf, type ShapeKind, type TokenKind } from '@/lib/planner'
import { FORMATIONS } from '@/lib/formations'
import { Icon, type IconName } from './Icon'
import { Chip, MenuItem, MenuLabel, MenuRule, Popover, anchorOf, type Anchor } from './Popover'
import type { Editor, LineGeo, Tool } from './types'

/** A toolbar button: an icon, and its name where there is room for it. At least 36px square. */
export function ToolButton({
  icon,
  label,
  active = false,
  onClick,
  title,
  caret = false,
  disabled = false,
  showLabel = 'sm',
  children,
}: {
  icon: IconName
  label: string
  active?: boolean
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void
  title?: string
  caret?: boolean
  disabled?: boolean
  /** When the name shows beside the icon: from small screens up, always, or never. */
  showLabel?: 'sm' | 'always' | 'never'
  children?: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title ?? label}
      aria-label={label}
      aria-pressed={active}
      aria-haspopup={caret ? 'menu' : undefined}
      disabled={disabled}
      className="h-9 min-w-9 px-2 rounded-lg text-xs font-bold border inline-flex items-center justify-center gap-1.5 transition-colors disabled:opacity-35 shrink-0"
      style={{
        background: active ? 'var(--gh-green)' : '#fff',
        color: active ? '#fff' : '#374151',
        borderColor: active ? 'var(--gh-green)' : '#e5e7eb',
      }}
    >
      <Icon name={icon} />
      {children}
      {showLabel !== 'never' && <span className={showLabel === 'sm' ? 'hidden sm:inline' : ''}>{label}</span>}
      {caret && (
        <svg viewBox="0 0 10 10" width={8} height={8} className="-ml-0.5 opacity-60 hidden sm:block" aria-hidden="true">
          <path d="M1.5 3.5L5 7l3.5-3.5" fill="none" stroke="currentColor" strokeWidth={1.6} />
        </svg>
      )}
    </button>
  )
}

/** A small picture of a line in a preset's look, for the menu. */
function LineSample({ color, dash, pattern }: { color: string; dash: string; pattern?: string }) {
  const d = pattern === 'wavy' ? 'M2 8 q 3 -6 6 0 t 6 0 t 6 0 t 6 0' : pattern === 'zigzag' ? 'M2 8 l 3 -5 l 3 10 l 3 -10 l 3 10 l 3 -10 l 3 10 l 3 -5' : 'M2 8 H 26'
  return (
    <svg viewBox="0 0 34 16" width={34} height={16} aria-hidden="true" className="shrink-0 rounded bg-[#4f8757]">
      <path d={d} fill="none" stroke={color} strokeWidth={2} strokeDasharray={dash ? dash.split(' ').map((n) => Number(n) * 1.6).join(' ') : undefined} strokeLinecap="round" />
      <path d="M26 4 L32 8 L26 12 z" fill={color} />
    </svg>
  )
}

const LINE_TOOLS: { key: string; label: string; icon: IconName; geo: LineGeo; caps?: [string, string]; keys?: string }[] = [
  { key: 'line', label: 'Line', icon: 'line', geo: 'straight', caps: ['none', 'none'] },
  { key: 'arrow', label: 'Arrow', icon: 'arrow', geo: 'straight', caps: ['none', 'arrow'], keys: 'L' },
  { key: 'arrow2', label: 'Double arrow', icon: 'arrow2', geo: 'straight', caps: ['arrow', 'arrow'] },
  { key: 'poly', label: 'Polyline — tap each corner', icon: 'poly', geo: 'poly', keys: 'P' },
  { key: 'curve', label: 'Curve — tap points, or drag and bend', icon: 'curve', geo: 'curve', keys: 'C' },
  { key: 'free', label: 'Scribble', icon: 'scribble', geo: 'free', keys: 'S' },
]

const SHAPE_ICONS: Record<ShapeKind, IconName> = {
  rect: 'rect',
  roundrect: 'roundrect',
  ellipse: 'ellipse',
  triangle: 'triangle',
  diamond: 'diamond',
  polygon: 'polygon',
}

/** The things that are not people, with the picture each gets. */
const THINGS: { kind: TokenKind; label: string; icon: IconName }[] = [
  { kind: 'cone', label: 'Cones', icon: 'cone' },
  { kind: 'ball', label: 'Balls', icon: 'ball' },
  { kind: 'goal', label: 'Goal', icon: 'goal' },
  { kind: 'ladder', label: 'Ladder', icon: 'ladder' },
  { kind: 'coach', label: 'Coach', icon: 'players' },
]

type Which = 'players' | 'lines' | 'shapes' | 'more'

/**
 * The board's tools, in a handful of groups rather than a wall of buttons:
 * the arrow, players and things, lines, shapes, words — then undo, redo, and
 * everything else behind "…". Each group opens a menu under its button, the
 * way a drawing program's do.
 */
export function Toolbar({ ed, extraTools }: { ed: Editor; extraTools?: ReactNode }) {
  const [open, setOpen] = useState<{ which: Which; anchor: Anchor } | null>(null)
  const toggle = (which: Which) => (e: React.MouseEvent<HTMLButtonElement>) =>
    setOpen(open?.which === which ? null : { which, anchor: anchorOf(e.currentTarget) })
  const close = () => setOpen(null)
  const pick = (t: Tool) => {
    ed.setTool(t)
    close()
  }
  const tool = ed.tool
  const pen = ed.linePen
  const lineTool = LINE_TOOLS.find((l) =>
    tool.t === 'line' && l.geo === tool.geo && (!l.caps || (l.caps[0] === pen.startCap && l.caps[1] === pen.endCap)),
  ) ?? (tool.t === 'line' ? LINE_TOOLS.find((l) => l.geo === tool.geo) : undefined)

  const stampIcon: IconName =
    tool.t === 'stamp' ? (THINGS.find((x) => x.kind === tool.kind && x.kind !== 'coach')?.icon ?? 'players') : 'players'

  return (
    <div className="flex flex-wrap items-center gap-1 mb-1.5 shrink-0">
      <ToolButton icon="select" label="Select" active={tool.t === 'select'} onClick={() => pick({ t: 'select' })} title="Select, move and change things (V)" />
      <ToolButton
        icon={stampIcon}
        label="Players"
        caret
        active={tool.t === 'stamp' || tool.t === 'place'}
        onClick={toggle('players')}
        title="Players, cones, balls, goals and sets"
      />
      <ToolButton icon={lineTool?.icon ?? 'lines'} label="Lines" caret active={tool.t === 'line'} onClick={toggle('lines')} title="Lines, arrows, curves and scribbles" />
      <ToolButton
        icon={tool.t === 'shape' ? SHAPE_ICONS[tool.kind] : 'shapes'}
        label="Shapes"
        caret
        active={tool.t === 'shape'}
        onClick={toggle('shapes')}
        title="Zones: rectangles, circles, triangles, polygons"
      />
      <ToolButton icon="text" label="Text" active={tool.t === 'text'} onClick={() => pick({ t: 'text' })} title="Tap the field to write on it (T)" />
      <span className="hidden sm:block w-px h-6 bg-gray-200 mx-0.5" aria-hidden="true" />
      <ToolButton icon="undo" label="Undo" showLabel="never" onClick={ed.undo} disabled={!ed.canUndo} title="Undo (Ctrl/⌘ Z)" />
      <ToolButton icon="redo" label="Redo" showLabel="never" onClick={ed.redo} disabled={!ed.canRedo} title="Redo (Ctrl/⌘ Shift Z)" />
      <ToolButton icon="more" label="More" showLabel="never" caret active={open?.which === 'more'} onClick={toggle('more')} title="View, grid, picture, clear…" />
      {/* On a phone in a card there is not room for all nine in a row; full
          screen is also a double tap on the grass, and in the … menu. */}
      <span className={ed.full ? 'contents' : 'hidden sm:contents'}>
        <ToolButton
          icon={ed.full ? 'unfull' : 'full'}
          label={ed.full ? 'Done' : 'Full screen'}
          showLabel="never"
          onClick={ed.toggleFull}
          title="Fill the screen — turn a phone sideways"
        />
      </span>
      {extraTools && <div className="flex flex-wrap items-center gap-1">{extraTools}</div>}

      {open?.which === 'players' && (
        <Popover anchor={open.anchor} onClose={close} label="Players and things" width={330}>
          <MenuLabel>Players — each tap on the field puts one down</MenuLabel>
          <div className="flex flex-wrap gap-1">
            {POSITION_TOKENS.map((p) => (
              <Chip
                key={p.label}
                wide
                title={`Add ${p.title}`}
                active={tool.t === 'stamp' && tool.label === p.label && !tool.numbered}
                onClick={() => pick({ t: 'stamp', kind: p.kind, label: p.label, title: p.title })}
              >
                <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: tokenStyle(p.kind).fill }} />
                {p.label}
              </Chip>
            ))}
          </div>
          <MenuLabel>Numbered</MenuLabel>
          <div className="flex flex-wrap gap-1">
            <Chip wide title="Offense, numbered 1, 2, 3…" onClick={() => pick({ t: 'stamp', kind: 'offense', label: '', numbered: true, title: 'numbered offense' })}>
              <span className="inline-flex w-4 h-4 rounded-full text-[0.55rem] text-white items-center justify-center" style={{ background: tokenStyle('offense').fill }}>1</span>
              Offense
            </Chip>
            <Chip wide title="Defense, numbered 1, 2, 3…" onClick={() => pick({ t: 'stamp', kind: 'defense', label: '', numbered: true, title: 'numbered defense' })}>
              <span className="inline-flex w-4 h-4 rounded-full text-[0.55rem] text-white items-center justify-center" style={{ background: tokenStyle('defense').fill }}>1</span>
              Defense
            </Chip>
            <Chip wide title="Offense as O's" onClick={() => pick({ t: 'stamp', kind: 'offense', label: '', numbered: true, mark: 'ring', title: "O's" })}>
              <span className="inline-block w-3.5 h-3.5 rounded-full border-2" style={{ borderColor: tokenStyle('offense').fill }} />O
            </Chip>
            <Chip wide title="Defense as X's" onClick={() => pick({ t: 'stamp', kind: 'defense', label: '', numbered: true, mark: 'x', title: "X's" })}>
              <span className="font-black" style={{ color: tokenStyle('defense').fill }}>✕</span>X
            </Chip>
          </div>
          <MenuLabel>Things</MenuLabel>
          <div className="flex flex-wrap gap-1">
            {THINGS.map((x) => (
              <Chip
                key={x.kind}
                wide
                active={tool.t === 'stamp' && tool.kind === x.kind}
                title={`Add ${x.label.toLowerCase()}`}
                onClick={() => pick({ t: 'stamp', kind: x.kind, label: x.kind === 'coach' ? 'C' : '', title: x.label.toLowerCase() })}
              >
                <span style={{ color: tokenStyle(x.kind).fill === '#f5f5f5' ? '#9ca3af' : tokenStyle(x.kind).fill }}>
                  <Icon name={x.icon} size={15} />
                </span>
                {x.label}
              </Chip>
            ))}
          </div>

          <MenuLabel>Sets — then tap the cage you&rsquo;re attacking</MenuLabel>
          <div className="flex flex-wrap gap-1">
            {FORMATIONS.map((f) => (
              <Chip key={f.key} wide title={f.blurb} active={tool.t === 'place' && tool.key === f.key} onClick={() => pick({ t: 'place', from: 'formation', key: f.key, title: f.name })}>
                {f.name}
              </Chip>
            ))}
            {ed.looks.map((l) => (
              <Chip key={l.id} wide title={`${l.spots.length} discs, saved by the staff`} active={tool.t === 'place' && tool.key === l.id} onClick={() => pick({ t: 'place', from: 'look', key: l.id, title: l.name })}>
                {l.name}
              </Chip>
            ))}
          </div>

          {ed.players.length > 0 && (
            <>
              <MenuLabel>In this block — tap one, then the field</MenuLabel>
              <div className="flex flex-wrap gap-1">
                {ed.players.map((p) => {
                  const on = ed.board.tokens.some((t) => t.playerId === p.id)
                  return (
                    <Chip
                      key={p.id}
                      wide
                      disabled={on}
                      title={on ? `${p.name} is already on the board` : `Add ${p.name}`}
                      onClick={() =>
                        pick({ t: 'stamp', kind: ed.nextKind, label: p.number || p.name.slice(0, 2).toUpperCase(), playerId: p.id, title: p.name })
                      }
                    >
                      {p.number ? `#${p.number} ` : ''}
                      {p.name}
                    </Chip>
                  )
                })}
              </div>
              <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                <span className="text-[0.7rem] text-gray-500 px-1">Add them as</span>
                {(['offense', 'defense', 'goalie'] as TokenKind[]).map((k) => (
                  <Chip key={k} active={ed.nextKind === k} onClick={() => ed.setNextKind(k)} wide>
                    {tokenStyle(k).label}
                  </Chip>
                ))}
              </div>
            </>
          )}
        </Popover>
      )}

      {open?.which === 'lines' && (
        <Popover anchor={open.anchor} onClose={close} label="Lines" width={300}>
          {LINE_TOOLS.map((l) => (
            <MenuItem
              key={l.key}
              icon={<Icon name={l.icon} size={17} />}
              keys={l.keys}
              onClick={() => {
                // Line, arrow and double arrow are their ends; the others start
                // from the ends of the kind of line the pen is drawing.
                const preset = LINE_PRESETS.find((p) => p.key === pen.preset)
                ed.setLinePen(
                  l.caps
                    ? { startCap: l.caps[0] as 'none', endCap: l.caps[1] as 'none' }
                    : { startCap: 'none', endCap: preset?.endCap ?? 'arrow' },
                )
                pick({ t: 'line', geo: l.geo })
              }}
            >
              <span className={lineTool?.key === l.key ? 'text-[var(--gh-green)] font-black' : ''}>{l.label}</span>
            </MenuItem>
          ))}
          <MenuRule />
          <MenuLabel>Draw it as</MenuLabel>
          <div className="grid grid-cols-2 gap-1">
            {LINE_PRESETS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => {
                  ed.setLinePen({ preset: p.key, kind: p.kind, color: p.color, dash: p.dash, width: p.width, pattern: p.pattern, endCap: p.endCap })
                  pick(tool.t === 'line' ? tool : { t: 'line', geo: 'straight' })
                }}
                className="min-h-9 flex items-center gap-2 px-2 rounded-lg border text-xs font-bold text-left"
                style={{
                  borderColor: pen.preset === p.key ? 'var(--gh-green)' : '#e5e7eb',
                  background: pen.preset === p.key ? '#eef6f1' : '#fff',
                }}
              >
                <LineSample color={p.color} dash={p.dash} pattern={p.pattern} />
                {p.label}
              </button>
            ))}
          </div>
        </Popover>
      )}

      {open?.which === 'shapes' && (
        <Popover anchor={open.anchor} onClose={close} label="Shapes" width={260}>
          <MenuLabel>Drag on the field, or tap for one</MenuLabel>
          {SHAPE_KINDS.map((s) => (
            <MenuItem key={s.key} icon={<Icon name={SHAPE_ICONS[s.key]} size={17} />} keys={s.key === 'rect' ? 'R' : s.key === 'ellipse' ? 'O' : undefined} onClick={() => pick({ t: 'shape', kind: s.key })}>
              <span className={tool.t === 'shape' && tool.kind === s.key ? 'text-[var(--gh-green)] font-black' : ''}>
                {s.key === 'polygon' ? 'Polygon — tap each corner' : s.label}
              </span>
            </MenuItem>
          ))}
        </Popover>
      )}

      {open?.which === 'more' && <MoreMenu ed={ed} anchor={open.anchor} onClose={close} />}
    </div>
  )
}

function MoreMenu({ ed, anchor, onClose }: { ed: Editor; anchor: Anchor; onClose: () => void }) {
  const [confirmClear, setConfirmClear] = useState(false)
  const run = (f: () => void) => () => {
    f()
    onClose()
  }
  const toggle = (on: boolean) => (
    <span className="w-5 inline-flex justify-center" style={{ color: on ? 'var(--gh-green)' : '#d1d5db' }}>
      <Icon name={on ? 'check' : 'close'} size={15} />
    </span>
  )
  return (
    <Popover anchor={anchor} onClose={onClose} label="More" width={280}>
      <MenuItem icon={<Icon name="select_all" size={16} />} keys="⌘A" onClick={run(ed.selectAll)}>
        Select all
      </MenuItem>
      <MenuItem icon={<Icon name="paste" size={16} />} keys="⌘V" onClick={run(ed.paste)} disabled={!ed.hasClip()}>
        Paste
      </MenuItem>
      <MenuRule />
      <MenuLabel>View</MenuLabel>
      <div className="flex gap-1 px-1 flex-wrap">
        {(['off', 'right', 'left'] as BoardHalf[]).map((h) => (
          <Chip key={h} wide active={ed.half === h} onClick={() => ed.setHalf(h)}>
            {h === 'off' ? 'Whole field' : h === 'right' ? 'Right end' : 'Left end'}
          </Chip>
        ))}
      </div>
      <MenuItem icon={<Icon name="turn" size={16} />} onClick={ed.turnView}>
        Turn a quarter{ed.turn ? ` (${ed.turn}°)` : ''}
      </MenuItem>
      <MenuItem icon={<Icon name={ed.full ? 'unfull' : 'full'} size={16} />} onClick={run(ed.toggleFull)}>
        {ed.full ? 'Leave full screen' : 'Full screen'}
      </MenuItem>
      <div className="flex gap-1 px-1 py-1">
        <Chip wide onClick={() => ed.zoomBy(1.5)} title="Zoom in">
          <Icon name="zoomIn" size={15} /> In
        </Chip>
        <Chip wide onClick={() => ed.zoomBy(1 / 1.5)} disabled={!ed.zoomed} title="Zoom out">
          <Icon name="zoomOut" size={15} /> Out
        </Chip>
        <Chip wide onClick={ed.zoomReset} disabled={!ed.zoomed} title="Show it all">
          Fit
        </Chip>
      </div>
      <MenuRule />
      <MenuItem icon={toggle(ed.prefs.grid)} onClick={() => ed.setPrefs({ grid: !ed.prefs.grid })}>
        Show a 5-yard grid
      </MenuItem>
      <MenuItem icon={toggle(ed.prefs.snapGrid)} onClick={() => ed.setPrefs({ snapGrid: !ed.prefs.snapGrid })}>
        Snap to the yard
      </MenuItem>
      <MenuItem icon={toggle(ed.prefs.snapObjects)} onClick={() => ed.setPrefs({ snapObjects: !ed.prefs.snapObjects })}>
        Line up with things and field lines
      </MenuItem>
      {ed.shot && (
        <>
          <MenuRule />
          <MenuItem icon={<Icon name="camera" size={16} />} onClick={run(ed.shot)} disabled={ed.shooting}>
            {ed.shooting ? 'Saving…' : 'Save a picture to the Library'}
          </MenuItem>
        </>
      )}
      <MenuRule />
      {confirmClear ? (
        <div className="flex items-center gap-1.5 px-1 py-1">
          <span className="text-xs font-semibold text-gray-500 flex-1">Everything off? (Undo brings it back.)</span>
          <Chip wide onClick={run(ed.clear)}>Clear</Chip>
          <Chip wide onClick={() => setConfirmClear(false)}>Keep</Chip>
        </div>
      ) : (
        <MenuItem icon={<Icon name="eraser" size={16} />} danger onClick={() => setConfirmClear(true)}>
          Clear the board
        </MenuItem>
      )}
      <MenuRule />
      <details className="px-2 py-1 text-xs text-gray-500">
        <summary className="cursor-pointer font-bold min-h-9 flex items-center">Keyboard shortcuts</summary>
        <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 pb-1">
          <b>V L P C S</b><span>select, arrow, polyline, curve, scribble</span>
          <b>R O T K</b><span>rectangle, circle, text, cones</span>
          <b>⌘Z ⌘⇧Z</b><span>undo, redo (Ctrl+Y too)</span>
          <b>⌘C ⌘X ⌘V</b><span>copy, cut, paste — across boards</span>
          <b>⌘D ⌘A</b><span>duplicate, select all</span>
          <b>⌘G ⌘⇧G</b><span>group, ungroup</span>
          <b>⌘] ⌘[</b><span>forward, backward (⇧ for front, back)</span>
          <b>Arrows</b><span>nudge (⇧ for five yards)</span>
          <b>Enter</b><span>finish a line, or edit words</span>
          <b>Shift</b><span>square shapes, 15° lines, add to selection</span>
          <b>Alt</b><span>drag without lining up</span>
        </div>
      </details>
    </Popover>
  )
}
