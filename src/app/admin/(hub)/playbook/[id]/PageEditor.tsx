'use client'
import dynamic from 'next/dynamic'
import { useState, type ReactNode } from 'react'
import { SlideCanvas } from '@/components/playbook/SlideCanvas'
import type { SlidePlay } from '@/components/playbook/BlockArt'
import {
  EditInPlayboard,
  FieldEditor,
  PictureEditor,
  ShelveForm,
  WordsEditor,
  confirmDetach,
  detachStep,
  type SetBlocks,
  type ToPlayboard,
} from './KindEditors'
import { Popover, MenuItem, anchorUnder, type Anchor } from './Menus'
import {
  BLOCK_KINDS,
  PAGE_KINDS,
  PAGE_LAYOUTS,
  SHAPES,
  SLIDE_COLORS,
  TEXT_SIZES,
  autoFrames,
  withTitleBox,
  blockId,
  clampFrame,
  emptyBlock,
  firstOf,
  isPageKind,
  type Frame,
  type InsertKind,
  type PageLayout,
  type PlaybookPage,
  type ShapeKind,
  type SlideBlock,
} from '@/lib/playbook'
import { EMPTY_BOARD, type Board } from '@/lib/planner'

/* The real board, every tool on it. Browser-only and heavy, so it is only
   fetched once a field on the page is opened for drawing. */
const FieldBoard = dynamic(
  () => import('@/components/planner/FieldBoard').then((m) => m.FieldBoard),
  { ssr: false },
)

export interface Shot {
  id: string
  title: string
  url: string
}

/**
 * The page being made, under the top bar and beside the filmstrip.
 *
 * The page is the editor: you change things on the page itself rather than
 * describing them in a form and hoping. Whatever is selected gets its own
 * controls underneath — the play it shows, the words it says, its colour —
 * and everything else stays out of the way.
 */
