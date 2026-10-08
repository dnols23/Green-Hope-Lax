'use client'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useRef, useState, useTransition } from 'react'
import { FieldPageView, PicturePageView, WordsPageView } from '@/components/playbook/KindPages'
import type { SlidePlay } from '@/components/playbook/BlockArt'
import { blockId, firstOf, type PlaybookPage, type SlideBlock } from '@/lib/playbook'
import { EMPTY_BOARD, boardItemCount, type Board, type BoardHalf, type BoardTurn } from '@/lib/planner'
import { savePlayAction } from '@/lib/actions'
import { driveImageUrl, shrinkImage, uploadImage } from '@/lib/uploadImage'

/* The real board, every tool on it — only fetched once someone opens it. */
const FieldBoard = dynamic(
  () => import('@/components/planner/FieldBoard').then((m) => m.FieldBoard),
  { ssr: false },
)

export type SetBlocks = (update: (bs: SlideBlock[]) => SlideBlock[]) => void

/** Off to the Playboard, with the queued saves written first and a way back. */
export interface ToPlayboard {
  href: (playId: string) => string
  go: (href: string) => void
}

export function EditInPlayboard({ playId, to, primary = true }: { playId: string; to: ToPlayboard; primary?: boolean }) {
  const href = to.href(playId)
  return (
    <Link
      href={href}
      onClick={(e) => {
        e.preventDefault()
        to.go(href)
      }}
      className={`btn ${primary ? 'btn-primary' : 'btn-ghost'} !py-2 text-sm`}
    >
      Edit in Playboard <span aria-hidden className="ml-1">→</span>
    </Link>
  )
}

/**
 * A step page drawn on directly stops being a step. Its copy is the page's own
 * from then on — the Playboard's Update no longer reaches it — so it lets go of
 * the play entirely rather than risk being written over as "step 1" later.
 */
export function detachStep(bs: SlideBlock[]): SlideBlock[] {
  return bs.map((b) => {
    if (b.kind !== 'play' || b.step === undefined) return b
    const { step: _step, ...rest } = b
    return { ...rest, playId: '' }
  })
}

export function confirmDetach(name: string): boolean {
  return window.confirm(
    `This page is a step of “${name}”, and its steps are drawn on the Playboard.\n\n` +
      'Draw here and it becomes this page’s own drawing — it leaves the progression, and Update on the Playboard won’t change it any more.\n\nDraw here anyway?',
  )
}

/** A play's own board, put on the Library shelf as well. The page keeps its copy. */
function useShelve(board: Board) {
  const [name, setName] = useState('')
  const [saved, setSaved] = useState<string | null>(null)
  const [pending, start] = useTransition()
  function shelve() {
    const n = name.trim()
    if (!n) return
    const data = new FormData()
    data.set('name', n)
    data.set('board', JSON.stringify(board))
    start(async () => {
      await savePlayAction(data)
      setName('')
      setSaved(n)
    })
  }
  return { name, setName, saved, pending, shelve }
}

export function ShelveForm({ board }: { board: Board }) {
  const s = useShelve(board)
  return (
    <div className="space-y-1.5">
      <div className="flex items-end gap-2 flex-wrap">
        <div className="flex-1 min-w-[10rem]">
          <label className="field-label" htmlFor="shelf-name">Put it in the Library as</label>
          <input id="shelf-name" value={s.name} onChange={(e) => s.setName(e.target.value)} placeholder="1-4-1 pop" className="field !py-1.5" />
        </div>
        <button type="button" disabled={!s.name.trim() || s.pending} onClick={s.shelve} className="btn btn-primary !py-1.5 text-sm disabled:opacity-50">
          {s.pending ? 'Saving…' : 'Save'}
        </button>
      </div>
      {s.saved && <p className="text-xs font-semibold text-[var(--gh-green)]">In the Library as {s.saved}. This page keeps its own copy.</p>}
    </div>
  )
}

// ── Field ────────────────────────────────────────────────────────────────────

/**
 * A field page, being made.
 *
 * The page is the field, so there is nothing to arrange: tap it and it opens
 * full screen with every tool. What else shows depends on where the field
 * comes from — a step of a progression is edited on the Playboard, a borrowed
 * play is edited on the Playboard or copied here, and the page's own field is
 * drawn here, with which end and which way up beside it.
 */
