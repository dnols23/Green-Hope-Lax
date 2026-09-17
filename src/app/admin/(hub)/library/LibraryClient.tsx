'use client'
import { useState } from 'react'
import dynamicImport from 'next/dynamic'
import { deletePlayAction, deleteShotAction, clearPlayClipAction } from '@/lib/actions'
import { clipLength, type Board, type BoardClip } from '@/lib/planner'
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
  const open = plays.find((p) => p.id === openId) ?? null

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-black mb-1">Library</h1>
        <p className="text-gray-500 text-sm">
          Every play the staff has drawn, every take of one being drawn, and every screenshot off
          the board. Anything here can be dropped into a practice plan, a note or a game plan.
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
                      style={{ background: 'var(--gh-green-pale, #e8f2ea)', color: 'var(--gh-green-dk)' }}
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

                  <form action={deletePlayAction}>
                    <input type="hidden" name="id" value={p.id} />
                    <button
                      type="submit"
                      aria-label={`Delete ${p.name}`}
                      className="text-xs font-semibold text-gray-300 hover:text-[var(--gh-maroon)]"
                    >
                      Delete
                    </button>
                  </form>
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
              <figure key={s.id} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                <a href={s.url} target="_blank" rel="noreferrer">
                  {/* Straight <img>: these are our own bucket, and a board
                      screenshot is a flat PNG that needs no resizing service. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s.url} alt={s.title} className="w-full block bg-gray-50" />
                </a>
                <figcaption className="px-3 py-2 flex items-center gap-2">
                  <span className="text-sm font-semibold truncate">{s.title}</span>
                  <span className="text-xs text-gray-400 ml-auto shrink-0">{when(s.createdAt)}</span>
                  <form action={deleteShotAction}>
                    <input type="hidden" name="id" value={s.id} />
                    <button
                      type="submit"
                      aria-label={`Delete ${s.title}`}
                      className="text-xs font-semibold text-gray-300 hover:text-[var(--gh-maroon)]"
                    >
                      Delete
                    </button>
                  </form>
                </figcaption>
              </figure>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
