'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ALL_SOURCE, LIKED_SOURCE, type WallLibrary } from '@/lib/wallModel'
import { useWallPlayer } from './useWallPlayer'
import { AddToPlaylistSheet, Progress, QuoteDialog, Transport } from './PlayerBits'
import { WallMode } from './WallMode'
import { IconAddToList, IconExpand, IconHeart, IconPlus } from './icons'

/**
 * On the wall, in the War Room: today's quote, and a player behind it.
 *
 * Before anybody presses play it is the same quote for the whole staff all day.
 * Press play and it runs through the playlist picked above it — shuffle, repeat,
 * a heart, add it to a playlist, add a new one — without leaving the War Room.
 */
export function WallPanel({ lib, today }: { lib: WallLibrary; today: string }) {
  const player = useWallPlayer(lib, today)
  const [sheet, setSheet] = useState<'add' | 'new' | 'wall' | null>(null)
  const q = player.quote
  const liked = q ? player.isLiked(q.id) : false

  return (
    <div className="min-w-0">
      <div className="flex items-center gap-2 mb-3">
        <label className="sr-only" htmlFor="wall-source">Playing from</label>
        <select
          id="wall-source"
          value={player.source}
          onChange={(e) => player.playSource(e.target.value, null, player.playing)}
          className="field !py-1 !pl-2 !pr-7 text-xs font-bold min-w-0 flex-1"
        >
          <option value={ALL_SOURCE}>▶ All quotes</option>
          {lib.ready && <option value={LIKED_SOURCE}>♥ Liked quotes</option>}
          {lib.playlists.map((p) => (
            <option key={p.id} value={p.id}>
              {p.emoji ? `${p.emoji} ` : '♪ '}
              {p.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setSheet('wall')}
          aria-label="Wall mode — full screen"
          title="Wall mode — full screen for the TV"
          className="w-8 h-8 shrink-0 inline-flex items-center justify-center rounded-full text-gray-500 hover:text-gray-900 hover:bg-gray-100"
        >
          <IconExpand className="w-4 h-4" />
        </button>
        <Link
          href="/admin/wall"
          className="shrink-0 text-xs font-bold px-2 py-1 rounded-full border border-gray-200 text-gray-500 hover:border-[var(--gh-green)] hover:text-[var(--gh-green)]"
        >
          Library
        </Link>
      </div>

      {q ? (
        <blockquote key={q.id} className="animate-[wallIn_400ms_ease-out] min-h-[4.5rem]">
          <p className="text-base font-semibold leading-snug">&ldquo;{q.line}&rdquo;</p>
          {q.who && <footer className="text-xs text-gray-500 mt-1">— {q.who}</footer>}
        </blockquote>
      ) : (
        <p className="text-sm text-gray-500 min-h-[4.5rem]">
          Nothing here yet. {player.source === LIKED_SOURCE ? 'Heart a quote and it lands here.' : 'Add a quote to this playlist.'}
        </p>
      )}

      <div className="mt-3">
        <Progress player={player} />
      </div>

      <div className="mt-2 flex items-center gap-1">
        {lib.ready && q && (
          <button
            type="button"
            onClick={() => player.like(q.id)}
            aria-pressed={liked}
            aria-label={liked ? 'Unlike' : 'Like'}
            title={liked ? 'Liked' : 'Like'}
            className={`w-8 h-8 shrink-0 inline-flex items-center justify-center rounded-full ${
              liked ? 'text-[var(--gh-maroon)]' : 'text-gray-400 hover:text-gray-800'
            }`}
          >
            <IconHeart filled={liked} className="w-[18px] h-[18px]" />
          </button>
        )}
        <div className="flex-1 min-w-0">
          <Transport player={player} size="sm" />
        </div>
        {lib.ready && (
          <>
            {q && (
              <button
                type="button"
                onClick={() => setSheet('add')}
                aria-label="Add to playlist"
                title="Add to playlist"
                className="w-8 h-8 shrink-0 inline-flex items-center justify-center rounded-full text-gray-400 hover:text-gray-800"
              >
                <IconAddToList className="w-[18px] h-[18px]" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setSheet('new')}
              aria-label="Add a new quote"
              title="Add a new quote"
              className="w-8 h-8 shrink-0 inline-flex items-center justify-center rounded-full text-gray-400 hover:text-gray-800"
            >
              <IconPlus className="w-[18px] h-[18px]" />
            </button>
          </>
        )}
      </div>

      {!lib.ready && (
        <p className="mt-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-2 py-1.5">
          Run <code>supabase/migrations/0040_wall.sql</code> to add quotes, make playlists and heart the good ones.
        </p>
      )}
      {player.error && (
        <p className="mt-2 text-xs font-semibold text-[var(--gh-maroon)]" role="alert">
          {player.error}{' '}
          <button type="button" onClick={player.clearError} className="underline">OK</button>
        </p>
      )}

      {sheet === 'add' && q && <AddToPlaylistSheet quote={q} player={player} onClose={() => setSheet(null)} />}
      {sheet === 'new' && (
        <QuoteDialog
          player={player}
          onClose={() => setSheet(null)}
          onSaved={(id, list) => player.playSource(list ?? ALL_SOURCE, id, false)}
        />
      )}
      {sheet === 'wall' && <WallMode player={player} onClose={() => setSheet(null)} />}
    </div>
  )
}