export function FieldEditor({
  page,
  plays,
  blocks,
  setBlocks,
  title,
  onDrawing,
  to,
}: {
  page: PlaybookPage
  plays: SlidePlay[]
  blocks: SlideBlock[]
  setBlocks: SetBlocks
  title: string
  onDrawing: (on: boolean) => void
  to: ToPlayboard
}) {
  const [editing, setEditingState] = useState(false)
  const [more, setMore] = useState(false)

  const playMap = Object.fromEntries(plays.map((p) => [p.id, p]))
  const field = firstOf(blocks, 'play')
  const saved = field?.playId ? playMap[field.playId] ?? null : null
  const isStep = !!field?.playId && field.step !== undefined
  const borrowed = field && !field.board ? saved : null
  // A copy taken off the shelf: its own board, still knowing where it came from.
  const copied = !isStep && !!field?.board && !!saved
  const board: Board = field?.board ?? borrowed?.board ?? EMPTY_BOARD
  const half: BoardHalf = board.view?.half ?? 'off'
  const turn: BoardTurn = board.view?.turn ?? 0

  function draw(on: boolean) {
    setEditingState(on)
    onDrawing(on)
  }

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
    // Already showing exactly that play: nothing to replace, so nothing to ask.
    if (JSON.stringify(board) === JSON.stringify(play.board)) return
    const hasDrawing = boardItemCount(board) > 0
    if (hasDrawing && !window.confirm(`Replace what is on this field with “${play.name}”?`)) return
    setBlocks((bs) => {
      const rest = bs.filter((b) => b.kind !== 'play')
      return [{ kind: 'play', id: blockId(), playId, board: play.board }, ...rest]
    })
  }

  /** The tap on the page: draw — after a word of warning on a step page. */
  function open() {
    if (isStep) {
      if (!confirmDetach(saved?.name ?? page.title)) return
      setBlocks(detachStep)
    }
    draw(true)
  }

  const seg = (on: boolean) => `px-2.5 py-1.5 text-sm font-bold rounded-md ${on ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`

  return (
    <div className="space-y-3">
      {/* The page itself. A tap opens it for drawing. */}
      <button
        type="button"
        onClick={open}
        className="group relative block w-full text-left rounded-lg ring-offset-2 focus-visible:ring-2 focus-visible:ring-[var(--gh-green)]"
        aria-label={isStep ? 'Draw on this step here' : 'Draw on the field, full screen'}
      >
        <FieldPageView page={page} plays={playMap} zoomable={false} />
        {!isStep && (
          <span className="absolute bottom-2 right-2 rounded-full bg-black/55 text-white text-xs font-bold px-3 py-1.5 pointer-events-none opacity-80 group-hover:opacity-100">
            ✏️ {borrowed ? 'Draw a copy here' : 'Tap to draw'}
          </span>
        )}
      </button>

      <div className="flex flex-wrap items-center gap-2">
        {isStep ? (
          <>
            {saved && <EditInPlayboard playId={saved.id} to={to} />}
            <button type="button" onClick={open} className="text-xs font-bold text-gray-500 hover:text-gray-800 px-1">
              Draw here instead…
            </button>
          </>
        ) : borrowed ? (
          <>
            <EditInPlayboard playId={borrowed.id} to={to} />
            <button type="button" onClick={() => draw(true)} className="btn btn-ghost !py-2 text-sm">
              ✏️ Draw a copy here
            </button>
          </>
        ) : (
          <>
            <button type="button" onClick={() => draw(true)} className="btn btn-primary !py-2 text-sm">
              ✏️ Draw
            </button>
            <div className="inline-flex rounded-lg bg-gray-100 p-0.5" role="radiogroup" aria-label="How much of the field">
              {(['off', 'right', 'left'] as BoardHalf[]).map((h) => (
                <button key={h} type="button" role="radio" aria-checked={half === h} onClick={() => setView({ half: h })} className={seg(half === h)}>
                  {h === 'off' ? 'Full' : h === 'right' ? 'Right end' : 'Left end'}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setView({ turn: ((turn + 90) % 360) as BoardTurn })}
              className={`btn !py-2 text-sm ${turn ? 'btn-primary' : 'btn-ghost'}`}
              title="Turn the field a quarter turn"
              aria-label="Turn the field a quarter turn"
            >
              ⟳{turn ? ` ${turn}°` : ''}
            </button>
          </>
        )}
        {!isStep && (
          <button
            type="button"
            onClick={() => setMore((v) => !v)}
            aria-expanded={more}
            className="ml-auto text-xs font-bold text-gray-500 hover:text-gray-800 px-1"
          >
            {more ? 'Less' : 'More…'}
          </button>
        )}
      </div>

      {borrowed && (
        <p className="text-xs text-gray-500">
          Shows the saved play <b>{borrowed.name}</b> — change it on the Playboard and this page follows. Drawing here
          makes this page its own copy instead.
        </p>
      )}
      {copied && saved && (
        <p className="text-xs text-gray-500">
          This page&rsquo;s own copy of <b>{saved.name}</b>.{' '}
          <button type="button" onClick={() => setBlocks((bs) => bs.map((b) => (b.id === field!.id && b.kind === 'play' ? { ...b, board: undefined } : b)))}
            className="font-bold text-gray-600 underline hover:text-gray-900">
            Go back to the saved play
          </button>
        </p>
      )}

      {more && !isStep && (
        <div className="card p-3 space-y-3">
          <div>
            <label className="field-label" htmlFor="start-from">Start from a saved play</label>
            <select id="start-from" value="" onChange={(e) => startFrom(e.target.value)} className="field !py-1.5 text-sm">
              <option value="">— pick one —</option>
              {plays.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          {!borrowed && <ShelveForm board={board} />}
        </div>
      )}

      {editing && (
        <FieldBoard board={board} onChange={setBoard} startFull onLeaveFull={() => draw(false)} title={title || 'The field'} />
      )}
    </div>
  )
}

// ── Words ────────────────────────────────────────────────────────────────────

/** A title and the words under it. The page title, up top, is the heading. */
export function WordsEditor({ page, blocks, setBlocks }: { page: PlaybookPage; blocks: SlideBlock[]; setBlocks: SetBlocks }) {
  const text = firstOf(blocks, 'text')
  const list = firstOf(blocks, 'list')

  function setBody(body: string) {
    setBlocks((bs) => {
      const found = firstOf(bs, 'text')
      if (found) return bs.map((b) => (b.id === found.id && b.kind === 'text' ? { ...b, body } : b))
      return [...bs, { kind: 'text', id: blockId(), body, size: 'body' }]
    })
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
      {/* A white page on a pale screen needs an edge to read as a page. */}
      <div className="rounded-lg ring-1 ring-gray-200 shadow-sm">
        <WordsPageView page={page} />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
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
          <label className="field-label" htmlFor="words-list">Points <span className="font-normal text-gray-400">(one per line)</span></label>
          <textarea
            id="words-list"
            value={list?.items.join('\n') ?? ''}
            onChange={(e) => setItems(e.target.value)}
            rows={4}
            placeholder={'Slide early\nAdjacent fills\nTalk on every pass'}
            className="field"
          />
        </div>
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
  const [pasting, setPasting] = useState(false)
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

  function takeLink() {
    const url = driveImageUrl(link)
    if (!/^https?:\/\//i.test(url)) {
      setError('That doesn’t look like a link.')
      return
    }
    setError(null)
    setShot({ url })
    setLink('')
    setPasting(false)
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={busy}
        className="block w-full text-left rounded-lg ring-offset-2 focus-visible:ring-2 focus-visible:ring-[var(--gh-green)]"
        aria-label={shot?.url ? 'Change the photo' : 'Add a photo'}
      >
        <PicturePageView page={page} />
      </button>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => input.current?.click()} disabled={busy} className="btn btn-primary !py-2 text-sm disabled:opacity-60">
          {busy ? 'Uploading…' : shot?.url ? '📷 Change the photo' : '📷 Add a photo'}
        </button>
        <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
        {shots.length > 0 && (
          <select
            value=""
            onChange={(e) => e.target.value && setShot({ url: e.target.value })}
            className="field !py-1.5 !w-auto max-w-full text-sm"
            aria-label="Pick a picture from the Library"
          >
            <option value="">From the Library…</option>
            {shots.map((s) => (
              <option key={s.id} value={s.url}>{s.title || 'Untitled'}</option>
            ))}
          </select>
        )}
        <button type="button" onClick={() => setPasting((v) => !v)} aria-expanded={pasting} className="text-xs font-bold text-gray-500 hover:text-gray-800 px-1">
          Paste a link…
        </button>
      </div>

      {pasting && (
        <div className="space-y-1">
          <div className="flex gap-2">
            <input
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="A Google Drive share link works"
              aria-label="Picture link"
              className="field !py-1.5 text-sm flex-1 min-w-0"
            />
            <button type="button" onClick={takeLink} disabled={!link.trim()} className="btn btn-ghost !py-1.5 text-sm disabled:opacity-50">
              Use it
            </button>
          </div>
          <p className="text-xs text-gray-400">
            A Drive link shows only if the file is shared as &ldquo;Anyone with the link&rdquo;. Uploading it is surer — on
            an iPhone, Drive is in Files.
          </p>
        </div>
      )}

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
