'use client'
import Link from 'next/link'
import { useState } from 'react'
import { SlideView, type SlidePlay } from '@/components/playbook/SlideView'
import { deletePlaybookPage, savePlaybookPage } from '@/lib/playbookActions'
import {
  BLOCK_KINDS,
  PAGE_LAYOUTS,
  TEXT_SIZES,
  emptyBlock,
  type PageLayout,
  type PlaybookPage,
  type SlideBlock,
} from '@/lib/playbook'
import { withTeam } from '@/lib/teams'

interface Shot {
  id: string
  title: string
  url: string
}

/**
 * One page of the playbook, being written.
 *
 * The page is built out of blocks — a play, a picture, words, a list of points
 * — and what you are looking at while you do it is the page itself, not a form
 * that claims to describe one. Move a block, and the preview moves.
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
  const [blocks, setBlocks] = useState<SlideBlock[]>(page.blocks)

  const playMap = Object.fromEntries(plays.map((p) => [p.id, p]))
  const back = withTeam('/admin/playbook', page.team)

  function patch(id: string, next: Partial<SlideBlock>) {
    setBlocks((bs) => bs.map((b) => (b.id === id ? ({ ...b, ...next } as SlideBlock) : b)))
  }
  function drop(id: string) {
    setBlocks((bs) => bs.filter((b) => b.id !== id))
  }
  function move(id: string, by: number) {
    setBlocks((bs) => {
      const from = bs.findIndex((b) => b.id === id)
      const to = from + by
      if (from < 0 || to < 0 || to >= bs.length) return bs
      const next = [...bs]
      next.splice(to, 0, next.splice(from, 1)[0])
      return next
    })
  }

  const preview: PlaybookPage = { ...page, title, layout, blocks }

  return (
    <div>
      <Link href={back} className="text-sm font-bold text-[var(--gh-green)]">← The deck</Link>

      <div className="grid lg:grid-cols-[1fr_1.1fr] gap-6 items-start mt-2">
        {/* ── What is on the page ── */}
        <form action={savePlaybookPage} className="space-y-4 order-2 lg:order-1">
          <input type="hidden" name="id" value={page.id} />
          <input type="hidden" name="team" value={page.team} />
          <input type="hidden" name="blocks" value={JSON.stringify(blocks)} />
          <input type="hidden" name="layout" value={layout} />

          <div className="card p-4 space-y-3">
            <div>
              <label className="field-label">Page title</label>
              <input
                name="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="2-3-1 — the first look"
                className="field"
              />
              <p className="text-xs text-gray-400 mt-1">
                A page with a title and nothing else is a divider — the title, big, in the middle.
              </p>
            </div>
            <div>
              <label className="field-label">How it sits</label>
              <select
                value={layout}
                onChange={(e) => setLayout(e.target.value as PageLayout)}
                className="field max-w-xs"
              >
                {PAGE_LAYOUTS.map((l) => (
                  <option key={l.key} value={l.key}>{l.label}</option>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-1">
                {PAGE_LAYOUTS.find((l) => l.key === layout)?.hint}
              </p>
            </div>
          </div>

          {blocks.map((b, i) => (
            <div key={b.id} className="card p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-black uppercase tracking-wider text-gray-400">
                  {BLOCK_KINDS.find((k) => k.kind === b.kind)?.label ?? b.kind}
                </span>
                <span className="ml-auto flex items-center gap-1">
                  <button type="button" onClick={() => move(b.id, -1)} disabled={i === 0}
                    className="px-1.5 text-sm text-gray-400 hover:text-gray-700 disabled:opacity-30" aria-label="Move up">↑</button>
                  <button type="button" onClick={() => move(b.id, 1)} disabled={i === blocks.length - 1}
                    className="px-1.5 text-sm text-gray-400 hover:text-gray-700 disabled:opacity-30" aria-label="Move down">↓</button>
                  <button type="button" onClick={() => drop(b.id)}
                    className="px-1.5 text-xs font-bold text-red-600 hover:text-red-800" aria-label="Take this off">Remove</button>
                </span>
              </div>

              {b.kind === 'play' && (
                <div className="space-y-2">
                  <select value={b.playId} onChange={(e) => patch(b.id, { playId: e.target.value })} className="field">
                    <option value="">— pick a play —</option>
                    {plays.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <input
                    value={b.caption ?? ''}
                    onChange={(e) => patch(b.id, { caption: e.target.value })}
                    placeholder="Caption (optional — the play's name is used otherwise)"
                    className="field"
                  />
                  {plays.length === 0 && (
                    <p className="text-xs text-amber-700">
                      No saved plays yet. Draw one on the playboard and save it first.
                    </p>
                  )}
                </div>
              )}

              {b.kind === 'shot' && (
                <div className="space-y-2">
                  <select value={b.url} onChange={(e) => patch(b.id, { url: e.target.value })} className="field">
                    <option value="">— pick a picture —</option>
                    {shots.map((s) => <option key={s.id} value={s.url}>{s.title || 'Untitled'}</option>)}
                  </select>
                  <input
                    value={b.caption ?? ''}
                    onChange={(e) => patch(b.id, { caption: e.target.value })}
                    placeholder="Caption (optional)"
                    className="field"
                  />
                </div>
              )}

              {b.kind === 'text' && (
                <div className="space-y-2">
                  <select value={b.size} onChange={(e) => patch(b.id, { size: e.target.value as 'heading' | 'body' | 'small' })} className="field max-w-[10rem]">
                    {TEXT_SIZES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                  </select>
                  <textarea
                    value={b.body}
                    onChange={(e) => patch(b.id, { body: e.target.value })}
                    rows={3}
                    placeholder="What you want them to know…"
                    className="field"
                  />
                </div>
              )}

              {b.kind === 'list' && (
                <div className="space-y-2">
                  <input
                    value={b.heading ?? ''}
                    onChange={(e) => patch(b.id, { heading: e.target.value })}
                    placeholder="Reads · Coaching points · If they slide early"
                    className="field"
                  />
                  <textarea
                    value={b.items.join('\n')}
                    onChange={(e) => patch(b.id, { items: e.target.value.split('\n') })}
                    rows={4}
                    placeholder={'One point per line'}
                    className="field"
                  />
                  <p className="text-xs text-gray-400">One point per line.</p>
                </div>
              )}
            </div>
          ))}

          <div className="card p-4">
            <div className="section-label mb-2">Put something on the page</div>
            <div className="flex gap-2 flex-wrap">
              {BLOCK_KINDS.map((k) => (
                <button
                  key={k.kind}
                  type="button"
                  onClick={() => setBlocks((bs) => [...bs, emptyBlock(k.kind)])}
                  className="btn btn-ghost text-sm"
                >
                  <span aria-hidden className="mr-1">{k.icon}</span> {k.label}
                </button>
              ))}
            </div>
          </div>

          <div className="card p-4">
            <label className="field-label">What you say while it&rsquo;s up</label>
            <textarea
              name="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Yours alone — never shown to players."
              className="field"
            />
          </div>

          <div className="flex gap-2 flex-wrap items-center">
            <button type="submit" className="btn btn-primary">Save page</button>
            <Link href={back} className="btn btn-ghost">Cancel</Link>
          </div>
        </form>

        {/* ── The page itself ── */}
        <div className="order-1 lg:order-2 lg:sticky lg:top-4">
          <div className="section-label mb-2">The page</div>
          <div className="card p-5 bg-white overflow-hidden" style={{ aspectRatio: '4 / 3' }}>
            <SlideView page={preview} plays={playMap} />
          </div>
          <form action={deletePlaybookPage} className="mt-3 flex justify-end">
            <input type="hidden" name="id" value={page.id} />
            <input type="hidden" name="team" value={page.team} />
            <button type="submit" className="text-xs font-bold text-red-600 hover:text-red-800">
              Delete this page
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
