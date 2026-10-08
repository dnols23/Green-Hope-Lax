'use client'
import { useEffect, useRef, useState, useTransition } from 'react'
import dynamicImport from 'next/dynamic'
import Link from 'next/link'
import { deleteLibraryAction, clearPlayClipAction, saveShotAction } from '@/lib/actions'
import { clipLength, type Board, type BoardClip } from '@/lib/planner'
import { mailtoFor, pickedLabel } from '@/lib/share'
import type { LibraryShot } from '@/lib/library'
import type { PlaybookSpot } from '@/lib/playbookData'
import type { PlaybookSection } from '@/lib/playbook'
import { addSavedPlayToPlaybook } from '@/lib/playbookActions'
import type { Team } from '@/lib/teams'
import { PlaybookPicker, SpotLink, teamSpots } from './PlaybookPicker'

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
  /** How many steps, when the play is a progression (0 when it isn't). */
  steps: number
  createdBy: string | null
  updatedAt: string
}

/** Ways to narrow the shelf. Screenshots only show under All. */
type Filter = 'all' | 'steps' | 'in' | 'out' | 'rec'

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'steps', label: 'Progressions' },
  { key: 'in', label: 'In a playbook' },
  { key: 'out', label: 'Not in a playbook' },
  { key: 'rec', label: 'Recordings' },
]

