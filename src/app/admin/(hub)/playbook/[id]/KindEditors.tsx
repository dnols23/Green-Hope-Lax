'use client'
import dynamic from 'next/dynamic'
import { useRef, useState, useTransition } from 'react'
import { FieldPageView, PicturePageView, WordsPageView } from '@/components/playbook/KindPages'
import type { SlidePlay } from '@/components/playbook/BlockArt'
import { blockId, firstOf, type PlaybookPage, type SlideBlock } from '@/lib/playbook'
import { EMPTY_BOARD, type Board, type BoardHalf, type BoardTurn } from '@/lib/planner'
import { savePlayAction } from '@/lib/actions'
import { driveImageUrl, shrinkImage, uploadImage } from '@/lib/uploadImage'

/* The real board, every tool on it — only fetched once someone opens it. */
const FieldBoard = dynamic(
  () => import('@/components/planner/FieldBoard').then((m) => m.FieldBoard),
  { ssr: false },
)

type SetBlocks = (update: (bs: SlideBlock[]) => SlideBlock[]) => void

// ── Field ────────────────────────────────────────────────────────────────────

/**
 * A field page, being made.
 *
 * The page is the field, so there is nothing to arrange: tap it and it opens
 * full screen with every tool, for drawing the play and writing on it. Which
 * end, and which way up, are right here too — and whatever is picked is what
 * the page shows, because the view is saved with the field.
 */
