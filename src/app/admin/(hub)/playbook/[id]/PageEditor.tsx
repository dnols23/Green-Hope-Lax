'use client'
import Link from 'next/link'
import { useState } from 'react'
import { SlideCanvas } from '@/components/playbook/SlideCanvas'
import type { SlidePlay } from '@/components/playbook/BlockArt'
import { deletePlaybookPage, savePlaybookPage } from '@/lib/playbookActions'
import {
  BLOCK_KINDS,
  PAGE_LAYOUTS,
  SHAPES,
  SLIDE_COLORS,
  TEXT_SIZES,
  autoFrames,
  blockId,
  clampFrame,
  emptyBlock,
  type Frame,
  type PageLayout,
  type PlaybookPage,
  type ShapeKind,
  type SlideBlock,
} from '@/lib/playbook'
import { withTeam } from '@/lib/teams'

interface Shot {
  id: string
  title: string
  url: string
}

/**
 * A page of the playbook, being made.
 *
 * The page is the editor: you move things on the page itself rather than
 * describing them in a form and hoping. Whatever is selected gets its own
 * controls underneath — the play it shows, the words it says, its colour, its
 * size — and everything else stays out of the way.
 */
export function PageEditor({
  page,
  plays,
  shots,
}: {
  page: PlaybookPage
  plays: SlidePlay[]
  shots: Shot[]
}) {
  const [title, setTitle] = useState(page.title)
  const [layout, setLayout] = useState<PageLayout>(page.layout)
  const [notes, setNotes] = useState(page.notes ?? '')
  const [blocks, setBlocks] = useState<SlideBlock[]>(() => autoFrames(page.blocks, page.layout))
  const [selected, setSelected] = useState<string | null>(null)

  const playMap = Object.fromEntries(plays.map((p) => [p.id, p]))
  const back = withTeam('/admin/playbook', page.team)
  const active = blocks.find((b) => b.id === selected) ?? null

  /* Touching anything is a decision to place this page by hand. A page laid
     out for you that you then rearrange is a page you rearranged. */
  const takeOver = () => setLayout('free')

  function patch(id: string, next: Partial<SlideBlock>) {
    setBlocks((bs) => bs.map((b) => (b.id === id ? ({ ...b, ...next } as SlideBlock) : b)))
  }
  function setFrame(id: string, frame: Frame) {
    takeOver()
    setBlocks((bs) => bs.map((b) => (b.id === id ? { ...b, frame } : b)))
  }
  function drop(id: string) {
    setBlocks((bs) => bs.filter((b) => b.id !== id))
    setSelected(null)
  }
  function duplicate(id: string) {
    setBlocks((bs) => {
      const b = bs.find((x) => x.id === id)
      if (!b?.frame) return bs
      const copy = { ...b, id: blockId(), frame: clampFrame({ ...b.frame, x: b.frame.x + 20, y: b.frame.y + 20 }) }
      return [...bs, copy as SlideBlock]
    })
  }
  function add(kind: SlideBlock['kind']) {
    takeOver()
    const b = emptyBlock(kind)
    setBlocks((bs) => [...bs, { ...b, z: bs.length }])
    setSelected(b.id)
  }
  function lift(id: string, to: 'front' | 'back') {
    setBlocks((bs) => {
      const zs = bs.map((b, i) => b.z ?? i)
      const edge = to === 'front' ? Math.max(...zs) + 1 : Math.min(...zs) - 1
      return bs.map((b, i) => (b.id === id ? { ...b, z: edge } : { ...b, z: b.z ?? i }))
    })
  }

  return (
    <div>
      <Link href={back} className="text-sm font-bold text-[var(--gh-green)]">← The deck</Link>

      <div className="flex items-center gap-2 mt-2 mb-3 flex-wrap">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Page title"
          className="field !py-1.5 max-w-sm font-bold"
        />
        <select
          value={layout}
          onChange={(e) => setLayout(e.target.value as PageLayout)}
          className="field !py-1.5 !w-auto text-sm"
          aria-label="How the page is laid out"
        >
          {PAGE_LAYOUTS.map((l) => (
            <option key={l.key} value={l.key}>{l.label}</option>
          ))}
        </select>
        <span className="text-xs text-gray-400 hidden sm:inline">
          {PAGE_LAYOUTS.find((l) => l.key === layout)?.hint}
        </span>
      </div>

      {/* ── Insert ── */}
      <div className="flex gap-1.5 flex-wrap mb-3">
        {BLOCK_KINDS.map((k) => (
          <button key={k.kind} type="button" onClick={() => add(k.kind)} className="btn btn-ghost !py-1.5 text-sm">
            <span aria-hidden className="mr-1">{k.icon}</span> {k.label}
          </button>
        ))}
      </div>

      <SlideCanvas
        blocks={blocks}
        plays={playMap}
        title={title}
        selected={selected}
        onSelect={setSelected}
        onChange={setFrame}
        onDelete={drop}
        onDuplicate={duplicate}
      />

      <p className="text-xs text-gray-400 mt-2">
        Drag to move, pull a handle to resize. Arrow keys nudge (hold Shift for ten), Alt turns the
        grid off, Delete removes, Escape lets go.
      </p>

      {/* ── Whatever is selected ── */}
      {active ? (
        <div className="card p-4 mt-3 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-black uppercase tracking-wider text-gray-400">
              {BLOCK_KINDS.find((k) => k.kind === active.kind)?.label}
            </span>
            <span className="ml-auto flex items-center gap-2">
              <button type="button" onClick={() => lift(active.id, 'front')} className="text-xs font-bold text-gray-500 hover:text-gray-800">Bring to front</button>
              <button type="button" onClick={() => lift(active.id, 'back')} className="text-xs font-bold text-gray-500 hover:text-gray-800">Send to back</button>
              <button type="button" onClick={() => duplicate(active.id)} className="text-xs font-bold text-gray-500 hover:text-gray-800">Duplicate</button>
              <button type="button" onClick={() => drop(active.id)} className="text-xs font-bold text-red-600 hover:text-red-800">Remove</button>
            </span>
          </div>

          {active.kind === 'play' && (
            <div className="grid sm:grid-cols-2 gap-2">
              <select value={active.playId} onChange={(e) => patch(active.id, { playId: e.target.value })} className="field">
                <option value="">— pick a play —</option>
                {plays.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <input value={active.caption ?? ''} onChange={(e) => patch(active.id, { caption: e.target.value })}
                placeholder="Caption (the play's name otherwise)" className="field" />
            </div>
          )}

          {active.kind === 'shot' && (
            <div className="grid sm:grid-cols-2 gap-2">
              <select value={active.url} onChange={(e) => patch(active.id, { url: e.target.value })} className="field">
                <option value="">— pick a picture —</option>
                {shots.map((s) => <option key={s.id} value={s.url}>{s.title || 'Untitled'}</option>)}
              </select>
              <input value={active.caption ?? ''} onChange={(e) => patch(active.id, { caption: e.target.value })}
                placeholder="Caption" className="field" />
            </div>
          )}

          {active.kind === 'text' && (
            <>
              <textarea value={active.body} onChange={(e) => patch(active.id, { body: e.target.value })} rows={3}
                placeholder="What you want them to know…" className="field" />
              <div className="flex items-end gap-2 flex-wrap">
                <select value={active.size} onChange={(e) => patch(active.id, { size: e.target.value as 'heading' | 'body' | 'small', pt: undefined })}
                  className="field !py-1.5 !w-auto text-sm">
                  {TEXT_SIZES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                </select>
                <button type="button" onClick={() => patch(active.id, { bold: !active.bold })}
                  className={`btn !py-1.5 text-sm ${active.bold ? 'btn-primary' : 'btn-ghost'}`}><b>B</b></button>
                <button type="button" onClick={() => patch(active.id, { italic: !active.italic })}
                  className={`btn !py-1.5 text-sm ${active.italic ? 'btn-primary' : 'btn-ghost'}`}><i>I</i></button>
                {(['left', 'center', 'right'] as const).map((a) => (
                  <button key={a} type="button" onClick={() => patch(active.id, { align: a })}
                    className={`btn !py-1.5 text-sm ${(active.align ?? 'left') === a ? 'btn-primary' : 'btn-ghost'}`}>
                    {a === 'left' ? '⬅' : a === 'center' ? '↔' : '➡'}
                  </button>
                ))}
                <Swatches value={active.color ?? '#111111'} onPick={(c) => patch(active.id, { color: c })} label="Ink" />
                <Swatches value={active.fill ?? ''} onPick={(c) => patch(active.id, { fill: c })} label="Panel" clearable />
              </div>
            </>
          )}

          {active.kind === 'list' && (
            <>
              <input value={active.heading ?? ''} onChange={(e) => patch(active.id, { heading: e.target.value })}
                placeholder="Reads · Coaching points · If they slide early" className="field" />
              <textarea value={active.items.join('\n')} onChange={(e) => patch(active.id, { items: e.target.value.split('\n') })}
                rows={4} placeholder="One point per line" className="field" />
              <div className="flex items-end gap-2 flex-wrap">
                <Swatches value={active.color ?? '#374151'} onPick={(c) => patch(active.id, { color: c })} label="Ink" />
                <Swatches value={active.fill ?? ''} onPick={(c) => patch(active.id, { fill: c })} label="Panel" clearable />
              </div>
            </>
          )}

          {active.kind === 'shape' && (
            <div className="flex items-end gap-2 flex-wrap">
              <select value={active.shape} onChange={(e) => patch(active.id, { shape: e.target.value as ShapeKind })}
                className="field !py-1.5 !w-auto text-sm">
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
      ) : (
        <p className="text-xs text-gray-400 mt-3">
          Tap something on the page to change it, or put something new on with the buttons above.
        </p>
      )}

      {/* ── Save ── */}
      <form action={savePlaybookPage} className="card p-4 mt-3 space-y-3">
        <input type="hidden" name="id" value={page.id} />
        <input type="hidden" name="team" value={page.team} />
        <input type="hidden" name="title" value={title} />
        <input type="hidden" name="layout" value={layout} />
        <input type="hidden" name="blocks" value={JSON.stringify(blocks)} />
        <div>
          <label className="field-label">What you say while it&rsquo;s up</label>
          <textarea name="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
            placeholder="Yours alone — never shown to players." className="field" />
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <button type="submit" className="btn btn-primary">Save page</button>
          <Link href={back} className="btn btn-ghost">Cancel</Link>
        </div>
      </form>

      <form action={deletePlaybookPage} className="mt-3 flex justify-end">
        <input type="hidden" name="id" value={page.id} />
        <input type="hidden" name="team" value={page.team} />
        <button type="submit" className="text-xs font-bold text-red-600 hover:text-red-800">Delete this page</button>
      </form>
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
      <div className="flex gap-1">
        {clearable && (
          <button type="button" onClick={() => onPick('')} title="None"
            className="w-6 h-6 rounded border border-gray-200 text-[0.6rem] text-gray-400"
            style={{ outline: value === '' ? '2px solid var(--gh-green)' : undefined, outlineOffset: 1 }}>
            —
          </button>
        )}
        {SLIDE_COLORS.map((c) => (
          <button key={c} type="button" onClick={() => onPick(c)} title={c}
            className="w-6 h-6 rounded border border-gray-200"
            style={{ background: c, outline: value.toLowerCase() === c ? '2px solid var(--gh-green)' : undefined, outlineOffset: 1 }} />
        ))}
      </div>
    </div>
  )
}
