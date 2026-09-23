'use client'

import { useMemo, useState, useTransition } from 'react'
import { Modal } from '@/components/calendar/Modal'
import {
  ALL_SOURCE,
  DWELL_CHOICES,
  coverCss,
  LIKED_SOURCE,
  sourceIds,
  type WallLibrary,
  type WallPlaylist,
  type WallQuote,
} from '@/lib/wallModel'
import { deleteWallQuote, removeFromWallPlaylist, reorderWallPlaylist } from '@/lib/wallActions'
import { useWallPlayer, type WallPlayer } from './useWallPlayer'
import { AddToPlaylistSheet, Cover, PlaylistDialog, Progress, QuoteDialog, Transport } from './PlayerBits'
import { WallMode } from './WallMode'
import {
  IconAddToList,
  IconClose,
  IconExpand,
  IconGrip,
  IconHeart,
  IconPause,
  IconPlay,
  IconPlus,
  IconQuote,
  IconShuffle,
} from './icons'

type Sheet =
  | { kind: 'add'; quote: WallQuote }
  | { kind: 'quote'; editing?: WallQuote }
  | { kind: 'playlist'; editing?: WallPlaylist }
  | { kind: 'queue' }
  | { kind: 'wall' }
  | null

/**
 * The wall's library, laid out like a music app: your playlists down the side,
 * the one you're in across the middle, and the player along the bottom.
 */