export function FieldEditor({
  page,
  plays,
  blocks,
  setBlocks,
  title,
}: {
  page: PlaybookPage
  plays: SlidePlay[]
  blocks: SlideBlock[]
  setBlocks: SetBlocks
  title: string
}) {
  const [editing, setEditing] = useState(false)
  const [shelfName, setShelfName] = useState('')
  const [shelving, setShelving] = useState(false)
  const [saved, setSaved] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const playMap = Object.fromEntries(plays.map((p) => [p.id, p]))
  const field = firstOf(blocks, 'play')
  const borrowed = field && !field.board ? playMap[field.playId] ?? null : null
  const board: Board = field?.board ?? borrowed?.board ?? EMPTY_BOARD
  const half: BoardHalf = board.view?.half ?? 'off'
  const turn: BoardTurn = board.view?.turn ?? 0

  /* Any change makes the field the page's own. A page borrowing a saved play
     keeps pointing at it (playId) so it can be traced back, but draws its own
     copy from here on — the saved play the rest of the staff uses is untouched. */
  function setBoard(next: Board) {
    setBlocks((bs) => {
      const at = bs.findIndex((b) => b.kind === 'play')
      if (at < 0) return [{ kind: 'play', id: blockId(), playId: '', board: next }, ...bs]
      return bs.map((b, i) => (i === at && b.kind === 'play' ? { ...b, board: next } : b))
    })
  }

  function setView(next: { half?: BoardHalf; turn?: BoardTurn }) {
    const h = next.half ?? half
    const t = next.turn ?? turn
    setBoard({
      ...board,
      view: h === 'off' && t === 0 ? undefined : { ...(h !== 'off' ? { half: h } : {}), ...(t ? { turn: t } : {}) },
    })
  }

  function startFrom(playId: string) {
    const play = playMap[playId]
    if (!play) return
    const hasDrawing = board.tokens.length + board.paths.length + (board.texts?.length ?? 0) > 0
    if (hasDrawing && !window.confirm(`Replace what is on this field with “${play.name}”?`)) return
    setBlocks((bs) => {
      const rest = bs.filter((b) => b.kind !== 'play')
      return [{ kind: 'play', id: blockId(), playId, board: play.board }, ...rest]
    })
  }

  function shelve() {
    const name = shelfName.trim()
    if (!name) return
    const data = new FormData()
    data.set('name', name)
    data.set('board', JSON.stringify(board))
    start(async () => {
      await savePlayAction(data)
      setShelving(false)
      setShelfName('')
      setSaved(name)
    })
  }

  const seg = (on: boolean) => `px-3 py-1.5 text-sm font-bold rounded-md ${on ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`

  return (
    <div className="space-y-3">
      {/* The page itself. A tap opens it for drawing. */}
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="relative block w-full text-left rounded-lg ring-offset-2 focus-visible:ring-2 focus-visible:ring-[var(--gh-green)]"
        aria-label="Draw on the field, full screen"
      >
        <FieldPageView page={page} plays={playMap} zoomable={false} />
        <span className="absolute bottom-2 right-2 rounded-full bg-black/60 text-white text-xs font-bold px-3 py-1.5 pointer-events-none">
          ✏️ Tap to draw — full screen
        </span>
      </button>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setEditing(true)} className="btn btn-primary !py-2 text-sm">
          ✏️ Draw on it
        </button>
        <div className="inline-flex rounded-lg bg-gray-100 p-0.5" role="radiogroup" aria-label="How much of the field">
          {(['off', 'right', 'left'] as BoardHalf[]).map((h) => (
            <button key={h} type="button" role="radio" aria-checked={half === h} onClick={() => setView({ half: h })} className={seg(half === h)}>
              {h === 'off' ? 'Full field' : h === 'right' ? 'Right end' : 'Left end'}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setView({ turn: ((turn + 90) % 360) as BoardTurn })}
          className={`btn !py-2 text-sm ${turn ? 'btn-primary' : 'btn-ghost'}`}
          title="Turn the field a quarter turn"
        >
          ⟳ Turn{turn ? ` ${turn}°` : ''}
        </button>
      </div>

      {borrowed && (
        <p className="text-xs text-gray-500">
          This page shows the saved play <b>{borrowed.name}</b>. Drawing on it makes the page its own copy — the saved
          play the staff uses doesn&rsquo;t change.
        </p>
      )}

      <div className="card p-3 space-y-2">
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-0 flex-1 basis-56">
          <label className="field-label" htmlFor="start-from">Start from a saved play</label>
          <select
            id="start-from"
            value=""
            onChange={(e) => startFrom(e.target.value)}
            className="field !py-1.5 text-sm"
          >
            <option value="">— pick one —</option>
            {plays.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          </div>
          <button type="button" onClick={() => setShelving((v) => !v)} className="text-xs font-bold text-[var(--gh-green)] hover:underline ml-auto">
            Put it in the Library too →
          </button>
        </div>
        {shelving && (
          <div className="flex items-end gap-2 flex-wrap">
            <div className="flex-1 min-w-[10rem]">
              <label className="field-label" htmlFor="shelf-name">Save it to the Library as</label>
              <input id="shelf-name" value={shelfName} onChange={(e) => setShelfName(e.target.value)} placeholder="1-4-1 pop" className="field !py-1.5" />
            </div>
            <button type="button" disabled={!shelfName.trim() || pending} onClick={shelve} className="btn btn-primary !py-1.5 text-sm disabled:opacity-50">
              {pending ? 'Saving…' : 'Save'}
            </button>
          </div>
        )}
        {saved && <p className="text-xs font-semibold text-[var(--gh-green)]">Saved to the Library as {saved}.</p>}
      </div>

      {editing && (
        <FieldBoard board={board} onChange={setBoard} startFull onLeaveFull={() => setEditing(false)} title={title || 'The field'} />
      )}
    </div>
  )
}

// ── Words ────────────────────────────────────────────────────────────────────

/** A title and the words under it. The page title above is the heading. */
export function WordsEditor({ page, blocks, setBlocks }: { page: PlaybookPage; blocks: SlideBlock[]; setBlocks: SetBlocks }) {
  const text = firstOf(blocks, 'text')
  const list = firstOf(blocks, 'list')

  function setBody(body: string) {
    setBlocks((bs) =>
      firstOf(bs, 'text')
        ? bs.map((b) => (b.kind === 'text' && b.id === firstOf(bs, 'text')!.id ? { ...b, body } : b))
        : [...bs, { kind: 'text', id: blockId(), body, size: 'body' }],
    )
  }
  function setItems(raw: string) {
    const items = raw.split('\n')
    setBlocks((bs) => {
      const found = firstOf(bs, 'list')
      if (found) return bs.map((b) => (b.id === found.id && b.kind === 'list' ? { ...b, items } : b))
      return [...bs, { kind: 'list', id: blockId(), items }]
    })
  }

  return (
    <div className="space-y-3">
      <WordsPageView page={page} />
      <div>
        <label className="field-label" htmlFor="words-body">What you want to say</label>
        <textarea
          id="words-body"
          value={text?.body ?? ''}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          placeholder="Leave it empty for a section divider — just the title, big."
          className="field"
        />
      </div>
      <div>
        <label className="field-label" htmlFor="words-list">Points <span className="font-normal text-gray-400">(one per line, optional)</span></label>
        <textarea
          id="words-list"
          value={list?.items.join('\n') ?? ''}
          onChange={(e) => setItems(e.target.value)}
          rows={3}
          placeholder={'Slide early\nAdjacent fills\nTalk on every pass'}
          className="field"
        />
      </div>
    </div>
  )
}

// ── Picture ──────────────────────────────────────────────────────────────────

/**
 * A photo, the whole page.
 *
 * From the phone's photos or camera, a file on the computer, or Google Drive —
 * on an iPhone "Choose File" opens Files, where Drive sits; on Android the
 * picker lists Drive itself. A Drive share link can be pasted too.
 */
export function PictureEditor({
  page,
  shots,
  blocks,
  setBlocks,
}: {
  page: PlaybookPage
  shots: { id: string; title: string; url: string }[]
  blocks: SlideBlock[]
  setBlocks: SetBlocks
}) {
  const shot = firstOf(blocks, 'shot')
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [link, setLink] = useState('')

  function setShot(next: { url?: string; caption?: string }) {
    setBlocks((bs) => {
      const found = firstOf(bs, 'shot')
      if (found) return bs.map((b) => (b.id === found.id && b.kind === 'shot' ? { ...b, ...next } : b))
      return [...bs, { kind: 'shot', id: blockId(), url: next.url ?? '', caption: next.caption }]
    })
  }

  async function onFile(file: File | undefined) {
    if (!file) return
    setError(null)
    setBusy(true)
    const small = await shrinkImage(file)
    const res = await uploadImage(small, 'playbook', file.name.replace(/\.[^.]+$/, '') + (small.type === 'image/png' ? '.png' : '.jpg'))
    setBusy(false)
    if (res.url) setShot({ url: res.url })
    else setError(res.error ?? 'That picture would not save.')
    if (input.current) input.current.value = ''
  }

  function useLink() {
    const url = driveImageUrl(link)
    if (!/^https?:\/\//i.test(url)) {
      setError('That doesn’t look like a link.')
      return
    }
    setError(null)
    setShot({ url })
    setLink('')
  }

  return (
    <div className="space-y-3">
      <PicturePageView page={page} />

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => input.current?.click()} disabled={busy} className="btn btn-primary !py-2 text-sm disabled:opacity-60">
          {busy ? 'Uploading…' : shot?.url ? '📷 Change the photo' : '📷 Add a photo'}
        </button>
        <input
          ref={input}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => onFile(e.target.files?.[0])}
        />
        {shots.length > 0 && (
          <select
            value=""
            onChange={(e) => e.target.value && setShot({ url: e.target.value })}
            className="field !py-1.5 !w-auto text-sm"
            aria-label="Pick a picture from the Library"
          >
            <option value="">From the Library…</option>
            {shots.map((s) => (
              <option key={s.id} value={s.url}>{s.title || 'Untitled'}</option>
            ))}
          </select>
        )}
      </div>
      <p className="text-xs text-gray-500">
        From your phone&rsquo;s photos or camera, a file on your computer, or Google Drive — on an iPhone tap
        &ldquo;Choose File&rdquo; and Drive is in Files.
      </p>

      <div className="flex gap-2">
        <input
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="Or paste a link — a Google Drive share link works"
          aria-label="Picture link"
          className="field !py-1.5 text-sm flex-1 min-w-0"
        />
        <button type="button" onClick={useLink} disabled={!link.trim()} className="btn btn-ghost !py-1.5 text-sm disabled:opacity-50">
          Use it
        </button>
      </div>
      <p className="text-xs text-gray-400">
        A Drive link shows only if the file is shared as &ldquo;Anyone with the link&rdquo;. Uploading it is surer.
      </p>

      <input
        value={shot?.caption ?? ''}
        onChange={(e) => setShot({ caption: e.target.value })}
        placeholder="Caption (optional)"
        aria-label="Caption"
        className="field"
      />
      {error && <p className="text-sm font-semibold text-[var(--gh-maroon)]" role="alert">{error}</p>}
    </div>
  )
}
