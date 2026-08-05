// Canvas rendering for BrickCraft. Everything draws in the 800×560 logical
// field; the component applies the device-pixel-ratio scale before calling in.

import { BRICK_COLORS, FIELD, POWER_GLYPH } from './engine'
import type { Ball, Brick, Game, Paddle, Power } from './types'

export function render(ctx: CanvasRenderingContext2D, g: Game) {
  drawField(ctx)
  for (const b of g.bricks) if (b.alive) drawBrick(ctx, b)
  for (const p of g.powers) drawPower(ctx, p)
  drawParticles(ctx, g)
  drawPaddle(ctx, g.paddle, g.wideUntil > g.time)
  for (const b of g.balls) drawBall(ctx, b, g.slowUntil > g.time)
}

// ── Field ────────────────────────────────────────────────────────────────────

function drawField(ctx: CanvasRenderingContext2D) {
  const grad = ctx.createLinearGradient(0, 0, 0, FIELD.h)
  grad.addColorStop(0, '#04160d')
  grad.addColorStop(0.55, '#062616')
  grad.addColorStop(1, '#03110a')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, FIELD.w, FIELD.h)

  // Mowed stripes, the way a game field reads from the stands.
  ctx.fillStyle = 'rgba(255,255,255,0.018)'
  for (let x = 0; x < FIELD.w; x += 100) ctx.fillRect(x, 0, 50, FIELD.h)

  ctx.strokeStyle = 'rgba(255,255,255,0.07)'
  ctx.lineWidth = 2

  // Restraining line across the middle.
  ctx.beginPath()
  ctx.moveTo(0, FIELD.h * 0.52)
  ctx.lineTo(FIELD.w, FIELD.h * 0.52)
  ctx.stroke()

  // Crease behind the stick head.
  ctx.beginPath()
  ctx.arc(FIELD.w / 2, FIELD.h - 6, 92, Math.PI, Math.PI * 2)
  ctx.stroke()

  // Endline the ball dies on.
  ctx.strokeStyle = 'rgba(184,57,74,0.5)'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(0, FIELD.h - 1.5)
  ctx.lineTo(FIELD.w, FIELD.h - 1.5)
  ctx.stroke()
}

// ── Bricks ───────────────────────────────────────────────────────────────────