export function WallClient({ lib, today, initial }: { lib: WallLibrary; today: string; initial: string | null }) {
  const player = useWallPlayer(lib, today)
  const [view, setView] = useState<string>(initial ?? player.source)
  const [sheet, setSheet] = useState<Sheet>(null)
  const [query, setQuery] = useState('')

  const byId = useMemo(() => new Map(lib.quotes.map((q) => [q.id, q])), [lib.quotes])
  const playlist = lib.playlists.find((p) => p.id === view) ?? null
  const shownView = playlist || view === LIKED_SOURCE ? view : ALL_SOURCE

  const mine = lib.playlists.filter((p) => p.ownerEmail === lib.me)
  const staff = lib.playlists.filter((p) => p.ownerEmail !== lib.me)

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-end gap-3 mb-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-black">On the Wall</h1>
          <p className="text-sm text-gray-500">
            Quotes, played like music. Make playlists for a week, a game or a message, and the War Room wall plays them.
          </p>
        </div>
        {lib.ready && (
          <div className="flex gap-2">
            <button type="button" onClick={() => setSheet({ kind: 'quote' })} className="btn btn-ghost !py-2 text-sm">
              <IconPlus className="w-4 h-4 inline -mt-0.5" /> Quote
            </button>
            <button type="button" onClick={() => setSheet({ kind: 'playlist' })} className="btn btn-primary !py-2 text-sm">
              <IconPlus className="w-4 h-4 inline -mt-0.5" /> Playlist
            </button>
          </div>
        )}
      </div>

      {!lib.ready && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 mb-4">
          <p className="text-sm text-amber-900 font-bold mb-1">Playlists aren&rsquo;t switched on yet.</p>
          <p className="text-sm text-amber-900">
            Run <code>supabase/migrations/0040_wall.sql</code> in the Supabase SQL editor. Until then the wall plays the
            built-in quotes, and nothing can be added or saved.
          </p>
        </div>
      )}

      <div className="grid lg:grid-cols-[17rem_minmax(0,1fr)] gap-4 items-start">
        {/* ── Your library ── */}
        <nav aria-label="Your library" className="lg:sticky lg:top-20 min-w-0">
          <div className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-visible pb-1 -mx-1 px-1 lg:mx-0 lg:px-0">
            <LibraryRow
              active={shownView === LIKED_SOURCE}
              playing={player.source === LIKED_SOURCE && player.playing}
              onClick={() => setView(LIKED_SOURCE)}
              tile={
                <span className="w-11 h-11 shrink-0 inline-flex items-center justify-center rounded-md text-white shadow-sm" style={{ background: 'linear-gradient(135deg,#7A1F2B,#e87ba4)' }}>
                  <IconHeart filled className="w-5 h-5" />
                </span>
              }
              title="Liked quotes"
              sub={`${lib.liked.length} liked`}
            />
            <LibraryRow
              active={shownView === ALL_SOURCE}
              playing={player.source === ALL_SOURCE && player.playing}
              onClick={() => setView(ALL_SOURCE)}
              tile={
                <span className="w-11 h-11 shrink-0 inline-flex items-center justify-center rounded-md text-white shadow-sm bg-gray-800">
                  <IconQuote className="w-5 h-5" />
                </span>
              }
              title="All quotes"
              sub={`${lib.quotes.length} quotes`}
            />
            {mine.length > 0 && <p className="hidden lg:block text-[0.65rem] font-black uppercase tracking-wider text-gray-400 mt-3 px-2">Your playlists</p>}
            {mine.map((p) => (
              <LibraryRow
                key={p.id}
                active={shownView === p.id}
                playing={player.source === p.id && player.playing}
                onClick={() => setView(p.id)}
                tile={<Cover cover={p.cover} emoji={p.emoji} name={p.name} className="w-11 h-11 text-lg" />}
                title={p.name}
                sub={`${p.shared ? 'Staff' : '🔒 Private'} · ${p.quoteIds.length}`}
              />
            ))}
            {staff.length > 0 && <p className="hidden lg:block text-[0.65rem] font-black uppercase tracking-wider text-gray-400 mt-3 px-2">From the staff</p>}
            {staff.map((p) => (
              <LibraryRow
                key={p.id}
                active={shownView === p.id}
                playing={player.source === p.id && player.playing}
                onClick={() => setView(p.id)}
                tile={<Cover cover={p.cover} emoji={p.emoji} name={p.name} className="w-11 h-11 text-lg" />}
                title={p.name}
                sub={`${p.ownerName ?? p.ownerEmail.split('@')[0]} · ${p.quoteIds.length}`}
              />
            ))}
            {lib.ready && (
              <button
                type="button"
                onClick={() => setSheet({ kind: 'playlist' })}
                className="shrink-0 lg:w-full flex items-center gap-3 rounded-lg p-2 text-left text-gray-500 hover:bg-gray-100 hover:text-gray-900"
              >
                <span className="w-11 h-11 shrink-0 inline-flex items-center justify-center rounded-md border-2 border-dashed border-gray-300">
                  <IconPlus className="w-5 h-5" />
                </span>
                <span className="font-bold text-sm whitespace-nowrap">New playlist</span>
              </button>
            )}
          </div>
        </nav>

        {/* ── The list ── */}
        <SourceView
          key={shownView}
          view={shownView}
          playlist={playlist}
          lib={lib}
          byId={byId}
          player={player}
          query={query}
          setQuery={setQuery}
          open={setSheet}
        />
      </div>

      <PlayerBar player={player} open={setSheet} />

      {sheet?.kind === 'add' && <AddToPlaylistSheet quote={sheet.quote} player={player} onClose={() => setSheet(null)} />}
      {sheet?.kind === 'quote' && (
        <QuoteDialog
          player={player}
          editing={sheet.editing}
          intoPlaylist={playlist?.editable ? playlist.id : null}
          onClose={() => setSheet(null)}
          onSaved={(id, list) => {
            if (sheet.editing) return
            if (list) setView(list)
            player.playSource(list ?? ALL_SOURCE, id, false)
          }}
        />
      )}
      {sheet?.kind === 'playlist' && (
        <PlaylistDialog
          player={player}
          editing={sheet.editing}
          onClose={() => setSheet(null)}
          onSaved={(id) => setView(id)}
          onDeleted={() => setView(ALL_SOURCE)}
        />
      )}
      {sheet?.kind === 'queue' && <QueueSheet player={player} onClose={() => setSheet(null)} />}
      {sheet?.kind === 'wall' && <WallMode player={player} onClose={() => setSheet(null)} />}
    </div>
  )
}

