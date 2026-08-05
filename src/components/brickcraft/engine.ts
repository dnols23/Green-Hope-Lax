// BrickCraft game engine — pure simulation, no DOM and no React. The component
// owns a single `Game` object, calls `step()` once per animation frame, and
// draws whatever it finds. Everything runs in a fixed 800×560 logical field;
// the canvas scales that to whatever size it is on screen.

import { LEVELS } from './levels'
import type {
  Ball,
  Brick,
  BrickKind,
  FrameEvents,
  Game,
  Particle,
  Power,
  PowerKind,
} from './types'

export const FIELD = { w: 800, h: 560 } as const

const COLS = 11
const GRID = { top: 74, margin: 24, gap: 6, h: 26 } as const
const BRICK_W = (FIELD.w - GRID.margin * 2 - GRID.gap * (COLS - 1)) / COLS

const PADDLE = { baseW: 112, wideW: 176, h: 15, y: FIELD.h - 44 } as const
const BALL_R = 8
const BASE_SPEED = 360
const MAX_SPEED = 660
/** Every brick a ball breaks makes it a touch quicker. */
const SPEED_PER_HIT = 4
const LAUNCH_ANGLE = 0.35 // radians off vertical
const MAX_BOUNCE = 1.06 // ~61° — keeps the ball from ever going pure-horizontal
const POWER_FALL = 150
const POWER_CHANCE = 0.13
const EFFECT_SECONDS = 9
const START_LIVES = 3
const LEVEL_BONUS = 500
const LIFE_BONUS = 100

const SPEC: Record<Exclude<BrickKind, 'solid'>, { hp: number; points: number }> = {
  green: { hp: 1, points: 50 },
  maroon: { hp: 2, points: 80 },
  steel: { hp: 3, points: 120 },
}

export const BRICK_COLORS: Record<BrickKind, string> = {
  green: '#12b06a',
  maroon: '#b8394a',
  steel: '#c9a227',
  solid: '#5a6a60',
}

export const POWER_LABEL: Record<PowerKind, string> = {
  wide: 'Wide stick',
  multi: 'Multi-ball',
  slow: 'Slow-mo',
  life: 'Extra ball',
}

export const POWER_GLYPH: Record<PowerKind, string> = {
  wide: '↔',
  multi: '⁝⁝',
  slow: '◷',
  life: '+1',
}

export const LEVEL_COUNT = LEVELS.length

// ── Setup ────────────────────────────────────────────────────────────────────

function buildBricks(levelIndex: number): Brick[] {
  const rows = LEVELS[levelIndex].rows
  const bricks: Brick[] = []
  rows.forEach((row, r) => {
    for (let c = 0; c < COLS; c++) {
      const ch = row[c]
      if (!ch || ch === '.') continue
      const kind: BrickKind =
        ch === '1' ? 'green' : ch === '2' ? 'maroon' : ch === '3' ? 'steel' : 'solid'
      const spec = kind === 'solid' ? { hp: Infinity, points: 0 } : SPEC[kind]
      bricks.push({
        x: GRID.margin + c * (BRICK_W + GRID.gap),
        y: GRID.top + r * (GRID.h + GRID.gap),
        w: BRICK_W,
        h: GRID.h,
        kind,
        hp: spec.hp,
        points: spec.points,
        alive: true,
        flash: 0,
      })
    }
  })
  return bricks
}

function stuckBall(paddleX: number): Ball {
  return {
    x: paddleX,
    y: PADDLE.y - BALL_R - 1,
    vx: 0,
    vy: 0,
    r: BALL_R,
    stuck: true,
    trail: [],
  }
}

export function createGame(reducedMotion: boolean): Game {
  return {
    phase: 'ready',
    score: 0,
    lives: START_LIVES,
    levelIndex: 0,
    time: 0,
    speed: BASE_SPEED * LEVELS[0].tempo,
    bricks: buildBricks(0),
    balls: [stuckBall(FIELD.w / 2)],
    powers: [],
    particles: [],
    paddle: { x: FIELD.w / 2, y: PADDLE.y, w: PADDLE.baseW, h: PADDLE.h },
    wideUntil: 0,
    slowUntil: 0,
    toast: null,
    reducedMotion,
  }
}

