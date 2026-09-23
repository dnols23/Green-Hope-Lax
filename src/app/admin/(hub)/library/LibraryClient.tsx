'use client'
import { useEffect, useRef, useState, useTransition } from 'react'
import dynamicImport from 'next/dynamic'
import { deleteLibraryAction, clearPlayClipAction, saveShotAction } from '@/lib/actions'
import { clipLength, type Board, type BoardClip } from '@/lib/planner'
import { mailtoFor, pickedLabel } from '@/lib/share'
import type { LibraryShot } from '@/lib/library'

/**
 * The shelf.
 *
 * The board is a browser-only thing — it measures itself against the glass —
 * so it is loaded on the client rather than painted on the server and swapped.
 */
const ClipPlayer = dynamicImport(
  () => import('@/components/planner/ClipPlayer').then((m) => m.ClipPlayer),
  { ssr: false, loading: () => <p className="text-sm text-gray-400 py-8">Opening…</p> }
)
const FieldBoard = dynamicImport(
  () => import('@/components/planner/FieldBoard').then((m) => m.FieldBoard),
  { ssr: false, loading: () => <p className="text-sm text-gray-400 py-8">Opening…</p> }
)

export interface LibraryPlay {
  id: string
  name: string
  board: Board
  clip: BoardClip | null
  createdBy: string | null
  updatedAt: string
}

