'use client'

import { useEffect, useState, useTransition } from 'react'
import { Modal } from '@/components/calendar/Modal'
import {
  COVERS,
  COVER_EMOJI,
  coverCss,
  type CoverKey,
  type WallPlaylist,
  type WallQuote,
} from '@/lib/wallModel'
import {
  addToWallPlaylist,
  addWallQuote,
  createWallPlaylist,
  deleteWallPlaylist,
  editWallQuote,
  removeFromWallPlaylist,
  updateWallPlaylist,
} from '@/lib/wallActions'
import type { WallPlayer } from './useWallPlayer'
import {
  IconClose,
  IconNext,
  IconPause,
  IconPlay,
  IconPrev,
  IconRepeat,
  IconShuffle,
} from './icons'

/** Escape closes whatever pop-up is on top. */
function useEscape(onClose: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])
}

// ── The transport ────────────────────────────────────────────────────────────

/**
 * Shuffle, back, play, next, repeat — in that order, as on every music app, so
 * nobody has to learn where anything is.
 */
export function Transport({
  player,
  size = 'md',
  tone = 'light',
  ghost = false,
}: {
  player: WallPlayer
  size?: 'sm' | 'md' | 'lg'
  tone?: 'light' | 'dark'
  /** See-through play button — an outline, not a filled green disc. */
  ghost?: boolean
}) {
  const dark = tone === 'dark'
  const idle = dark ? 'text-white/70 hover:text-white' : 'text-gray-500 hover:text-gray-900'
  const on = dark ? 'text-[#7ee0a8]' : 'text-[var(--gh-green)]'
  const icon = size === 'lg' ? 'w-7 h-7' : size === 'sm' ? 'w-4 h-4' : 'w-5 h-5'
  const side = size === 'lg' ? 'w-12 h-12' : size === 'sm' ? 'w-8 h-8' : 'w-10 h-10'
  const big = size === 'lg' ? 'w-20 h-20' : size === 'sm' ? 'w-10 h-10' : 'w-14 h-14'
  const bigIcon = size === 'lg' ? 'w-9 h-9' : size === 'sm' ? 'w-5 h-5' : 'w-7 h-7'
  const repeatLabel =
    player.repeat === 'one' ? 'Repeat one (on)' : player.repeat === 'all' ? 'Repeat all (on)' : 'Repeat (off)'

  return (
    <div className="flex items-center justify-center gap-1 sm:gap-3">
      <button
        type="button"
        onClick={player.toggleShuffle}
        aria-pressed={player.shuffle}
        aria-label={player.shuffle ? 'Shuffle (on)' : 'Shuffle (off)'}
        title={player.shuffle ? 'Shuffle is on' : 'Shuffle'}
        className={`relative ${side} inline-flex items-center justify-center rounded-full transition-colors ${player.shuffle ? on : idle}`}
      >
        <IconShuffle className={icon} />
        {player.shuffle && <Dot dark={dark} />}
      </button>
      <button
        type="button"
        onClick={player.prev}
        aria-label="Previous quote"
        title="Previous"
        className={`${side} inline-flex items-center justify-center rounded-full ${idle}`}
      >
        <IconPrev className={icon} />
      </button>
      <button
        type="button"
        onClick={player.toggle}
        aria-label={player.playing ? 'Pause' : 'Play'}
        title={player.playing ? 'Pause' : 'Play'}
        disabled={!player.order.length}
        className={`${big} inline-flex items-center justify-center rounded-full transition-transform hover:scale-105 active:scale-95 disabled:opacity-40 ${
          ghost
            ? dark
              ? 'border border-white/40 text-white'
              : 'border border-gray-300 text-gray-800 hover:border-gray-500'
            : dark
              ? 'bg-white text-gray-900 shadow-md'
              : 'text-white shadow-md'
        }`}
        style={dark || ghost ? undefined : { background: 'var(--gh-green)' }}
      >
        {player.playing ? <IconPause className={bigIcon} /> : <IconPlay className={`${bigIcon} translate-x-[1px]`} />}
      </button>
      <button
        type="button"
        onClick={player.next}
        aria-label="Next quote"
        title="Next"
        className={`${side} inline-flex items-center justify-center rounded-full ${idle}`}
      >
        <IconNext className={icon} />
      </button>
      <button
        type="button"
        onClick={player.cycleRepeat}
        aria-pressed={player.repeat !== 'off'}
        aria-label={repeatLabel}
        title={player.repeat === 'one' ? 'Repeating this quote' : player.repeat === 'all' ? 'Repeating the playlist' : 'Repeat'}
        className={`relative ${side} inline-flex items-center justify-center rounded-full transition-colors ${player.repeat === 'off' ? idle : on}`}
      >
        <IconRepeat className={icon} />
        {player.repeat === 'one' && (
          <span
            className={`absolute top-0.5 right-0.5 min-w-[1rem] h-4 px-0.5 rounded-full text-[0.6rem] font-black leading-4 ${
              dark ? 'bg-[#7ee0a8] text-gray-900' : 'bg-[var(--gh-green)] text-white'
            }`}
          >
            1
          </span>
        )}
        {player.repeat !== 'off' && <Dot dark={dark} />}
      </button>
    </div>
  )
}