/** Rack the next level (or the same one again after losing a ball). */
function loadLevel(g: Game, levelIndex: number) {
  g.levelIndex = levelIndex
  g.bricks = buildBricks(levelIndex)
  g.speed = BASE_SPEED * LEVELS[levelIndex].tempo
  resetBall(g)
  g.powers = []
  g.wideUntil = 0
  g.slowUntil = 0
}

function resetBall(g: Game) {
  g.paddle.x = FIELD.w / 2
  g.paddle.w = PADDLE.baseW
  g.balls = [stuckBall(g.paddle.x)]
  g.phase = 'ready'
}

export function advanceLevel(g: Game) {
  loadLevel(g, g.levelIndex + 1)
}

export function restart(g: Game) {
  g.score = 0
  g.lives = START_LIVES
  g.particles = []
  g.toast = null
  loadLevel(g, 0)
}

// ── Input ────────────────────────────────────────────────────────────────────

export function movePaddleTo(g: Game, x: number) {
  const half = g.paddle.w / 2
  g.paddle.x = clamp(x, half, FIELD.w - half)
  for (const b of g.balls) if (b.stuck) b.x = g.paddle.x
}

export function nudgePaddle(g: Game, dx: number) {
  movePaddleTo(g, g.paddle.x + dx)
}

export function launch(g: Game) {
  if (g.phase !== 'ready') return
  const dir = Math.random() < 0.5 ? -1 : 1
  for (const b of g.balls) {
    if (!b.stuck) continue
    b.stuck = false
    b.vx = g.speed * Math.sin(LAUNCH_ANGLE) * dir
    b.vy = -g.speed * Math.cos(LAUNCH_ANGLE)
  }
  g.phase = 'playing'
}

export function togglePause(g: Game) {
  if (g.phase === 'playing') g.phase = 'paused'
  else if (g.phase === 'paused') g.phase = 'playing'
}

// ── Simulation ───────────────────────────────────────────────────────────────

export function step(g: Game, dt: number): FrameEvents {
  const events: FrameEvents = { lostLife: false, cleared: false, ended: false }
  if (g.phase === 'paused' || g.phase === 'gameover' || g.phase === 'victory') return events

  g.time += dt
  decayEffects(g)
  updateParticles(g, dt)
  if (g.toast && g.time > g.toast.until) g.toast = null
  for (const b of g.bricks) if (b.flash > 0) b.flash = Math.max(0, b.flash - dt)

  if (g.phase === 'levelup') return events

  const slow = g.slowUntil > g.time ? 0.72 : 1

  for (const ball of g.balls) {
    if (ball.stuck) {
      ball.x = g.paddle.x
      ball.y = PADDLE.y - ball.r - 1
      continue
    }
    // Sub-step so a fast ball can't tunnel through a brick in one frame.
    const dist = Math.hypot(ball.vx, ball.vy) * dt * slow
    const steps = Math.max(1, Math.ceil(dist / (ball.r * 0.75)))
    for (let i = 0; i < steps; i++) moveBall(g, ball, (dt * slow) / steps)
    if (!g.reducedMotion) {
      ball.trail.push({ x: ball.x, y: ball.y })
      if (ball.trail.length > 9) ball.trail.shift()
    }
  }

  // Balls that fell past the endline.
  const survivors = g.balls.filter((b) => b.y - b.r < FIELD.h)
  if (survivors.length !== g.balls.length) g.balls = survivors

  if (g.balls.length === 0) {
    g.lives -= 1
    events.lostLife = true
    if (g.lives <= 0) {
      g.phase = 'gameover'
      events.ended = true
    } else {
      resetBall(g)
    }
    return events
  }

  updatePowers(g, dt)

  if (g.bricks.every((b) => !b.alive || b.kind === 'solid')) {
    g.score += LEVEL_BONUS + g.lives * LIFE_BONUS
    events.cleared = true
    if (g.levelIndex + 1 >= LEVELS.length) {
      g.phase = 'victory'
      events.ended = true
    } else {
      g.phase = 'levelup'
    }
  }

  return events
}