function drawBrick(ctx: CanvasRenderingContext2D, b: Brick) {
  const base = BRICK_COLORS[b.kind]
  roundRect(ctx, b.x, b.y, b.w, b.h, 5)
  ctx.fillStyle = base
  ctx.fill()

  // Top highlight / bottom shadow give the brick some depth.
  ctx.save()
  ctx.clip()
  ctx.fillStyle = 'rgba(255,255,255,0.22)'
  ctx.fillRect(b.x, b.y, b.w, 4)
  ctx.fillStyle = 'rgba(0,0,0,0.28)'
  ctx.fillRect(b.x, b.y + b.h - 5, b.w, 5)

  if (b.kind === 'solid') {
    // Hatching marks the bricks that never break.
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'
    ctx.lineWidth = 2
    for (let x = b.x - b.h; x < b.x + b.w; x += 8) {
      ctx.beginPath()
      ctx.moveTo(x, b.y + b.h)
      ctx.lineTo(x + b.h, b.y)
      ctx.stroke()
    }
  } else if (b.hp < startingHp(b)) {
    // Cracks deepen as a brick takes hits.
    ctx.fillStyle = 'rgba(0,0,0,0.3)'
    ctx.fillRect(b.x, b.y, b.w, b.h)
    ctx.strokeStyle = 'rgba(0,0,0,0.45)'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(b.x + b.w * 0.3, b.y)
    ctx.lineTo(b.x + b.w * 0.45, b.y + b.h)
    ctx.moveTo(b.x + b.w * 0.72, b.y)
    ctx.lineTo(b.x + b.w * 0.6, b.y + b.h)
    ctx.stroke()
  }

  if (b.flash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${(b.flash / 0.12) * 0.55})`
    ctx.fillRect(b.x, b.y, b.w, b.h)
  }
  ctx.restore()
}

function startingHp(b: Brick): number {
  return b.kind === 'green' ? 1 : b.kind === 'maroon' ? 2 : 3
}

// ── Stick head ───────────────────────────────────────────────────────────────

function drawPaddle(ctx: CanvasRenderingContext2D, p: Paddle, wide: boolean) {
  const left = p.x - p.w / 2
  const right = p.x + p.w / 2
  const inset = 9

  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.5)'
  ctx.shadowBlur = 10
  ctx.shadowOffsetY = 3

  // A crosse head: wide at the scoop, tapering into the throat.
  ctx.beginPath()
  ctx.moveTo(left, p.y)
  ctx.lineTo(right, p.y)
  ctx.lineTo(right - inset, p.y + p.h)
  ctx.lineTo(left + inset, p.y + p.h)
  ctx.closePath()

  const grad = ctx.createLinearGradient(0, p.y, 0, p.y + p.h)
  grad.addColorStop(0, wide ? '#f2d06a' : '#e9edea')
  grad.addColorStop(1, wide ? '#c9a227' : '#9aa39d')
  ctx.fillStyle = grad
  ctx.fill()
  ctx.restore()

  // Mesh pocket.
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(left, p.y)
  ctx.lineTo(right, p.y)
  ctx.lineTo(right - inset, p.y + p.h)
  ctx.lineTo(left + inset, p.y + p.h)
  ctx.closePath()
  ctx.clip()
  ctx.strokeStyle = 'rgba(0,0,0,0.22)'
  ctx.lineWidth = 1
  for (let x = left - p.h; x < right + p.h; x += 9) {
    ctx.beginPath()
    ctx.moveTo(x, p.y + p.h)
    ctx.lineTo(x + p.h, p.y)
    ctx.stroke()
  }
  ctx.restore()

  // Maroon sidewall along the scoop.
  ctx.strokeStyle = '#7A1F2B'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(left, p.y + 1.5)
  ctx.lineTo(right, p.y + 1.5)
  ctx.stroke()
}

// ── Ball ─────────────────────────────────────────────────────────────────────

function drawBall(ctx: CanvasRenderingContext2D, b: Ball, slowed: boolean) {
  for (let i = 0; i < b.trail.length; i++) {
    const t = b.trail[i]
    ctx.fillStyle = `rgba(255,255,255,${(i / b.trail.length) * 0.16})`
    ctx.beginPath()
    ctx.arc(t.x, t.y, b.r * (0.4 + (i / b.trail.length) * 0.5), 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.save()
  ctx.shadowColor = slowed ? 'rgba(120,200,255,0.9)' : 'rgba(255,255,255,0.6)'
  ctx.shadowBlur = 12
  const grad = ctx.createRadialGradient(b.x - b.r * 0.35, b.y - b.r * 0.35, 1, b.x, b.y, b.r)
  grad.addColorStop(0, '#ffffff')
  grad.addColorStop(1, slowed ? '#9ed4ff' : '#d3d8d4')
  ctx.fillStyle = grad
  ctx.beginPath()
  ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

// ── Power-ups & debris ───────────────────────────────────────────────────────

function drawPower(ctx: CanvasRenderingContext2D, p: Power) {
  const size = 22
  roundRect(ctx, p.x - size / 2, p.y - size / 2, size, size, 6)
  ctx.fillStyle = p.kind === 'life' ? '#b8394a' : '#0f8f57'
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.85)'
  ctx.lineWidth = 2
  ctx.stroke()

  ctx.fillStyle = '#fff'
  ctx.font = '800 11px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(POWER_GLYPH[p.kind], p.x, p.y + 0.5)
}

function drawParticles(ctx: CanvasRenderingContext2D, g: Game) {
  for (const p of g.particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife)
    ctx.fillStyle = p.color
    ctx.fillRect(p.x, p.y, p.size, p.size)
  }
  ctx.globalAlpha = 1
}

// ── Utils ────────────────────────────────────────────────────────────────────

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rad = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rad, y)
  ctx.lineTo(x + w - rad, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + rad)
  ctx.lineTo(x + w, y + h - rad)
  ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h)
  ctx.lineTo(x + rad, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - rad)
  ctx.lineTo(x, y + rad)
  ctx.quadraticCurveTo(x, y, x + rad, y)
  ctx.closePath()
}