function LibraryRow({
  active,
  playing,
  onClick,
  tile,
  title,
  sub,
}: {
  active: boolean
  playing: boolean
  onClick: () => void
  tile: React.ReactNode
  title: string
  sub: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`shrink-0 lg:w-full flex items-center gap-3 rounded-lg p-2 text-left transition-colors ${
        active ? 'bg-white shadow-sm ring-1 ring-gray-200' : 'hover:bg-gray-100'
      }`}
    >
      {tile}
      <span className="min-w-0 max-w-[9rem] lg:max-w-none flex-1">
        <span className={`block text-sm font-bold truncate ${playing ? 'text-[var(--gh-green)]' : ''}`}>{title}</span>
        <span className="block text-xs text-gray-500 truncate">{sub}</span>
      </span>
      {playing && <Bars />}
    </button>
  )
}

/** The little bouncing bars a music app puts next to what's playing. */
function Bars() {
  return (
    <span aria-label="Playing" className="inline-flex items-end gap-[2px] h-3.5 shrink-0">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-[3px] rounded-sm bg-[var(--gh-green)] animate-[wallBar_900ms_ease-in-out_infinite]"
          style={{ animationDelay: `${i * 150}ms`, height: '100%' }}
        />
      ))}
    </span>
  )
}

// ── One source, listed ───────────────────────────────────────────────────────