function moveBall(g: Game, ball: Ball, dt: number) {
  ball.x += ball.vx * dt
  ball.y += ball.vy * dt

  // Sidewalls and the top.
  if (ball.x - ball.r < 0) {
    ball.x = ball.r
    ball.vx = Math.abs(ball.vx)
  } else if (ball.x + ball.r > FIELD.w) {
    ball.x = FIELD.w - ball.r
    ball.vx = -Math.abs(ball.vx)
  }
  if (ball.y - ball.r < 0) {
    ball.y = ball.r
    ball.vy = Math.abs(ball.vy)
  }

  bounceOffPaddle(g, ball)

  for (const brick of g.bricks) {
    if (!brick.alive) continue
    if (!hitBrick(ball, brick)) continue
    brick.flash = 0.12
    if (brick.kind === 'solid') break

    brick.hp -= 1
    if (brick.hp <= 0) {
      brick.alive = false
      g.score += brick.points
      spawnDebris(g, brick)
      maybeDropPower(g, brick)
    } else {
      g.score += 10
    }
    // Each break winds the ball up a little, up to the cap.
    const speed = Math.min(MAX_SPEED, Math.hypot(ball.vx, ball.vy) + SPEED_PER_HIT)
    setSpeed(ball, speed)
    break // one brick per sub-step keeps bounces readable
  }
}

/** Circle-vs-rect. Bounces off the shallower axis and pushes the ball clear. */
function hitBrick(ball: Ball, b: Brick): boolean {
  const nx = clamp(ball.x, b.x, b.x + b.w)
  const ny = clamp(ball.y, b.y, b.y + b.h)
  const dx = ball.x - nx
  const dy = ball.y - ny
  if (dx * dx + dy * dy > ball.r * ball.r) return false

  const cx = b.x + b.w / 2
  const cy = b.y + b.h / 2
  const overlapX = b.w / 2 + ball.r - Math.abs(ball.x - cx)
  const overlapY = b.h / 2 + ball.r - Math.abs(ball.y - cy)

  if (overlapX < overlapY) {
    ball.vx = ball.x < cx ? -Math.abs(ball.vx) : Math.abs(ball.vx)
    ball.x += ball.x < cx ? -overlapX : overlapX
  } else {
    ball.vy = ball.y < cy ? -Math.abs(ball.vy) : Math.abs(ball.vy)
    ball.y += ball.y < cy ? -overlapY : overlapY
  }
  return true
}

/** Where the ball meets the stick head decides the angle — middle sends it
 *  straight back, the edges cut it hard to the side. */
function bounceOffPaddle(g: Game, ball: Ball) {
  const p = g.paddle
  if (ball.vy <= 0) return
  if (ball.y + ball.r < p.y || ball.y - ball.r > p.y + p.h) return
  if (ball.x + ball.r < p.x - p.w / 2 || ball.x - ball.r > p.x + p.w / 2) return

  const offset = clamp((ball.x - p.x) / (p.w / 2), -1, 1)
  const angle = offset * MAX_BOUNCE
  const speed = Math.min(MAX_SPEED, Math.hypot(ball.vx, ball.vy) + SPEED_PER_HIT)
  ball.vx = speed * Math.sin(angle)
  ball.vy = -speed * Math.cos(angle)
  ball.y = p.y - ball.r - 0.5
}

function setSpeed(ball: Ball, speed: number) {
  const current = Math.hypot(ball.vx, ball.vy) || 1
  ball.vx = (ball.vx / current) * speed
  ball.vy = (ball.vy / current) * speed
}

