'use client'

import { useEffect, useRef, useState } from 'react'
import { coverCss } from '@/lib/wallModel'
import type { WallPlayer } from './useWallPlayer'
import { Progress, Transport } from './PlayerBits'
import { IconClose, IconHeart } from './icons'

/**
 * The wall, the whole screen.
 *
 * For the TV in the locker room or the projector before film: one quote, huge,
 * on the playlist's colours, playing through on its own. The controls fade out
 * after a few seconds so the room reads the quote, not the buttons, and come
 * back on any touch or mouse move.
 *
 * Keys: space play/pause · ← → back/next · S shuffle · R repeat · L like · Esc.
 */
export function WallMode({ player, onClose }: { player: WallPlayer; onClose: () => void }) {
  const root = useRef<HTMLDivElement>(null)
  const [awake, setAwake] = useState(true)
  const timer = useRef<number | null>(null)

  function wake() {
    setAwake(true)
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setAwake(false), 3500)
  }

  // Keys, the real fullscreen where the browser allows it, and the page kept
  // still behind.
  const playerRef = useRef(player)
  const closeRef = useRef(onClose)
  useEffect(() => {
    playerRef.current = player
    closeRef.current = onClose
  }, [player, onClose])
  useEffect(() => {
    const el = root.current
    el?.requestFullscreen?.().catch(() => {})
    const body = document.body
    const was = body.style.overflow
    body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      const p = playerRef.current
      const k = e.key.toLowerCase()
      if (k === 'escape') closeRef.current()
      else if (k === ' ' || k === 'k') p.toggle()
      else if (k === 'arrowright') p.next()
      else if (k === 'arrowleft') p.prev()
      else if (k === 's') p.toggleShuffle()
      else if (k === 'r') p.cycleRepeat()
      else if (k === 'l' && p.quote) p.like(p.quote.id)
      else return
      e.preventDefault()
    }
    const onFs = () => {
      if (!document.fullscreenElement) closeRef.current()
    }
    window.addEventListener('keydown', onKey)
    document.addEventListener('fullscreenchange', onFs)
    const t = window.setTimeout(() => setAwake(false), 3500)
    return () => {
      window.clearTimeout(t)
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('fullscreenchange', onFs)
      body.style.overflow = was
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    }
  }, [])

  const playlist = player.lib.playlists.find((p) => p.id === player.source)
  const q = player.quote
  const long = (q?.line.length ?? 0) > 140
  const liked = q ? player.isLiked(q.id) : false

  return (
    <div
      ref={root}
      role="dialog"
      aria-modal="true"
      aria-label="Wall mode"
      onMouseMove={wake}
      onTouchStart={wake}
      onClick={wake}
      className="fixed inset-0 z-[80] flex flex-col text-white select-none"
      style={{
        background: coverCss(playlist?.cover ?? 'night'),
        cursor: awake ? 'default' : 'none',
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <div className={`flex items-center gap-3 p-4 sm:p-6 transition-opacity duration-500 ${awake ? 'opacity-100' : 'opacity-0'}`}>
        <p className="text-xs sm:text-sm font-black uppercase tracking-[0.2em] text-white/70 truncate flex-1">
          On the wall · {player.sourceLabel}
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Leave wall mode"
          className="w-10 h-10 inline-flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
        >
          <IconClose />
        </button>
      </div>

      <div className="flex-1 flex items-center justify-center px-6 sm:px-16">
        {q ? (
          <blockquote key={q.id} className="max-w-5xl text-center animate-[wallIn_600ms_ease-out]">
            <p
              className={`font-black leading-[1.08] tracking-tight ${
                long ? 'text-3xl sm:text-5xl lg:text-6xl' : 'text-4xl sm:text-6xl lg:text-7xl'
              }`}
            >
              &ldquo;{q.line}&rdquo;
            </p>
            {q.who && <footer className="mt-6 sm:mt-10 text-lg sm:text-2xl font-semibold text-white/75">— {q.who}</footer>}
          </blockquote>
        ) : (
          <p className="text-2xl font-bold text-white/70">Nothing on this playlist yet.</p>
        )}
      </div>

      <div className={`p-4 sm:p-8 transition-opacity duration-500 ${awake ? 'opacity-100' : 'opacity-0'}`}>
        <div className="max-w-xl mx-auto space-y-4">
          <Progress player={player} tone="dark" />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => q && player.like(q.id)}
              aria-pressed={liked}
              aria-label={liked ? 'Unlike' : 'Like'}
              className={`w-10 h-10 inline-flex items-center justify-center rounded-full ${liked ? 'text-[#ff7a8a]' : 'text-white/70 hover:text-white'}`}
            >
              <IconHeart filled={liked} />
            </button>
            <div className="flex-1">
              <Transport player={player} size="lg" tone="dark" />
            </div>
            <span className="w-10" />
          </div>
          <p className="hidden sm:block text-center text-xs text-white/40">
            Space play · ← → back / next · S shuffle · R repeat · L like · Esc leave
          </p>
        </div>
      </div>
    </div>
  )
}