export function PageEditor({
  page,
  plays,
  shots,
  setBlocks,
  setLayout,
  selected,
  onSelect,
  onDrawing,
  to,
  children,
}: {
  page: PlaybookPage
  plays: SlidePlay[]
  shots: Shot[]
  setBlocks: SetBlocks
  setLayout: (next: PageLayout) => void
  selected: string | null
  onSelect: (id: string | null) => void
  /** Told when a field opens full screen and closes, so the page keys stand down. */
  onDrawing: (on: boolean) => void
  to: ToPlayboard
  /** The speaker notes, which sit right under the page. */
  children?: ReactNode
}) {
  const { blocks, layout, title } = page
  const [inserting, setInserting] = useState<Anchor | null>(null)
  /** The block whose field is open full screen. */
  const [drawing, setDrawingState] = useState<string | null>(null)

  const playMap = Object.fromEntries(plays.map((p) => [p.id, p]))
  const active = blocks.find((b) => b.id === selected) ?? null
  const kind = isPageKind(layout) ? layout : null

  function draw(id: string | null) {
    setDrawingState(id)
    onDrawing(!!id)
  }

  /* Touching anything is a decision to place this page by hand. A page laid
     out for you that you then rearrange is a page you rearranged. */
  const takeOver = () => {
    if (layout === 'free') return
    setLayout('free')
    // The title comes along as a text box of its own, so it can be moved or deleted.
    setBlocks((bs) => withTitleBox(autoFrames(bs, 'free'), title))
  }

  /* Changing what sort of page it is keeps what is already on it, and makes
     sure the new kind has the thing it is made of. */
  function switchTo(next: PageLayout) {
    if (next === layout) return
    if (next === 'field' && !firstOf(blocks, 'play')) {
      setBlocks((bs) => [{ kind: 'play', id: blockId(), playId: '', board: EMPTY_BOARD }, ...bs])
    }
    if (next === 'words' && !firstOf(blocks, 'text')) {
      setBlocks((bs) => [...bs, { kind: 'text', id: blockId(), body: '', size: 'body' }])
    }
    if (next === 'free') setBlocks((bs) => withTitleBox(autoFrames(bs, 'free'), title))
    onSelect(null)
    setLayout(next)
  }

  function patch(id: string, next: Partial<SlideBlock>) {
    setBlocks((bs) => bs.map((b) => (b.id === id ? ({ ...b, ...next } as SlideBlock) : b)))
  }
  function setFrame(id: string, frame: Frame) {
    takeOver()
    setBlocks((bs) => bs.map((b) => (b.id === id ? { ...b, frame } : b)))
  }
  function drop(id: string) {
    setBlocks((bs) => bs.filter((b) => b.id !== id))
    onSelect(null)
  }
  function duplicate(id: string) {
    const copyId = blockId()
    setBlocks((bs) => {
      const b = bs.find((x) => x.id === id)
      if (!b?.frame) return bs
      const zs = bs.map((x, i) => x.z ?? i)
      const copy = { ...b, id: copyId, z: Math.max(...zs) + 1, frame: clampFrame({ ...b.frame, x: b.frame.x + 20, y: b.frame.y + 20 }) }
      return [...bs, copy as SlideBlock]
    })
    onSelect(copyId)
  }
  function add(k: InsertKind) {
    takeOver()
    const b = emptyBlock(k)
    setBlocks((bs) => [...autoFrames(bs, 'free'), { ...b, z: bs.length }])
    onSelect(b.id)
  }
  function lift(id: string, to: 'front' | 'back') {
    setBlocks((bs) => {
      const zs = bs.map((b, i) => b.z ?? i)
      const edge = to === 'front' ? Math.max(...zs) + 1 : Math.min(...zs) - 1
      return bs.map((b, i) => (b.id === id ? { ...b, z: edge } : { ...b, z: b.z ?? i }))
    })
  }

  const drawn = drawing ? blocks.find((b) => b.id === drawing) : null
  const drawnBoard: Board | null =
    drawn?.kind === 'play' ? drawn.board ?? playMap[drawn.playId]?.board ?? EMPTY_BOARD : null

  return (
    <div>
      {kind === 'field' && (
        <FieldEditor page={page} plays={plays} blocks={blocks} setBlocks={setBlocks} title={title} onDrawing={onDrawing} to={to} />
      )}
      {kind === 'words' && <WordsEditor page={page} blocks={blocks} setBlocks={setBlocks} />}
      {kind === 'picture' && <PictureEditor page={page} shots={shots} blocks={blocks} setBlocks={setBlocks} />}

      {!kind && (
        <>
          <SlideCanvas
            blocks={blocks}
            plays={playMap}
            title={title}
            selected={selected}
            onSelect={onSelect}
            onChange={setFrame}
            onDelete={drop}
            onDuplicate={duplicate}
            onText={(id, body) => patch(id, { body } as Partial<SlideBlock>)}
          />

          <div className="flex items-center gap-2 flex-wrap mt-2">
            <button
              type="button"
              onClick={(e) => setInserting(inserting ? null : anchorUnder(e.currentTarget))}
              aria-expanded={!!inserting}
              className="btn btn-ghost !py-1.5 text-sm"
            >
              ＋ Insert
            </button>
            <select
              value={layout}
              onChange={(e) => {
                onSelect(null)
                setLayout(e.target.value as PageLayout)
              }}
              className="field !py-1.5 !w-auto text-sm"
              aria-label="How the page is laid out"
              title={PAGE_LAYOUTS.find((l) => l.key === layout)?.hint}
            >
              {PAGE_LAYOUTS.map((l) => (
                <option key={l.key} value={l.key}>{l.label}</option>
              ))}
            </select>
            <span className="text-xs text-gray-400 hidden sm:inline">
              {active ? 'Drag to move · pull a corner to resize · Delete removes' : 'Tap something on the page to change it'}
            </span>
          </div>

          {inserting && (
            <Popover at={inserting} onClose={() => setInserting(null)} label="Insert">
              {BLOCK_KINDS.map((k) => (
                <MenuItem
                  key={k.kind}
                  onClick={() => {
                    setInserting(null)
                    add(k.kind)
                  }}
                >
                  <span aria-hidden className="w-5 text-center">{k.icon}</span> {k.label}
                </MenuItem>
              ))}
            </Popover>
          )}

          {active && (
            <Inspector
              block={active}
              plays={plays}
              playMap={playMap}
              shots={shots}
              to={to}
              patch={patch}
              onLift={lift}
              onDuplicate={duplicate}
              onRemove={drop}
              onDraw={(id) => {
                const b = blocks.find((x) => x.id === id)
                if (b?.kind === 'play' && b.step !== undefined && b.playId) {
                  if (!confirmDetach(playMap[b.playId]?.name ?? title)) return
                  setBlocks(detachStep)
                }
                draw(id)
              }}
            />
          )}
        </>
      )}

      {children}

      {/* What sort of page this is — rarely changed, so it sits quietly at the bottom. */}
      <div className="mt-4 flex items-center gap-2 flex-wrap">
        <span className="text-[0.65rem] font-black uppercase tracking-wider text-gray-400">Page type</span>
        <div className="inline-flex flex-wrap rounded-lg bg-gray-100 p-0.5" role="radiogroup" aria-label="What sort of page">
          {[
            ...PAGE_KINDS.map((k) => ({ key: k.key as PageLayout, label: k.label, icon: k.icon, hint: k.hint })),
            { key: 'free' as PageLayout, label: 'Arrange', icon: '⬚', hint: 'Put boards, pictures, words and shapes exactly where you want them.' },
          ].map((k) => {
            const on = k.key === layout || (k.key === 'free' && !kind)
            return (
              <button
                key={k.key}
                type="button"
                role="radio"
                aria-checked={on}
                title={k.hint}
                onClick={() => switchTo(k.key)}
                className={`px-2.5 py-1 text-xs font-bold rounded-md ${on ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-800'}`}
              >
                <span aria-hidden className="mr-1">{k.icon}</span>
                {k.label}
              </button>
            )
          })}
        </div>
      </div>

      {drawn && drawnBoard && (
        <FieldBoard
          key={drawn.id}
          board={drawnBoard}
          onChange={(next: Board) => patch(drawn.id, { board: next })}
          startFull
          onLeaveFull={() => draw(null)}
          title={(drawn.kind === 'play' && drawn.caption) || title || 'The field'}
        />
      )}
    </div>
  )
}

