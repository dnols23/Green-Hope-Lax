'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { render } from './draw'
import {
  FIELD,
  LEVEL_COUNT,
  POWER_LABEL,
  advanceLevel,
  createGame,
  launch,
  levelName,
  movePaddleTo,
  nudgePaddle,
  restart,
  step,
  togglePause,
} from './engine'
import type { Game, Phase } from './types'

const HIGH_SCORE_KEY = 'brickcraft:high-score'
/** Pixels per second the stick slides under keyboard control. */
const KEY_SPEED = 620

type Hud = {
  score: number
  lives: number
  level: number
  phase: Phase
  wide: number
  slow: number
}

const INITIAL_HUD: Hud = { score: 0, lives: 3, level: 0, phase: 'ready', wide: 0, slow: 0 }

export default function BrickCraft() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const gameRef = useRef<Game | null>(null)
  const keysRef = useRef({ left: false, right: false })
  const hudRef = useRef<Hud>(INITIAL_HUD)

  const [hud, setHud] = useState<Hud>(INITIAL_HUD)
  const [high, setHigh] = useState(0)
  const [status, setStatus] = useState('')

  const focusCanvas = () => canvasRef.current?.focus()
  /** Buttons must not pull focus off the canvas — a blur pauses the game, which
   *  would immediately undo whatever the button just did. */
  const keepFocus = (e: React.MouseEvent) => e.preventDefault()

  // ── Boot: build the game, size the canvas, run the frame loop ──────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const game = createGame(reduced)
    gameRef.current = game

    const stored = Number(window.localStorage.getItem(HIGH_SCORE_KEY) ?? 0)
    let best = Number.isFinite(stored) ? stored : 0
    setHigh(best)

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const width = canvas.clientWidth || FIELD.w
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round((width * (FIELD.h / FIELD.w)) * dpr)
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(canvas)

    let raf = 0
    let last = 0

    const frame = (now: number) => {
      raf = window.requestAnimationFrame(frame)
      const dt = last ? Math.min(0.033, (now - last) / 1000) : 0
      last = now

      if (game.phase === 'playing' || game.phase === 'ready') {
        if (keysRef.current.left) nudgePaddle(game, -KEY_SPEED * dt)
        if (keysRef.current.right) nudgePaddle(game, KEY_SPEED * dt)
      }

      const events = step(game, dt)

      if (game.score > best) {
        best = game.score
        window.localStorage.setItem(HIGH_SCORE_KEY, String(best))
        setHigh(best)
      }
      if (events.lostLife) {
        setStatus(game.lives > 0 ? `Ball lost — ${game.lives} left` : 'Game over')
      } else if (events.cleared) {
        setStatus(
          game.phase === 'victory'
            ? `All ${LEVEL_COUNT} levels cleared. Final score ${game.score}.`
            : `Level cleared — ${levelName(game.levelIndex)} down`,
        )
      }

      const scale = canvas.width / FIELD.w
      ctx.setTransform(scale, 0, 0, scale, 0, 0)
      render(ctx, game)

      const next: Hud = {
        score: game.score,
        lives: game.lives,
        level: game.levelIndex,
        phase: game.phase,
        wide: Math.ceil(Math.max(0, game.wideUntil - game.time)),
        slow: Math.ceil(Math.max(0, game.slowUntil - game.time)),
      }
      const prev = hudRef.current
      if (
        next.score !== prev.score ||
        next.lives !== prev.lives ||
        next.level !== prev.level ||
        next.phase !== prev.phase ||
        next.wide !== prev.wide ||
        next.slow !== prev.slow
      ) {
        hudRef.current = next
        setHud(next)
      }
    }
    raf = window.requestAnimationFrame(frame)

    // Tabbing away mid-rally shouldn't cost a ball.
    const onHidden = () => {
      if (document.hidden && game.phase === 'playing') togglePause(game)
    }
    document.addEventListener('visibilitychange', onHidden)

    return () => {
      window.cancelAnimationFrame(raf)
      observer.disconnect()
      document.removeEventListener('visibilitychange', onHidden)
    }
  }, [])

  // ── Input ─────────────────────────────────────────────────────────────────

  /** Space/Enter does the obvious next thing, whatever state we're in. */
  const primaryAction = useCallback(() => {
    const game = gameRef.current
    if (!game) return
    switch (game.phase) {
      case 'ready':
        launch(game)
        break
      case 'levelup':
        advanceLevel(game)
        setStatus(`Level ${game.levelIndex + 1} — ${levelName(game.levelIndex)}`)
        break
      case 'gameover':
      case 'victory':
        restart(game)
        setStatus('New game')
        break
      case 'paused':
        togglePause(game)
        break
    }
  }, [])

  const onKeyDown = (e: React.KeyboardEvent<HTMLCanvasElement>) => {
    const game = gameRef.current
    if (!game) return
    switch (e.key) {
      case 'ArrowLeft':
      case 'a':
      case 'A':
        keysRef.current.left = true
        e.preventDefault()
        break
      case 'ArrowRight':
      case 'd':
      case 'D':
        keysRef.current.right = true
        e.preventDefault()
        break
      case ' ':
      case 'Enter':
        primaryAction()
        e.preventDefault()
        break
      case 'p':
      case 'P':
      case 'Escape':
        togglePause(game)
        e.preventDefault()
        break
    }
  }

  const onKeyUp = (e: React.KeyboardEvent<HTMLCanvasElement>) => {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keysRef.current.left = false
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keysRef.current.right = false
  }

  const pointToField = (clientX: number) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0) return null
    return ((clientX - rect.left) / rect.width) * FIELD.w
  }

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const game = gameRef.current
    if (!game || game.phase === 'paused') return
    const x = pointToField(e.clientX)
    if (x !== null) movePaddleTo(game, x)
  }

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const game = gameRef.current
    if (!game) return
    focusCanvas()
    const x = pointToField(e.clientX)
    if (x !== null && game.phase !== 'paused') movePaddleTo(game, x)
    primaryAction()
  }

  // Losing focus mid-rally pauses rather than letting the ball run unattended.
  const onBlur = () => {
    const game = gameRef.current
    keysRef.current.left = false
    keysRef.current.right = false
    if (game && game.phase === 'playing') togglePause(game)
  }

  const overlay = OVERLAYS[hud.phase]
  const effects = [
    hud.wide > 0 ? { label: POWER_LABEL.wide, left: hud.wide } : null,
    hud.slow > 0 ? { label: POWER_LABEL.slow, left: hud.slow } : null,
  ].filter(Boolean) as { label: string; left: number }[]

  return (
    <div>
      {/* Scoreboard */}
      <div className="card p-3 mb-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <Stat label="Score" value={hud.score.toLocaleString()} />
        <Stat label="Best" value={high.toLocaleString()} />
        <Stat
          label="Level"
          value={`${Math.min(hud.level + 1, LEVEL_COUNT)}/${LEVEL_COUNT} · ${levelName(hud.level)}`}
        />
        <div className="flex items-center gap-2">
          <span className="text-[0.65rem] font-extrabold uppercase tracking-[0.1em] text-gray-400">
            Balls
          </span>
          <span className="flex gap-1" aria-label={`${hud.lives} balls left`}>
            {Array.from({ length: Math.max(0, hud.lives) }).map((_, i) => (
              <span key={i} className="w-2.5 h-2.5 rounded-full bg-gray-300 ring-1 ring-gray-400" />
            ))}
          </span>
        </div>
        {effects.length > 0 && (
          <div className="flex items-center gap-2 ml-auto">
            {effects.map((e) => (
              <span
                key={e.label}
                className="badge"
                style={{ background: '#ecfdf5', color: 'var(--gh-green-dk)' }}
              >
                {e.label} {e.left}s
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Field */}
      <div className="relative rounded-xl overflow-hidden shadow-lg" style={{ background: '#04160d' }}>
        <canvas
          ref={canvasRef}
          tabIndex={0}
          role="application"
          aria-label="BrickCraft — clear the bricks with the lacrosse ball. Move the stick with the arrow keys or your pointer, press space to shoot."
          className="block w-full outline-none"
          style={{ aspectRatio: `${FIELD.w} / ${FIELD.h}`, touchAction: 'none', cursor: 'none' }}
          onKeyDown={onKeyDown}
          onKeyUp={onKeyUp}
          onPointerMove={onPointerMove}
          onPointerDown={onPointerDown}
          onBlur={onBlur}
        />

        {overlay && (
          // The panel itself ignores the pointer so the stick still tracks it
          // (and a tap anywhere on the field counts) while a message is up.
          <div className="absolute inset-0 flex items-center justify-center p-6 bg-black/55 backdrop-blur-[2px] pointer-events-none">
            <div className="text-center max-w-sm">
              <div
                className="text-[0.65rem] font-extrabold uppercase tracking-[0.18em] mb-1"
                style={{ color: '#f3c9cd' }}
              >
                {overlay.eyebrow}
              </div>
              <h2 className="text-white font-black text-2xl sm:text-3xl mb-2">
                {overlay.title(hud)}
              </h2>
              <p className="text-white/70 text-sm mb-4">{overlay.body(hud, high)}</p>
              <button
                type="button"
                className="btn btn-primary pointer-events-auto"
                onMouseDown={keepFocus}
                onClick={() => {
                  focusCanvas()
                  primaryAction()
                }}
              >
                {overlay.cta}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="btn btn-ghost !py-1.5 !px-3 text-xs"
          onMouseDown={keepFocus}
          onClick={() => {
            const game = gameRef.current
            if (game) togglePause(game)
            focusCanvas()
          }}
        >
          {hud.phase === 'paused' ? 'Resume' : 'Pause'}
        </button>
        <button
          type="button"
          className="btn btn-ghost !py-1.5 !px-3 text-xs"
          onMouseDown={keepFocus}
          onClick={() => {
            const game = gameRef.current
            if (game) restart(game)
            setStatus('New game')
            focusCanvas()
          }}
        >
          Restart
        </button>
        <p className="text-xs text-gray-500 ml-auto">
          Move: pointer, <kbd className="font-semibold">←</kbd> <kbd className="font-semibold">→</kbd>{' '}
          or <kbd className="font-semibold">A</kbd>/<kbd className="font-semibold">D</kbd> · Shoot:{' '}
          <kbd className="font-semibold">Space</kbd> · Pause: <kbd className="font-semibold">P</kbd>
        </p>
      </div>

      {/* Screen-reader running commentary. */}
      <p className="sr-only" role="status" aria-live="polite">
        {status}
      </p>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[0.65rem] font-extrabold uppercase tracking-[0.1em] text-gray-400">
        {label}
      </div>
      <div className="font-black tabular-nums">{value}</div>
    </div>
  )
}

type Overlay = {
  eyebrow: string
  title: (hud: Hud) => string
  body: (hud: Hud, high: number) => string
  cta: string
}

const OVERLAYS: Partial<Record<Phase, Overlay>> = {
  ready: {
    eyebrow: 'Face-off',
    title: (h) => (h.score === 0 ? 'BrickCraft' : 'Next ball'),
    body: (h) =>
      h.score === 0
        ? 'Clear every brick without letting the ball past the endline. Six levels, three balls, power-ups on the way down.'
        : `${levelName(h.level)} — ${h.lives} ball${h.lives === 1 ? '' : 's'} left. Line it up and shoot.`,
    cta: 'Shoot',
  },
  paused: {
    eyebrow: 'Timeout',
    title: () => 'Paused',
    body: () => 'The clock is stopped. Pick it back up whenever you’re ready.',
    cta: 'Resume',
  },
  levelup: {
    eyebrow: 'Level cleared',
    title: (h) => `${levelName(h.level)} — cleared`,
    body: (h) =>
      `Bonus banked for ${h.lives} ball${h.lives === 1 ? '' : 's'} in hand. Level ${
        Math.min(h.level + 2, LEVEL_COUNT)
      } is racked and it comes faster.`,
    cta: 'Next level',
  },
  gameover: {
    eyebrow: 'Endline',
    title: () => 'Game over',
    body: (h, high) =>
      h.score >= high
        ? `New best: ${h.score.toLocaleString()} points. Nice run.`
        : `${h.score.toLocaleString()} points — best is ${high.toLocaleString()}.`,
    cta: 'Play again',
  },
  victory: {
    eyebrow: 'Championship',
    title: () => 'All six levels cleared',
    body: (h) => `${h.score.toLocaleString()} points and the whole board is empty. That’s a title.`,
    cta: 'Run it back',
  },
}