function when(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function LibraryClient({
  plays,
  shots,
  ready,
}: {
  plays: LibraryPlay[]
  shots: LibraryShot[]
  ready: boolean
}) {
  const [openId, setOpenId] = useState<string | null>(null)
  const [picked, setPicked] = useState<string[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  /** Set once the plays have been drawn and there is a message ready to send. */
  const [mailHref, setMailHref] = useState<string | null>(null)
  const [deleting, startDeleting] = useTransition()
  /* A play is a drawing, not a picture, so there is nothing to attach to an
     email until one is made. This is where it gets drawn to be photographed. */
  const [picturing, setPicturing] = useState<LibraryPlay | null>(null)
  const darkroom = useRef<HTMLDivElement>(null)
  const waiting = useRef<((url: string | null) => void) | null>(null)

  const open = plays.find((p) => p.id === openId) ?? null
  const isPicked = (id: string) => picked.includes(id)
  const toggle = (id: string) => {
    setMailHref(null)
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))
  }
  const pickedShots = shots.filter((s) => isPicked(s.id))
  const pickedPlays = plays.filter((p) => isPicked(p.id))

  /**
   * Take the picture once the hidden board has painted itself, then hand the
   * address back to whoever asked for it.
   */
  useEffect(() => {
    if (!picturing) return
    let live = true
    const shoot = async () => {
      /* Wait for the board rather than for a couple of frames. The board is
         loaded on demand, so the first play of a session has a chunk to fetch
         before there is anything to photograph — two frames finds the "Opening…"
         placeholder and takes a picture of nothing. */
      let svg: SVGSVGElement | null = null
      for (let i = 0; i < 200 && live && !svg; i++) {
        svg = (darkroom.current?.querySelector('svg.touch-none') as SVGSVGElement | null) ?? null
        if (!svg) await new Promise((r) => setTimeout(r, 25))
      }
      let url: string | null = null
      try {
        if (svg) {
          const { boardToPng } = await import('@/lib/boardImage')
          const png = await boardToPng(svg)
          const data = new FormData()
          data.set('file', new File([png], 'play.png', { type: 'image/png' }))
          data.set('folder', 'library')
          const res = await fetch('/api/upload', { method: 'POST', body: data })
          const body = (await res.json()) as { url?: string }
          if (res.ok && body.url) {
            const row = new FormData()
            row.set('url', body.url)
            row.set('title', picturing.name)
            await saveShotAction(row)
            url = body.url
          }
        }
      } catch {
        url = null
      }
      if (!live) return
      waiting.current?.(url)
      waiting.current = null
      setPicturing(null)
    }
    void shoot()
    return () => {
      live = false
    }
  }, [picturing])

  const pictureOf = (play: LibraryPlay) =>
    new Promise<string | null>((resolve) => {
      waiting.current = resolve
      setPicturing(play)
    })

  /** Every address for what is ticked — drawing the plays first if need be. */
  async function linksForPicked(): Promise<string[]> {
    const out = pickedShots.map((s) => s.url)
    for (const play of pickedPlays) {
      setBusy(`Drawing ${play.name}…`)
      const url = await pictureOf(play)
      if (url) out.push(url)
    }
    return out
  }

  /**
   * A mail app opens on a link being followed, and a browser will only follow
   * one while it still believes a person asked for it. Screenshots already have
   * an address, so that case goes straight out inside the tap; a play has to be
   * drawn and uploaded first, and by then the tap is spent — so that case puts
   * the link in the bar to be pressed.
   */
  function openMail(links: string[]) {
    if (!links.length) return
    const a = document.createElement('a')
    a.href = mailtoFor(links)
    a.rel = 'noreferrer'
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  function emailPicked() {
    if (pickedPlays.length === 0) {
      openMail(pickedShots.map((s) => s.url))
      return
    }
    void (async () => {
      setBusy('Getting them ready…')
      const links = await linksForPicked()
      if (!links.length) {
        setBusy('Could not make a picture of that one. Try Screenshot on the Playboard.')
        return
      }
      setBusy(null)
      setMailHref(mailtoFor(links))
    })()
  }

  async function copyPicked() {
    setBusy('Getting them ready…')
    const links = await linksForPicked()
    try {
      await navigator.clipboard.writeText(links.join('\n'))
      setBusy(links.length === 1 ? 'Link copied' : `${links.length} links copied`)
    } catch {
      setBusy('This browser would not let me use the clipboard.')
    }
    setTimeout(() => setBusy(null), 2500)
  }

  async function sharePicked() {
    setBusy('Getting them ready…')
    const links = await linksForPicked()
    setBusy(null)
    if (!links.length) return
    try {
      await navigator.share({ title: 'Green Hope Lacrosse', text: links.join('\n') })
    } catch {
      // A share sheet closed without choosing anything is not a failure.
    }
  }

  function deletePicked() {
    const data = new FormData()
    data.set('shots', pickedShots.map((s) => s.id).join(','))
    data.set('plays', pickedPlays.map((p) => p.id).join(','))
    startDeleting(async () => {
      await deleteLibraryAction(data)
      setPicked([])
      setOpenId(null)
    })
  }

  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  return (
    <div className="max-w-4xl space-y-6 pb-24">
      <div>
        <h1 className="text-xl font-black mb-1">Library</h1>
        <p className="text-gray-500 text-sm">
          Every play the staff has drawn, every take of one being drawn, and every screenshot off
          the board. Tick what you want to send or throw away — and anything here drops into a
          practice plan, a note or a game plan from the Library button inside a block.
        </p>
      </div>

      {!ready && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm text-amber-900 font-bold mb-1">The Library isn&rsquo;t switched on yet.</p>
          <p className="text-sm text-amber-900">
            Run <code>supabase/migrations/0029_library.sql</code> in the Supabase SQL editor.
            Recordings and screenshots start saving straight away; nothing else on the site is
            affected.
          </p>
        </div>
      )}

      <section>
        <h2 className="text-[0.7rem] font-black tracking-[0.15em] uppercase text-gray-400 mb-2">
          Plays {plays.length > 0 && <span className="text-gray-300">· {plays.length}</span>}
        </h2>

        {plays.length === 0 ? (
          <p className="text-sm text-gray-400">
            Nothing yet. Draw one on the Playboard and give it a name.
          </p>
        ) : (
          <div className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100">
            {plays.map((p) => (
              <div key={p.id} className="px-4 py-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <input
                    type="checkbox"
                    checked={isPicked(p.id)}
                    onChange={() => toggle(p.id)}
                    aria-label={`Select ${p.name}`}
                    className="w-4 h-4 accent-[var(--gh-green)] shrink-0"
                  />
                  <button
                    type="button"
                    onClick={() => setOpenId(openId === p.id ? null : p.id)}
                    className="font-bold text-sm hover:text-[var(--gh-green)] text-left"
                  >
                    {p.name}
                  </button>

                  {p.clip && (
                    <span
                      className="text-[0.65rem] font-black uppercase tracking-wider px-2 py-0.5 rounded-full"
                      style={{ background: '#e8f2ea', color: 'var(--gh-green-dk)' }}
                    >
                      Recording · {(clipLength(p.clip) / 1000).toFixed(0)}s
                    </span>
                  )}

                  <span className="text-xs text-gray-400 ml-auto">
                    {p.createdBy ? `${p.createdBy} · ` : ''}
                    {when(p.updatedAt)}
                  </span>

                  {p.clip && (
                    <form action={clearPlayClipAction}>
                      <input type="hidden" name="id" value={p.id} />
                      <button type="submit" className="text-xs font-semibold text-gray-400 hover:text-gray-700">
                        Drop the recording
                      </button>
                    </form>
                  )}
                </div>

                {openId === p.id && open && (
                  <div className="mt-3">
                    {open.clip ? <ClipPlayer clip={open.clip} /> : <FieldBoard board={open.board} readOnly />}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-[0.7rem] font-black tracking-[0.15em] uppercase text-gray-400 mb-2">
          Screenshots {shots.length > 0 && <span className="text-gray-300">· {shots.length}</span>}
        </h2>

        {shots.length === 0 ? (
          <p className="text-sm text-gray-400">
            Nothing yet. Hit Screenshot on the Playboard and the picture lands here.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {shots.map((s) => (
              <figure
                key={s.id}
                className="rounded-xl border-2 bg-white overflow-hidden"
                style={{ borderColor: isPicked(s.id) ? 'var(--gh-green)' : 'var(--color-gray-200, #e5e7eb)' }}
              >
                <button
                  type="button"
                  onClick={() => toggle(s.id)}
                  aria-pressed={isPicked(s.id)}
                  className="block w-full text-left"
                  title="Tap to pick it"
                >
                  {/* Our own bucket, and a flat PNG — nothing to resize. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s.url} alt={s.title} className="w-full block bg-gray-50" />
                </button>
                <figcaption className="px-3 py-2 flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={isPicked(s.id)}
                    onChange={() => toggle(s.id)}
                    aria-label={`Select ${s.title}`}
                    className="w-4 h-4 accent-[var(--gh-green)] shrink-0"
                  />
                  <span className="text-sm font-semibold truncate">{s.title}</span>
                  <span className="text-xs text-gray-400 ml-auto shrink-0">{when(s.createdAt)}</span>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-semibold text-gray-400 hover:text-gray-700 shrink-0"
                  >
                    Open
                  </a>
                </figcaption>
              </figure>
            ))}
          </div>
        )}
      </section>

      {/* Where a play gets drawn so it can be photographed. Off the side of the
          page rather than hidden: a board with no size takes a blank picture. */}
      {picturing && (
        <div
          ref={darkroom}
          aria-hidden
          data-darkroom
          style={{ position: 'fixed', left: -10000, top: 0, width: 900 }}
        >
          <FieldBoard board={picturing.board} readOnly />
        </div>
      )}

      {/* What you can do with what is ticked. */}
      {picked.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
          <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold">{pickedLabel(picked.length)}</span>
            {busy && <span className="text-xs text-gray-500">{busy}</span>}

            <div className="ml-auto flex items-center gap-2 flex-wrap">
              {mailHref ? (
                <a href={mailHref} className="btn btn-primary !py-1.5 text-sm">
                  Open your mail app →
                </a>
              ) : (
                <button type="button" onClick={emailPicked} className="btn btn-primary !py-1.5 text-sm">
                  Email
                </button>
              )}
              <button type="button" onClick={copyPicked} className="btn btn-ghost !py-1.5 text-sm">
                Copy links
              </button>
              {canShare && (
                <button type="button" onClick={sharePicked} className="btn btn-ghost !py-1.5 text-sm">
                  Share…
                </button>
              )}
              <button
                type="button"
                onClick={deletePicked}
                disabled={deleting}
                className="text-sm font-bold px-3 py-1.5 rounded-lg disabled:opacity-50"
                style={{ color: 'var(--gh-maroon)' }}
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setPicked([])
                  setMailHref(null)
                }}
                className="text-sm font-semibold text-gray-400 hover:text-gray-700"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