function Dot({ dark }: { dark: boolean }) {
  return (
    <span
      aria-hidden
      className={`absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ${dark ? 'bg-[#7ee0a8]' : 'bg-[var(--gh-green)]'}`}
    />
  )
}

/** How far through the current quote, as a bar. */
export function Progress({ player, tone = 'light' }: { player: WallPlayer; tone?: 'light' | 'dark' }) {
  const dark = tone === 'dark'
  const left = Math.max(0, Math.ceil(player.dwell * (1 - player.progress)))
  return (
    <div className="flex items-center gap-2 text-[0.7rem] tabular-nums">
      <span className={dark ? 'text-white/60' : 'text-gray-400'}>
        {player.order.length ? player.index + 1 : 0}/{player.order.length}
      </span>
      <div
        className={`relative flex-1 h-1 rounded-full overflow-hidden ${dark ? 'bg-white/20' : 'bg-gray-200'}`}
        role="progressbar"
        aria-label="Time on this quote"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(player.progress * 100)}
      >
        <div
          className={`absolute inset-y-0 left-0 rounded-full ${dark ? 'bg-white' : 'bg-[var(--gh-green)]'}`}
          style={{ width: `${player.progress * 100}%` }}
        />
      </div>
      <span className={dark ? 'text-white/60' : 'text-gray-400'}>{player.playing ? `${left}s` : `${player.dwell}s`}</span>
    </div>
  )
}

/** A playlist's tile: its colours, its emoji or the first letter of its name. */
export function Cover({
  cover,
  emoji,
  name,
  className = 'w-12 h-12 text-xl',
}: {
  cover: string
  emoji: string | null
  name: string
  className?: string
}) {
  return (
    <span
      aria-hidden
      className={`${className} shrink-0 inline-flex items-center justify-center rounded-md text-white font-black shadow-sm`}
      style={{ background: coverCss(cover) }}
    >
      {emoji || name.trim().charAt(0).toUpperCase() || '♪'}
    </span>
  )
}

// ── Add to playlist ──────────────────────────────────────────────────────────

/**
 * Every playlist this coach can add to, ticked where the quote already is. Tap
 * to add or take off; "New playlist" makes one with this quote already on it.
 */