// ── Power-ups ────────────────────────────────────────────────────────────────

function maybeDropPower(g: Game, brick: Brick) {
  if (Math.random() > POWER_CHANCE) return
  const roll = Math.random()
  const kind: PowerKind = roll < 0.34 ? 'multi' : roll < 0.64 ? 'wide' : roll < 0.88 ? 'slow' : 'life'
  g.powers.push({ x: brick.x + brick.w / 2, y: brick.y + brick.h / 2, vy: POWER_FALL, kind })
}

function updatePowers(g: Game, dt: number) {
  const p = g.paddle
  const kept: Power[] = []
  for (const pw of g.powers) {
    pw.y += pw.vy * dt
    if (pw.y > FIELD.h + 20) continue
    const caught =
      pw.y + 10 >= p.y && pw.y - 10 <= p.y + p.h && Math.abs(pw.x - p.x) <= p.w / 2 + 10
    if (caught) {
      applyPower(g, pw.kind)
      continue
    }
    kept.push(pw)
  }
  g.powers = kept
}

function applyPower(g: Game, kind: PowerKind) {
  g.score += 25
  g.toast = { text: POWER_LABEL[kind], until: g.time + 1.6 }
  switch (kind) {
    case 'wide':
      g.wideUntil = g.time + EFFECT_SECONDS
      g.paddle.w = PADDLE.wideW
      movePaddleTo(g, g.paddle.x) // re-clamp: a wider head can overhang the sideline
      break
    case 'slow':
      g.slowUntil = g.time + EFFECT_SECONDS
      break
    case 'life':
      g.lives = Math.min(9, g.lives + 1)
      break
    case 'multi': {
      const source = g.balls.find((b) => !b.stuck) ?? g.balls[0]
      if (!source) break
      const speed = Math.hypot(source.vx, source.vy) || g.speed
      for (const spread of [-0.4, 0.4]) {
        const angle = Math.atan2(source.vy, source.vx) + spread
        g.balls.push({
          x: source.x,
          y: source.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          r: source.r,
          stuck: false,
          trail: [],
        })
      }
      break
    }
  }
}

function decayEffects(g: Game) {
  if (g.wideUntil && g.time > g.wideUntil) {
    g.wideUntil = 0
    g.paddle.w = PADDLE.baseW
    movePaddleTo(g, g.paddle.x)
  }
  if (g.slowUntil && g.time > g.slowUntil) g.slowUntil = 0
}

/** Seconds left on each timed effect, for the HUD. */
export function activeEffects(g: Game): { kind: PowerKind; left: number }[] {
  const out: { kind: PowerKind; left: number }[] = []
  if (g.wideUntil > g.time) out.push({ kind: 'wide', left: g.wideUntil - g.time })
  if (g.slowUntil > g.time) out.push({ kind: 'slow', left: g.slowUntil - g.time })
  return out
}

// ── Debris ───────────────────────────────────────────────────────────────────

function spawnDebris(g: Game, brick: Brick) {
  if (g.reducedMotion) return
  const color = BRICK_COLORS[brick.kind]
  for (let i = 0; i < 8; i++) {
    const angle = Math.random() * Math.PI * 2
    const speed = 60 + Math.random() * 150
    g.particles.push({
      x: brick.x + brick.w / 2,
      y: brick.y + brick.h / 2,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.5,
      maxLife: 0.5,
      color,
      size: 2 + Math.random() * 3,
    })
  }
}

function updateParticles(g: Game, dt: number) {
  if (g.particles.length === 0) return
  const kept: Particle[] = []
  for (const p of g.particles) {
    p.life -= dt
    if (p.life <= 0) continue
    p.vy += 520 * dt
    p.x += p.vx * dt
    p.y += p.vy * dt
    kept.push(p)
  }
  g.particles = kept
}

// ── Utils ────────────────────────────────────────────────────────────────────

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

export function levelName(index: number): string {
  return LEVELS[Math.min(index, LEVELS.length - 1)].name
}