function SourceView({
  view,
  playlist,
  lib,
  byId,
  player,
  query,
  setQuery,
  open,
}: {
  view: string
  playlist: WallPlaylist | null
  lib: WallLibrary
  byId: Map<string, WallQuote>
  player: WallPlayer
  query: string
  setQuery: (q: string) => void
  open: (s: Sheet) => void
}) {
  const baseIds = sourceIds(lib, view)
  // A drag or a move shows straight away and stays until the saved order comes back.
  const [moved, setMoved] = useState<{ from: string; ids: string[] } | null>(null)
  const baseKey = baseIds.join(',')
  const ids = moved && moved.from === baseKey ? moved.ids : baseIds
  const [dragId, setDragId] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<string | null>(null)

  const q = query.trim().toLowerCase()
  const rows = ids
    .map((id) => byId.get(id))
    .filter((x): x is WallQuote => !!x)
    .filter((x) => !q || x.line.toLowerCase().includes(q) || (x.who ?? '').toLowerCase().includes(q))

  const isThis = player.source === view
  const title = playlist?.name ?? (view === LIKED_SOURCE ? 'Liked quotes' : 'All quotes')
  const editable = !!playlist?.editable
  const canReorder = editable && !q

  function saveOrder(next: string[]) {
    if (!playlist) return
    setMoved({ from: baseKey, ids: next })
    start(async () => {
      const r = await reorderWallPlaylist(playlist.id, next)
      if (!r.ok) {
        setMoved(null)
        setMsg(r.error)
      } else player.refresh()
    })
  }

  function move(id: string, by: number) {
    const at = ids.indexOf(id)
    const to = at + by
    if (at < 0 || to < 0 || to >= ids.length) return
    const next = [...ids]
    next.splice(at, 1)
    next.splice(to, 0, id)
    saveOrder(next)
  }

  function dropOn(targetId: string) {
    if (!dragId || dragId === targetId) return
    const next = ids.filter((x) => x !== dragId)
    next.splice(next.indexOf(targetId), 0, dragId)
    setDragId(null)
    saveOrder(next)
  }

  function takeOff(quote: WallQuote) {
    if (!playlist) return
    start(async () => {
      const r = await removeFromWallPlaylist(playlist.id, quote.id)
      setMsg(r.ok ? `Taken off ${playlist.name}.` : r.error)
      if (r.ok) player.refresh()
    })
  }

  function remove(quote: WallQuote) {
    start(async () => {
      const r = await deleteWallQuote(quote.id)
      setConfirm(null)
      setMsg(r.ok ? 'Quote deleted.' : r.error)
      if (r.ok) player.refresh()
    })
  }

  const who = playlist ? (playlist.ownerEmail === lib.me ? 'You' : playlist.ownerName ?? playlist.ownerEmail.split('@')[0]) : null

  return (
    <section className="card overflow-hidden min-w-0" aria-label={title}>
      {/* Header */}
      <div
        className="p-4 sm:p-6 text-white"
        style={{
          background: playlist
            ? `linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,.35) 100%), ${coverCss(playlist.cover)}`
            : view === LIKED_SOURCE
              ? 'linear-gradient(135deg,#7A1F2B,#c25a7c)'
              : 'linear-gradient(135deg,#1f2937,#00693E)',
        }}
      >
        <div className="flex items-end gap-4">
          {playlist ? (
            <Cover cover={playlist.cover} emoji={playlist.emoji} name={playlist.name} className="w-24 h-24 sm:w-32 sm:h-32 text-4xl sm:text-5xl rounded-xl shadow-2xl" />
          ) : (
            <span className="w-24 h-24 sm:w-32 sm:h-32 shrink-0 inline-flex items-center justify-center rounded-xl bg-white/10 shadow-2xl">
              {view === LIKED_SOURCE ? <IconHeart filled className="w-12 h-12" /> : <IconQuote className="w-12 h-12" />}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-[0.65rem] font-black uppercase tracking-[0.2em] text-white/70">
              {playlist ? (playlist.shared ? 'Staff playlist' : 'Private playlist') : 'Library'}
            </p>
            <h2 className="text-2xl sm:text-4xl font-black leading-tight break-words">{title}</h2>
            {playlist?.description && <p className="text-sm text-white/80 mt-1">{playlist.description}</p>}
            <p className="text-xs text-white/70 mt-1">
              {who ? `${who} · ` : ''}
              {ids.length} quote{ids.length === 1 ? '' : 's'}
            </p>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={() => (isThis ? player.toggle() : player.playSource(view))}
            disabled={!ids.length}
            aria-label={isThis && player.playing ? `Pause ${title}` : `Play ${title}`}
            className="w-14 h-14 inline-flex items-center justify-center rounded-full text-gray-900 shadow-lg hover:scale-105 active:scale-95 transition-transform disabled:opacity-40"
            style={{ background: '#7ee0a8' }}
          >
            {isThis && player.playing ? <IconPause className="w-6 h-6" /> : <IconPlay className="w-6 h-6 translate-x-[1px]" />}
          </button>
          <button
            type="button"
            onClick={() => player.playSource(view, null, true, true)}
            disabled={!ids.length}
            aria-label={`Shuffle ${title}`}
            title="Shuffle play"
            className="w-10 h-10 inline-flex items-center justify-center rounded-full text-white/80 hover:text-white disabled:opacity-40"
          >
            <IconShuffle />
          </button>
          {editable && playlist && (
            <button
              type="button"
              onClick={() => open({ kind: 'playlist', editing: playlist })}
              className="text-sm font-bold text-white/80 hover:text-white px-2"
            >
              Edit
            </button>
          )}
          <span className="flex-1" />
          <button
            type="button"
            onClick={() => {
              if (!isThis) player.playSource(view, null, false)
              open({ kind: 'wall' })
            }}
            disabled={!ids.length}
            aria-label="Wall mode"
            title="Wall mode — full screen for the TV"
            className="w-10 h-10 inline-flex items-center justify-center rounded-full text-white/80 hover:text-white hover:bg-white/10 disabled:opacity-40"
          >
            <IconExpand />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="p-3 border-b border-gray-100 flex items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${title.toLowerCase()}`}
          aria-label="Search quotes"
          className="field !py-1.5 text-sm flex-1 min-w-0"
        />
        {lib.ready && (
          <button type="button" onClick={() => open({ kind: 'quote' })} className="btn btn-ghost !py-1.5 text-sm shrink-0">
            <IconPlus className="w-4 h-4 inline -mt-0.5" /> Add
          </button>
        )}
      </div>

      {msg && (
        <p className="px-4 py-2 text-xs font-semibold text-gray-600 bg-gray-50 border-b border-gray-100" role="status">
          {msg}{' '}
          <button type="button" onClick={() => setMsg(null)} className="underline">OK</button>
        </p>
      )}

      {/* Rows */}
      {rows.length === 0 ? (
        <p className="p-6 text-sm text-gray-500">
          {q
            ? 'Nothing matches that.'
            : view === LIKED_SOURCE
              ? 'Tap the heart on a quote and it lands here.'
              : playlist
                ? editable
                  ? 'Empty. Add quotes from All quotes with the + button, or add a new one.'
                  : 'Nothing on this playlist yet.'
                : 'No quotes yet.'}
        </p>
      ) : (
        <ol className={pending ? 'opacity-70' : undefined}>
          {rows.map((quote, i) => {
            const current = isThis && player.quote?.id === quote.id
            const liked = player.isLiked(quote.id)
            const mayEdit = lib.ready && (lib.isOwner || (!!quote.addedBy && quote.addedBy === lib.me))
            return (
              <li
                key={quote.id}
                draggable={canReorder}
                onDragStart={() => setDragId(quote.id)}
                onDragEnd={() => setDragId(null)}
                onDragOver={(e) => {
                  if (canReorder && dragId) e.preventDefault()
                }}
                onDrop={() => dropOn(quote.id)}
                className={`group flex items-start gap-2 sm:gap-3 px-3 sm:px-4 py-3 border-b border-gray-50 last:border-b-0 ${
                  current ? 'bg-emerald-50/60' : 'hover:bg-gray-50'
                } ${dragId === quote.id ? 'opacity-40' : ''}`}
              >
                <span className="w-6 shrink-0 pt-0.5 text-right text-xs tabular-nums text-gray-400">
                  {current && player.playing ? <Bars /> : canReorder ? (
                    <span className="inline-flex flex-col items-end">
                      <span className="group-hover:hidden">{i + 1}</span>
                      <span className="hidden group-hover:inline cursor-grab text-gray-400" title="Drag to reorder">
                        <IconGrip />
                      </span>
                    </span>
                  ) : (
                    i + 1
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => player.playSource(view, quote.id)}
                  className="min-w-0 flex-1 text-left"
                  aria-label={`Play “${quote.line}”`}
                >
                  <span className={`block text-sm leading-snug ${current ? 'font-black text-[var(--gh-green)]' : 'font-semibold text-gray-900'}`}>
                    {quote.line}
                  </span>
                  <span className="block text-xs text-gray-500 mt-0.5">
                    {quote.who ? `— ${quote.who}` : 'Unknown'}
                    {quote.addedByName && <span className="text-gray-400"> · added by {quote.addedByName}</span>}
                  </span>
                </button>
                <div className="flex items-center shrink-0 -mr-1">
                  {lib.ready && (
                    <button
                      type="button"
                      onClick={() => player.like(quote.id)}
                      aria-pressed={liked}
                      aria-label={liked ? 'Unlike' : 'Like'}
                      className={`w-8 h-8 inline-flex items-center justify-center rounded-full ${liked ? 'text-[var(--gh-maroon)]' : 'text-gray-300 hover:text-gray-700'}`}
                    >
                      <IconHeart filled={liked} className="w-4 h-4" />
                    </button>
                  )}
                  {lib.ready && (
                    <button
                      type="button"
                      onClick={() => open({ kind: 'add', quote })}
                      aria-label="Add to playlist"
                      title="Add to playlist"
                      className="w-8 h-8 inline-flex items-center justify-center rounded-full text-gray-300 hover:text-gray-700"
                    >
                      <IconAddToList className="w-4 h-4" />
                    </button>
                  )}
                  <RowMenu
                    canMove={canReorder}
                    first={i === 0}
                    last={i === rows.length - 1}
                    onUp={() => move(quote.id, -1)}
                    onDown={() => move(quote.id, 1)}
                    onTakeOff={editable ? () => takeOff(quote) : undefined}
                    onEdit={mayEdit ? () => open({ kind: 'quote', editing: quote }) : undefined}
                    onDelete={mayEdit ? () => setConfirm(quote.id) : undefined}
                  />
                </div>
              </li>
            )
          })}
        </ol>
      )}
      {confirm && byId.get(confirm) && (
        <Modal shape="card" label="Delete quote" onClose={() => setConfirm(null)}>
          <div className="p-4 space-y-3">
            <p className="font-bold">Delete this quote for everyone?</p>
            <p className="text-sm text-gray-600">&ldquo;{byId.get(confirm)?.line}&rdquo;</p>
            <p className="text-xs text-gray-500">It comes off every playlist and every heart.</p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setConfirm(null)} className="btn btn-ghost">Keep it</button>
              <button
                type="button"
                onClick={() => {
                  const target = byId.get(confirm)
                  if (target) remove(target)
                }}
                className="btn btn-maroon"
              >
                Delete
              </button>
            </div>
          </div>
        </Modal>
      )}
    </section>
  )
}

/** The ⋯ on a row: move, take off, fix, delete — whatever this coach may do. */
function RowMenu({
  canMove,
  first,
  last,
  onUp,
  onDown,
  onTakeOff,
  onEdit,
  onDelete,
}: {
  canMove: boolean
  first: boolean
  last: boolean
  onUp: () => void
  onDown: () => void
  onTakeOff?: () => void
  onEdit?: () => void
  onDelete?: () => void
}) {
  const [open, setOpen] = useState(false)
  if (!canMove && !onTakeOff && !onEdit && !onDelete) return null
  const item = 'w-full text-left px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-40'
  const run = (fn?: () => void) => () => {
    setOpen(false)
    fn?.()
  }
  return (
    <span className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="More"
        aria-expanded={open}
        className="w-8 h-8 inline-flex items-center justify-center rounded-full text-gray-300 hover:text-gray-700 font-black"
      >
        ⋯
      </button>
      {open && (
        <>
          <span className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
          <span role="menu" className="absolute right-0 top-9 z-50 w-48 rounded-lg bg-white shadow-xl ring-1 ring-gray-200 py-1 flex flex-col">
            {canMove && (
              <>
                <button type="button" role="menuitem" className={item} disabled={first} onClick={run(onUp)}>Move up</button>
                <button type="button" role="menuitem" className={item} disabled={last} onClick={run(onDown)}>Move down</button>
              </>
            )}
            {onTakeOff && <button type="button" role="menuitem" className={item} onClick={run(onTakeOff)}>Remove from playlist</button>}
            {onEdit && <button type="button" role="menuitem" className={item} onClick={run(onEdit)}>Edit quote</button>}
            {onDelete && (
              <button type="button" role="menuitem" className={`${item} text-[var(--gh-maroon)]`} onClick={run(onDelete)}>
                Delete quote
              </button>
            )}
          </span>
        </>
      )}
    </span>
  )
}

// ── The player bar ───────────────────────────────────────────────────────────

function PlayerBar({ player, open }: { player: WallPlayer; open: (s: Sheet) => void }) {
  const q = player.quote
  const liked = q ? player.isLiked(q.id) : false
  const playlist = player.lib.playlists.find((p) => p.id === player.source)
  return (
    /* Sticks to the bottom of the screen inside the page's own column, so it
       never sits over the hub's sidebar. */
    <div className="sticky bottom-0 z-30 mt-6 -mx-1 sm:mx-0 rounded-t-xl sm:rounded-xl border border-gray-200 bg-white/95 backdrop-blur shadow-[0_-4px_24px_rgba(0,0,0,.08)] sm:mb-2">
      <div className="px-3 sm:px-4 py-2 sm:py-3 grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1fr)] items-center gap-x-3 gap-y-1">
        {/* Now playing */}
        <div className="flex items-center gap-3 min-w-0">
          {playlist ? (
            <Cover cover={playlist.cover} emoji={playlist.emoji} name={playlist.name} className="w-11 h-11 text-lg hidden sm:inline-flex" />
          ) : (
            <span className="w-11 h-11 shrink-0 hidden sm:inline-flex items-center justify-center rounded-md bg-gray-800 text-white">
              <IconQuote className="w-5 h-5" />
            </span>
          )}
          <div className="min-w-0">
            <p className="text-sm font-bold leading-snug line-clamp-2 md:line-clamp-1">{q ? `“${q.line}”` : 'Nothing playing'}</p>
            <p className="text-xs text-gray-500 truncate">
              {q?.who ? `${q.who} · ` : ''}
              {player.sourceLabel}
            </p>
          </div>
          {player.lib.ready && q && (
            <button
              type="button"
              onClick={() => player.like(q.id)}
              aria-pressed={liked}
              aria-label={liked ? 'Unlike' : 'Like'}
              className={`hidden md:inline-flex w-8 h-8 shrink-0 items-center justify-center rounded-full ${liked ? 'text-[var(--gh-maroon)]' : 'text-gray-400 hover:text-gray-800'}`}
            >
              <IconHeart filled={liked} className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Controls — under the quote on a phone, in the middle on a laptop */}
        <div className="min-w-0 space-y-1">
          <Transport player={player} size="sm" />
          <Progress player={player} />
        </div>

        {/* Extras */}
        <div className="hidden md:flex items-center justify-end gap-1">
          {player.lib.ready && q && (
            <button
              type="button"
              onClick={() => open({ kind: 'add', quote: q })}
              aria-label="Add to playlist"
              title="Add to playlist"
              className="w-9 h-9 inline-flex items-center justify-center rounded-full text-gray-500 hover:text-gray-900"
            >
              <IconAddToList className="w-5 h-5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => open({ kind: 'queue' })}
            className="h-9 px-2 text-xs font-bold rounded-full text-gray-500 hover:text-gray-900"
          >
            Up next
          </button>
          <label className="inline-flex items-center gap-1 text-xs text-gray-500">
            <span className="sr-only">Seconds on each quote</span>
            <select
              value={player.dwell}
              onChange={(e) => player.setDwell(Number(e.target.value))}
              className="field !py-1 !pl-2 !pr-6 !w-auto text-xs"
              title="How long each quote stays up"
            >
              {DWELL_CHOICES.map((s) => (
                <option key={s} value={s}>{s < 60 ? `${s}s each` : '1 min each'}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => open({ kind: 'wall' })}
            aria-label="Wall mode"
            title="Wall mode — full screen for the TV"
            className="w-9 h-9 inline-flex items-center justify-center rounded-full text-gray-500 hover:text-gray-900"
          >
            <IconExpand className="w-5 h-5" />
          </button>
        </div>
      </div>
      {player.error && (
        <p className="text-center text-xs font-semibold text-[var(--gh-maroon)] pb-2" role="alert">
          {player.error}{' '}
          <button type="button" onClick={player.clearError} className="underline">OK</button>
        </p>
      )}
    </div>
  )
}

function QueueSheet({ player, onClose }: { player: WallPlayer; onClose: () => void }) {
  return (
    <Modal shape="drawer" label="Up next" onClose={onClose}>
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-gray-400">Up next</p>
            <p className="text-sm font-bold">{player.sourceLabel}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1 text-gray-400 hover:text-gray-700">
            <IconClose />
          </button>
        </div>
        <div className="overflow-y-auto p-4 space-y-4">
          {player.quote && (
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-[var(--gh-green)] mb-1">Now on the wall</p>
              <p className="text-sm font-bold">&ldquo;{player.quote.line}&rdquo;</p>
              {player.quote.who && <p className="text-xs text-gray-500">— {player.quote.who}</p>}
            </div>
          )}
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-gray-400 mb-1">
              Next{player.shuffle ? ' · shuffled' : ''}
              {player.repeat === 'one' ? ' · repeating this one' : ''}
            </p>
            {player.upNext.length === 0 ? (
              <p className="text-sm text-gray-500">That&rsquo;s the end of the list{player.repeat === 'off' ? ' — turn on repeat to go round again' : ''}.</p>
            ) : (
              <ol className="space-y-2">
                {player.upNext.map((q) => (
                  <li key={q.id}>
                    <button
                      type="button"
                      onClick={() => player.playSource(player.source, q.id)}
                      className="text-left w-full rounded-lg p-2 hover:bg-gray-50"
                    >
                      <span className="block text-sm font-semibold">{q.line}</span>
                      {q.who && <span className="block text-xs text-gray-500">— {q.who}</span>}
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}