function when(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const TAG = 'text-[0.6rem] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full shrink-0 whitespace-nowrap'

export function LibraryClient({
  plays,
  shots,
  ready,
  spots = {},
  playbookTeams = [],
}: {
  plays: LibraryPlay[]
  shots: LibraryShot[]
  ready: boolean
  /** Play id → the playbook pages it is on. */
  spots?: Record<string, PlaybookSpot[]>
  /** The decks this coach may add to — the head coach's, nobody else's. */
  playbookTeams?: Team[]
}) {
  /** The play whose recording is playing in its card, instead of the still. */
  const [watching, setWatching] = useState<string | null>(null)
  const [find, setFind] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [sort, setSort] = useState<'new' | 'az'>('new')
  /** Pages made from here, until the server's list catches up. */
  const [added, setAdded] = useState<Record<string, PlaybookSpot[]>>({})
  const [notice, setNotice] = useState<string | null>(null)
  const spotsFor = (id: string) => {
    const all = [...(spots[id] ?? []), ...(added[id] ?? [])]
    return all.filter((s, i) => all.findIndex((x) => x.pageId === s.pageId) === i)
  }

  const q = find.trim().toLowerCase()
  const matches = (title: string) => !q || title.toLowerCase().includes(q)
  const fits = (p: LibraryPlay, f: Filter) =>
    f === 'steps' ? p.steps > 1
    : f === 'in' ? spotsFor(p.id).length > 0
    : f === 'out' ? spotsFor(p.id).length === 0
    : f === 'rec' ? !!p.clip
    : true
  const count = (f: Filter) => plays.filter((p) => fits(p, f)).length
  /* Newest first is how they come; A–Z reads "1-4-1 pop" before "2-3-1 dodge"
     and "Clear 2" before "Clear 10". */
  function sorted<T>(list: T[], title: (x: T) => string, at: (x: T) => string): T[] {
    return [...list].sort((a, b) =>
      sort === 'az'
        ? title(a).localeCompare(title(b), undefined, { sensitivity: 'base', numeric: true })
        : at(b).localeCompare(at(a))
    )
  }
  const shown = sorted(plays.filter((p) => matches(p.name) && fits(p, filter)), (p) => p.name, (p) => p.updatedAt)
  // Screenshots aren't plays: a play filter puts them away; a search looks through them too.
  const shotsShown = filter === 'all' ? sorted(shots.filter((s) => matches(s.title)), (s) => s.title, (s) => s.createdAt) : []
  const narrowed = !!q || filter !== 'all'
  function widen() {
    setFind('')
    setFilter('all')
  }

  async function addTo(play: LibraryPlay, team: Team, section: PlaybookSection): Promise<string | null> {
    setNotice(null)
    const r = await addSavedPlayToPlaybook({ playId: play.id, team, section })
    if (!r.ok) return r.error
    setAdded((x) => ({ ...x, [play.id]: [...(x[play.id] ?? []), { team: r.team, pageId: r.pageId, section }] }))
    if (r.note) setNotice(r.note.trim())
    return null
  }

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
    const many = picked.length
    if (!window.confirm(`Delete ${many === 1 ? 'it' : `these ${many}`}? This can’t be undone.`)) return
    const data = new FormData()
    data.set('shots', pickedShots.map((s) => s.id).join(','))
    data.set('plays', pickedPlays.map((p) => p.id).join(','))
    startDeleting(async () => {
      await deleteLibraryAction(data)
      setPicked([])
      setWatching(null)
    })
  }

  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  return (
    <div className="max-w-4xl space-y-6 pb-24">
      <div>
        <h1 className="text-xl font-black mb-1">Library</h1>
        <p className="text-gray-500 text-sm">
          Every play you&rsquo;ve saved on the Playboard, and every screenshot. Open one to keep
          drawing, put it in a playbook, or tick a few to send or delete.
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

      {/* Find, narrow, order. Always here: the shelf only gets longer. */}
      {(plays.length > 0 || shots.length > 0) && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <input
              type="search"
              value={find}
              onChange={(e) => setFind(e.target.value)}
              placeholder="Find a play or screenshot"
              aria-label="Find a play or screenshot"
              className="field !py-1.5 text-sm flex-1 min-w-0 sm:max-w-xs"
            />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value === 'az' ? 'az' : 'new')}
              aria-label="Order"
              className="field !py-1.5 !w-auto text-sm shrink-0"
            >
              <option value="new">Newest</option>
              <option value="az">A–Z</option>
            </select>
          </div>
          {plays.length > 0 && (
            <div className="flex gap-1.5 overflow-x-auto pb-1" role="group" aria-label="Show">
              {FILTERS.map((f) => {
                const n = count(f.key)
                // A filter with nothing in it is clutter — unless it's the one you're on.
                if (f.key !== 'all' && n === 0 && filter !== f.key) return null
                const on = filter === f.key
                return (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setFilter(f.key)}
                    aria-pressed={on}
                    className="shrink-0 min-h-8 px-3 rounded-full border text-xs font-bold whitespace-nowrap transition"
                    style={
                      on
                        ? { borderColor: 'var(--gh-green)', background: '#eef6f1', color: 'var(--gh-green)' }
                        : { borderColor: '#e5e7eb', color: '#4b5563', background: '#fff' }
                    }
                  >
                    {f.label} <span className={on ? 'opacity-70' : 'text-gray-400'}>{n}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      <section>
        <h2 className="text-[0.7rem] font-black tracking-[0.15em] uppercase text-gray-400 mb-2">
          Plays{' '}
          {plays.length > 0 && (
            <span className="text-gray-300">· {narrowed ? `${shown.length} of ${plays.length}` : plays.length}</span>
          )}
        </h2>

        {notice && (
          <p className="text-sm font-semibold text-amber-800 mb-2" role="status">
            {notice}
          </p>
        )}

        {plays.length === 0 ? (
          <p className="text-sm text-gray-400">
            Nothing yet. Draw one on the <Link href="/admin/playboard" className="font-bold text-[var(--gh-green)]">Playboard</Link>, name it and hit Save.
          </p>
        ) : shown.length === 0 ? (
          <p className="text-sm text-gray-400">
            No play fits that.{' '}
            <button type="button" onClick={widen} className="font-bold text-[var(--gh-green)]">
              Show them all
            </button>
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {shown.map((p) => {
              const here = teamSpots(spotsFor(p.id))
              return (
                <div
                  key={p.id}
                  className="rounded-xl border-2 bg-white flex flex-col"
                  style={{ borderColor: isPicked(p.id) ? 'var(--gh-green)' : 'var(--color-gray-200, #e5e7eb)' }}
                >
                  {/* The play itself. Double-tap it for full screen. */}
                  <div className="rounded-t-[10px] overflow-hidden">
                    {watching === p.id && p.clip ? (
                      <ClipPlayer clip={p.clip} autoPlay />
                    ) : (
                      <FieldBoard board={p.board} readOnly zoomable={false} title={p.name} />
                    )}
                  </div>
                  <div className="px-3 py-2.5 space-y-2 mt-auto">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isPicked(p.id)}
                        onChange={() => toggle(p.id)}
                        aria-label={`Select ${p.name}`}
                        className="w-4 h-4 accent-[var(--gh-green)] shrink-0"
                      />
                      <span className="font-bold truncate">{p.name}</span>
                      <span className="text-xs text-gray-400 ml-auto shrink-0">{when(p.updatedAt)}</span>
                    </div>

                    {/* What it is, and where it already is. */}
                    {(p.steps > 1 || p.clip || here.length > 0) && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        {p.steps > 1 && (
                          <span className={TAG} style={{ background: '#eef2f7', color: '#2F5D8C' }}>
                            {p.steps} steps
                          </span>
                        )}
                        {p.clip && (
                          <span className={TAG} style={{ background: '#e8f2ea', color: 'var(--gh-green-dk)' }}>
                            Rec · {(clipLength(p.clip) / 1000).toFixed(0)}s
                          </span>
                        )}
                        {here.map((s) => (
                          <SpotLink key={s.team} spot={s} />
                        ))}
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-bold">
                      <Link href={`/admin/playboard?play=${p.id}`} className="text-[var(--gh-green)]">
                        Open on the Playboard
                      </Link>
                      {p.clip && (
                        <button
                          type="button"
                          onClick={() => setWatching(watching === p.id ? null : p.id)}
                          className="text-gray-600 hover:text-gray-900"
                        >
                          {watching === p.id ? 'Show the play' : '▶ Watch it drawn'}
                        </button>
                      )}
                      {playbookTeams.length > 0 && (
                        <PlaybookPicker
                          teams={playbookTeams}
                          spots={here}
                          steps={p.steps}
                          showSpots={false}
                          onAdd={(team, section) => addTo(p, team, section)}
                        />
                      )}
                    </div>

                    {/* Only while it's playing: the take is what you'd be throwing away. */}
                    {p.clip && watching === p.id && (
                      <form
                        action={clearPlayClipAction}
                        onSubmit={(e) => {
                          if (!window.confirm('Drop the recording? The play stays.')) e.preventDefault()
                          else setWatching(null)
                        }}
                      >
                        <input type="hidden" name="id" value={p.id} />
                        <button type="submit" className="text-xs font-semibold text-gray-400 hover:text-gray-700">
                          Drop the recording
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {filter === 'all' && (
        <section>
          <h2 className="text-[0.7rem] font-black tracking-[0.15em] uppercase text-gray-400 mb-2">
            Screenshots{' '}
            {shots.length > 0 && (
              <span className="text-gray-300">· {q ? `${shotsShown.length} of ${shots.length}` : shots.length}</span>
            )}
          </h2>

          {shots.length === 0 ? (
            <p className="text-sm text-gray-400">
              Nothing yet. Hit Screenshot on the Playboard and the picture lands here.
            </p>
          ) : shotsShown.length === 0 ? (
            <p className="text-sm text-gray-400">No screenshot called that.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {shotsShown.map((s) => (
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
      )}

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