/** The controls for whatever is selected on an arranged page — and only those. */
function Inspector({
  block: active,
  plays,
  playMap,
  shots,
  to,
  patch,
  onLift,
  onDuplicate,
  onRemove,
  onDraw,
}: {
  block: SlideBlock
  plays: SlidePlay[]
  playMap: Record<string, SlidePlay>
  shots: Shot[]
  to: ToPlayboard
  patch: (id: string, next: Partial<SlideBlock>) => void
  onLift: (id: string, to: 'front' | 'back') => void
  onDuplicate: (id: string) => void
  onRemove: (id: string) => void
  onDraw: (id: string) => void
}) {
  const [shelving, setShelving] = useState(false)
  const label = active.kind === 'play' && active.board ? 'Board' : BLOCK_KINDS.find((k) => k.kind === active.kind)?.label
  const quiet = 'text-xs font-bold text-gray-500 hover:text-gray-800'

  return (
    <div className="card p-3 mt-3 space-y-3">
      <div className="flex items-center gap-x-3 gap-y-1 flex-wrap">
        <span className="text-xs font-black uppercase tracking-wider text-gray-400">{label}</span>
        <span className="ml-auto flex items-center gap-3 flex-wrap">
          <button type="button" onClick={() => onLift(active.id, 'front')} className={quiet}>To front</button>
          <button type="button" onClick={() => onLift(active.id, 'back')} className={quiet}>To back</button>
          <button type="button" onClick={() => onDuplicate(active.id)} className={quiet}>Duplicate</button>
          <button type="button" onClick={() => onRemove(active.id)} className="text-xs font-bold text-red-600 hover:text-red-800">Remove</button>
        </span>
      </div>

      {active.kind === 'play' && (() => {
        const saved = active.playId ? playMap[active.playId] ?? null : null
        const isStep = !!active.playId && active.step !== undefined
        return (
          <div className="space-y-3">
            {isStep ? (
              <div className="flex items-center gap-2 flex-wrap">
                {saved && <EditInPlayboard playId={saved.id} to={to} />}
                <button type="button" onClick={() => onDraw(active.id)} className={quiet}>Draw here instead…</button>
              </div>
            ) : active.board ? (
              /* This page's own field. Drawn here, and nowhere else changes. */
              <>
                <div className="flex items-center gap-2 flex-wrap">
                  <button type="button" onClick={() => onDraw(active.id)} className="btn btn-primary !py-1.5 text-sm">✏️ Draw on it</button>
                  {saved && (
                    <button type="button" onClick={() => patch(active.id, { board: undefined })} className={quiet}>
                      Go back to the saved play
                    </button>
                  )}
                  <button type="button" onClick={() => setShelving((v) => !v)} aria-expanded={shelving}
                    className="text-xs font-bold text-[var(--gh-green)] hover:underline ml-auto">
                    Put it in the Library too →
                  </button>
                </div>
                {shelving && <ShelveForm board={active.board} />}
              </>
            ) : (
              <div className="flex items-center gap-2 flex-wrap">
                <select value={active.playId} onChange={(e) => patch(active.id, { playId: e.target.value })} className="field !py-1.5 text-sm flex-1 min-w-[10rem]">
                  <option value="">— pick a play —</option>
                  {plays.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                {saved && <EditInPlayboard playId={saved.id} to={to} primary={false} />}
                <button type="button" disabled={!saved}
                  onClick={() => patch(active.id, { board: saved?.board ?? EMPTY_BOARD })}
                  className={`${quiet} disabled:opacity-40`}>
                  Take a copy I can change here
                </button>
              </div>
            )}

            <input value={active.caption ?? ''} onChange={(e) => patch(active.id, { caption: e.target.value })}
              placeholder={active.board ? 'Caption' : "Caption (the play's name otherwise)"} className="field !py-1.5 text-sm" />
          </div>
        )
      })()}

      {active.kind === 'shot' && (
        <div className="grid sm:grid-cols-2 gap-2">
          <select value={active.url} onChange={(e) => patch(active.id, { url: e.target.value })} className="field !py-1.5 text-sm">
            <option value="">— pick a picture —</option>
            {shots.map((s) => <option key={s.id} value={s.url}>{s.title || 'Untitled'}</option>)}
          </select>
          <input value={active.caption ?? ''} onChange={(e) => patch(active.id, { caption: e.target.value })}
            placeholder="Caption" className="field !py-1.5 text-sm" />
        </div>
      )}

      {active.kind === 'text' && (
        <>
          <textarea value={active.body} onChange={(e) => patch(active.id, { body: e.target.value })} rows={3}
            placeholder="What you want them to know…" className="field" />
          <div className="flex items-end gap-2 flex-wrap">
            <select value={active.size} onChange={(e) => patch(active.id, { size: e.target.value as 'heading' | 'body' | 'small', pt: undefined })}
              className="field !py-1.5 !w-auto text-sm" aria-label="Text size">
              {TEXT_SIZES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
            <button type="button" onClick={() => patch(active.id, { bold: !active.bold })} aria-pressed={!!active.bold} aria-label="Bold"
              className={`btn !py-1.5 text-sm ${active.bold ? 'btn-primary' : 'btn-ghost'}`}><b>B</b></button>
            <button type="button" onClick={() => patch(active.id, { italic: !active.italic })} aria-pressed={!!active.italic} aria-label="Italic"
              className={`btn !py-1.5 text-sm ${active.italic ? 'btn-primary' : 'btn-ghost'}`}><i>I</i></button>
            {(['left', 'center', 'right'] as const).map((a) => (
              <button key={a} type="button" onClick={() => patch(active.id, { align: a })} aria-pressed={(active.align ?? 'left') === a} aria-label={`Align ${a}`}
                className={`btn !py-1.5 text-sm ${(active.align ?? 'left') === a ? 'btn-primary' : 'btn-ghost'}`}>
                {a === 'left' ? '⬅' : a === 'center' ? '↔' : '➡'}
              </button>
            ))}
            <Swatches value={active.color ?? '#111111'} onPick={(c) => patch(active.id, { color: c })} label="Ink" />
            <Swatches value={active.fill ?? ''} onPick={(c) => patch(active.id, { fill: c || undefined })} label="Panel" clearable />
          </div>
        </>
      )}

      {active.kind === 'list' && (
        <>
          <input value={active.heading ?? ''} onChange={(e) => patch(active.id, { heading: e.target.value })}
            placeholder="Reads · Coaching points · If they slide early" className="field !py-1.5 text-sm" />
          <textarea value={active.items.join('\n')} onChange={(e) => patch(active.id, { items: e.target.value.split('\n') })}
            rows={4} placeholder="One point per line" className="field" />
          <div className="flex items-end gap-2 flex-wrap">
            <Swatches value={active.color ?? '#374151'} onPick={(c) => patch(active.id, { color: c })} label="Ink" />
            <Swatches value={active.fill ?? ''} onPick={(c) => patch(active.id, { fill: c || undefined })} label="Panel" clearable />
          </div>
        </>
      )}

      {active.kind === 'shape' && (
        <div className="flex items-end gap-2 flex-wrap">
          <select value={active.shape} onChange={(e) => patch(active.id, { shape: e.target.value as ShapeKind })}
            className="field !py-1.5 !w-auto text-sm" aria-label="Shape">
            {SHAPES.map((sh) => <option key={sh.key} value={sh.key}>{sh.label}</option>)}
          </select>
          <Swatches value={active.color ?? '#7A1F2B'} onPick={(c) => patch(active.id, { color: c })} label="Colour" />
          {(active.shape === 'rect' || active.shape === 'ellipse') && (
            <button type="button" onClick={() => patch(active.id, { filled: !active.filled })}
              className={`btn !py-1.5 text-sm ${active.filled ? 'btn-primary' : 'btn-ghost'}`}>
              {active.filled ? 'Filled' : 'Outline'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/** The program's colours, as buttons rather than a colour picker nobody opens. */
function Swatches({
  value,
  onPick,
  label,
  clearable = false,
}: {
  value: string
  onPick: (c: string) => void
  label: string
  clearable?: boolean
}) {
  return (
    <div>
      <div className="text-[0.6rem] font-black uppercase tracking-wider text-gray-400 mb-1">{label}</div>
      <div className="flex flex-wrap gap-1">
        {clearable && (
          <button type="button" onClick={() => onPick('')} title="None" aria-label={`${label}: none`}
            className="w-6 h-6 rounded border border-gray-200 text-[0.6rem] text-gray-400"
            style={{ outline: value === '' ? '2px solid var(--gh-green)' : undefined, outlineOffset: 1 }}>
            —
          </button>
        )}
        {SLIDE_COLORS.map((c) => (
          <button key={c} type="button" onClick={() => onPick(c)} title={c} aria-label={`${label}: ${c}`}
            className="w-6 h-6 rounded border border-gray-200"
            style={{ background: c, outline: value.toLowerCase() === c ? '2px solid var(--gh-green)' : undefined, outlineOffset: 1 }} />
        ))}
      </div>
    </div>
  )
}