export function AddToPlaylistSheet({
  quote,
  player,
  onClose,
}: {
  quote: WallQuote
  player: WallPlayer
  onClose: () => void
}) {
  useEscape(onClose)
  const mine = player.lib.playlists.filter((p) => p.editable)
  // What was tapped here; anything not tapped reads from the playlist itself,
  // so one made a moment ago shows ticked once the page catches up.
  const [tapped, setOn] = useState<Record<string, boolean>>({})
  const on: Record<string, boolean> = Object.fromEntries(
    mine.map((p) => [p.id, p.id in tapped ? tapped[p.id] : p.quoteIds.includes(quote.id)]),
  )
  const [name, setName] = useState('')
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState<string | null>(null)

  function flip(p: WallPlaylist) {
    const next = !on[p.id]
    setOn((o) => ({ ...o, [p.id]: next }))
    start(async () => {
      const r = next ? await addToWallPlaylist(p.id, quote.id) : await removeFromWallPlaylist(p.id, quote.id)
      if (!r.ok) {
        setOn((o) => ({ ...o, [p.id]: !next }))
        setMsg(r.error)
      } else {
        setMsg(next ? `Added to ${p.name}.` : `Taken off ${p.name}.`)
        player.refresh()
      }
    })
  }

  function create() {
    const n = name.trim()
    if (!n) return
    start(async () => {
      const r = await createWallPlaylist({ name: n, quoteIds: [quote.id] })
      if (!r.ok) setMsg(r.error)
      else {
        setName('')
        setMsg(`Made ${n} with this quote on it.`)
        player.refresh()
      }
    })
  }

  return (
    <Modal shape="card" label="Add to playlist" onClose={onClose}>
      <div className="flex flex-col max-h-[85dvh]">
        <div className="flex items-start gap-3 p-4 border-b border-gray-100">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black uppercase tracking-wider text-gray-400">Add to playlist</p>
            <p className="text-sm font-semibold text-gray-800 line-clamp-2 mt-0.5">&ldquo;{quote.line}&rdquo;</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1 text-gray-400 hover:text-gray-700">
            <IconClose />
          </button>
        </div>
        <div className="overflow-y-auto p-2">
          <form
            className="flex items-center gap-2 p-2"
            onSubmit={(e) => {
              e.preventDefault()
              create()
            }}
          >
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="New playlist — e.g. Game day, Grit, Defense"
              className="field !py-2 flex-1 min-w-0"
              maxLength={80}
              aria-label="New playlist name"
            />
            <button type="submit" disabled={pending || !name.trim()} className="btn btn-primary !py-2 !px-3 text-sm disabled:opacity-50">
              Create
            </button>
          </form>
          {mine.length === 0 ? (
            <p className="text-sm text-gray-500 px-3 py-4">No playlists yet — name one above and this quote goes on it.</p>
          ) : (
            <ul>
              {mine.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => flip(p)}
                    aria-pressed={!!on[p.id]}
                    className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-gray-50 text-left"
                  >
                    <Cover cover={p.cover} emoji={p.emoji} name={p.name} className="w-10 h-10 text-lg" />
                    <span className="min-w-0 flex-1">
                      <span className="block font-bold text-sm truncate">{p.name}</span>
                      <span className="block text-xs text-gray-500">
                        {p.quoteIds.length} quote{p.quoteIds.length === 1 ? '' : 's'}
                        {p.shared ? ' · staff' : ' · private'}
                      </span>
                    </span>
                    <span
                      aria-hidden
                      className={`w-6 h-6 rounded-full border-2 inline-flex items-center justify-center text-xs font-black ${
                        on[p.id] ? 'border-[var(--gh-green)] bg-[var(--gh-green)] text-white' : 'border-gray-300'
                      }`}
                    >
                      {on[p.id] ? '✓' : ''}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {msg && <p className="px-4 py-2 text-xs font-semibold text-gray-600 border-t border-gray-100" role="status">{msg}</p>}
      </div>
    </Modal>
  )
}

// ── Add or fix a quote ───────────────────────────────────────────────────────

export function QuoteDialog({
  player,
  editing,
  onClose,
  onSaved,
  intoPlaylist,
}: {
  player: WallPlayer
  /** A quote being fixed; left out, a new one is added. */
  editing?: WallQuote | null
  onClose: () => void
  /** The new quote, and the playlist it went on (if any), so the player can show it. */
  onSaved?: (id: string, playlistId: string | null) => void
  /** The playlist on screen, which a new quote goes on unless changed. Defaults to the one playing. */
  intoPlaylist?: string | null
}) {
  useEscape(onClose)
  const lists = player.lib.playlists.filter((p) => p.editable)
  const playing = lists.find((p) => p.id === (intoPlaylist === undefined ? player.source : intoPlaylist))
  const [line, setLine] = useState(editing?.line ?? '')
  const [who, setWho] = useState(editing?.who ?? '')
  const [target, setTarget] = useState<string>(editing ? '' : (playing?.id ?? ''))
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function submit() {
    start(async () => {
      const r = editing
        ? await editWallQuote(editing.id, { line, who })
        : await addWallQuote({ line, who, playlistId: target || null })
      if (!r.ok) {
        setError(r.error)
        return
      }
      player.refresh()
      if (r.id) onSaved?.(r.id, editing ? null : target || null)
      onClose()
    })
  }

  return (
    <Modal shape="card" label={editing ? 'Edit quote' : 'Add a quote'} onClose={onClose}>
      <form
        className="p-4 space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <div className="flex items-center justify-between">
          <p className="text-xs font-black uppercase tracking-wider text-gray-400">{editing ? 'Edit quote' : 'Add a quote'}</p>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1 text-gray-400 hover:text-gray-700">
            <IconClose />
          </button>
        </div>
        <div>
          <label className="field-label" htmlFor="wall-line">Quote</label>
          <textarea
            id="wall-line"
            autoFocus
            value={line}
            onChange={(e) => setLine(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit()
            }}
            rows={3}
            maxLength={600}
            placeholder="Stay ready, so you don’t have to get ready."
            className="field text-base"
          />
        </div>
        <div>
          <label className="field-label" htmlFor="wall-who">Who said it <span className="font-normal text-gray-400">(optional)</span></label>
          <input
            id="wall-who"
            value={who}
            onChange={(e) => setWho(e.target.value)}
            maxLength={120}
            placeholder="Coach, player, book…"
            className="field"
          />
        </div>
        {!editing && lists.length > 0 && (
          <div>
            <label className="field-label" htmlFor="wall-target">Also put it on</label>
            <select id="wall-target" value={target} onChange={(e) => setTarget(e.target.value)} className="field">
              <option value="">Just the library</option>
              {lists.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        )}
        {error && <p className="text-sm font-semibold text-[var(--gh-maroon)]" role="alert">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="btn btn-ghost">Cancel</button>
          <button type="submit" disabled={pending || !line.trim()} className="btn btn-primary disabled:opacity-50">
            {pending ? 'Saving…' : editing ? 'Save' : 'Add quote'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ── Make or change a playlist ────────────────────────────────────────────────

export function PlaylistDialog({
  player,
  editing,
  onClose,
  onSaved,
  onDeleted,
}: {
  player: WallPlayer
  editing?: WallPlaylist | null
  onClose: () => void
  onSaved?: (id: string) => void
  onDeleted?: () => void
}) {
  useEscape(onClose)
  const [name, setName] = useState(editing?.name ?? '')
  const [description, setDescription] = useState(editing?.description ?? '')
  const [cover, setCover] = useState<CoverKey>(editing?.cover ?? 'green')
  const [emoji, setEmoji] = useState<string>(editing?.emoji ?? '')
  const [shared, setShared] = useState(editing?.shared ?? true)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function submit() {
    start(async () => {
      const input = { name, description, cover, emoji, shared }
      const r = editing ? await updateWallPlaylist(editing.id, input) : await createWallPlaylist(input)
      if (!r.ok) {
        setError(r.error)
        return
      }
      player.refresh()
      if (r.id) onSaved?.(r.id)
      onClose()
    })
  }

  function remove() {
    if (!editing) return
    start(async () => {
      const r = await deleteWallPlaylist(editing.id)
      if (!r.ok) {
        setError(r.error)
        return
      }
      player.refresh()
      onDeleted?.()
      onClose()
    })
  }

  return (
    <Modal shape="dialog" label={editing ? 'Edit playlist' : 'New playlist'} onClose={onClose}>
      <form
        className="flex flex-col h-full sm:max-h-[inherit]"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <p className="text-xs font-black uppercase tracking-wider text-gray-400">{editing ? 'Edit playlist' : 'New playlist'}</p>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1 text-gray-400 hover:text-gray-700">
            <IconClose />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="flex items-center gap-4">
            <Cover cover={cover} emoji={emoji || null} name={name || 'P'} className="w-24 h-24 text-4xl rounded-xl" />
            <div className="min-w-0 flex-1 space-y-2">
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
                placeholder="Playlist name"
                aria-label="Playlist name"
                className="field text-lg font-black"
              />
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={300}
                rows={2}
                placeholder="What it’s for — e.g. the week before a rivalry game"
                aria-label="Description"
                className="field text-sm"
              />
            </div>
          </div>
          <div>
            <p className="field-label">Cover</p>
            <div className="flex flex-wrap gap-2">
              {COVERS.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => setCover(c.key)}
                  aria-label={c.label}
                  aria-pressed={cover === c.key}
                  title={c.label}
                  className={`w-9 h-9 rounded-full ring-offset-2 ${cover === c.key ? 'ring-2 ring-gray-900' : ''}`}
                  style={{ background: coverCss(c.key) }}
                />
              ))}
            </div>
          </div>
          <div>
            <p className="field-label">Icon</p>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setEmoji('')}
                aria-pressed={!emoji}
                className={`h-9 px-2 rounded-lg border text-xs font-bold ${!emoji ? 'border-gray-900' : 'border-gray-200 text-gray-500'}`}
              >
                Letter
              </button>
              {COVER_EMOJI.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setEmoji(e)}
                  aria-pressed={emoji === e}
                  className={`w-9 h-9 rounded-lg border text-lg ${emoji === e ? 'border-gray-900 bg-gray-50' : 'border-gray-200'}`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
          <label className="flex items-start gap-3 rounded-lg border border-gray-200 p-3 cursor-pointer">
            <input type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} className="mt-1" />
            <span>
              <span className="block font-bold text-sm">Share with the staff</span>
              <span className="block text-xs text-gray-500">
                Every coach can play it on their War Room wall. Only you can change it. Untick to keep it to yourself.
              </span>
            </span>
          </label>
          {error && <p className="text-sm font-semibold text-[var(--gh-maroon)]" role="alert">{error}</p>}
        </div>
        <div className="flex items-center gap-2 p-4 border-t border-gray-100">
          {editing &&
            (confirmDelete ? (
              <span className="flex items-center gap-2 text-sm">
                <span className="font-semibold">Delete it?</span>
                <button type="button" onClick={remove} disabled={pending} className="font-bold text-[var(--gh-maroon)]">Delete</button>
                <button type="button" onClick={() => setConfirmDelete(false)} className="font-bold text-gray-500">Keep it</button>
              </span>
            ) : (
              <button type="button" onClick={() => setConfirmDelete(true)} className="text-sm font-bold text-gray-400 hover:text-[var(--gh-maroon)]">
                Delete playlist
              </button>
            ))}
          <span className="flex-1" />
          <button type="button" onClick={onClose} className="btn btn-ghost">Cancel</button>
          <button type="submit" disabled={pending || !name.trim()} className="btn btn-primary disabled:opacity-50">
            {pending ? 'Saving…' : editing ? 'Save' : 'Create'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
