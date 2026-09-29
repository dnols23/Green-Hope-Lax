// The arithmetic behind the board's lines and shapes, in field yards.
//
// Pure functions only — no React, no DOM — so the editor, the read-only views
// and the picture export all draw a line from the same numbers.

import { pathLook, type BoardPath, type BoardText, type LinePattern } from '@/lib/planner'

export type Pt = { x: number; y: number }
export type Box = { x: number; y: number; w: number; h: number }

export const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y)

const r2 = (n: number) => Math.round(n * 100) / 100
/* The coach's own points go into the path exactly as stored, so a line drawn
   before any of this draws to the pixel as it always did. Only points this
   file makes up (a wave, a curve's handles) are rounded. */
const fmt = (p: Pt) => `${p.x} ${p.y}`

/** Turn a point about a centre, clockwise in screen terms (y runs down). */
export function rotatePt(p: Pt, c: Pt, deg: number): Pt {
  if (!deg) return p
  const a = (deg * Math.PI) / 180
  const cos = Math.cos(a)
  const sin = Math.sin(a)
  const dx = p.x - c.x
  const dy = p.y - c.y
  return { x: c.x + dx * cos - dy * sin, y: c.y + dx * sin + dy * cos }
}

/** The box round some points. */
export function boxOf(points: Pt[]): Box {
  if (!points.length) return { x: 0, y: 0, w: 0, h: 0 }
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const p of points) {
    if (p.x < x0) x0 = p.x
    if (p.y < y0) y0 = p.y
    if (p.x > x1) x1 = p.x
    if (p.y > y1) y1 = p.y
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
}

export function unionBox(boxes: Box[]): Box | null {
  if (!boxes.length) return null
  return boxOf(boxes.flatMap((b) => [{ x: b.x, y: b.y }, { x: b.x + b.w, y: b.y + b.h }]))
}

/** A box turned about its own middle, and the box that then holds it. */
export function turnedBox(b: Box, deg: number): Box {
  if (!deg) return b
  const c = { x: b.x + b.w / 2, y: b.y + b.h / 2 }
  return boxOf(
    [
      { x: b.x, y: b.y },
      { x: b.x + b.w, y: b.y },
      { x: b.x + b.w, y: b.y + b.h },
      { x: b.x, y: b.y + b.h },
    ].map((p) => rotatePt(p, c, deg)),
  )
}

export const boxesTouch = (a: Box, b: Box) =>
  a.x <= b.x + b.w && b.x <= a.x + a.w && a.y <= b.y + b.h && b.y <= a.y + a.h

export const boxInside = (inner: Box, outer: Box) =>
  inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.w <= outer.x + outer.w && inner.y + inner.h <= outer.y + outer.h

/** Distance from a point to a segment — what "near the line" means for a finger. */
export function distToSegment(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = dx * dx + dy * dy
  if (!len) return dist(p, a)
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len))
  return dist(p, { x: a.x + t * dx, y: a.y + t * dy })
}

/**
 * Fewer points, same line (Ramer–Douglas–Peucker). A scribble comes in as a
 * point every half yard, wobble and all; this keeps the corners that mean
 * something and drops the rest, so the smoothed curve through what is left is
 * the line the coach meant rather than the one his finger drew.
 */
export function simplify(points: Pt[], tolerance: number): Pt[] {
  if (points.length <= 2) return points
  const keep = new Array<boolean>(points.length).fill(false)
  keep[0] = true
  keep[points.length - 1] = true
  const stack: [number, number][] = [[0, points.length - 1]]
  while (stack.length) {
    const [a, b] = stack.pop()!
    let far = -1
    let farD = tolerance
    for (let i = a + 1; i < b; i++) {
      const d = distToSegment(points[i], points[a], points[b])
      if (d > farD) {
        far = i
        farD = d
      }
    }
    if (far > 0) {
      keep[far] = true
      stack.push([a, far], [far, b])
    }
  }
  return points.filter((_, i) => keep[i])
}

/** Bezier control points for a smooth curve through every point (Catmull-Rom). */
function controls(points: Pt[], i: number, closed: boolean): [Pt, Pt] {
  const n = points.length
  const at = (k: number) => (closed ? points[(k + n) % n] : points[Math.max(0, Math.min(n - 1, k))])
  const p0 = at(i - 1)
  const p1 = at(i)
  const p2 = at(i + 1)
  const p3 = at(i + 2)
  return [
    { x: r2(p1.x + (p2.x - p0.x) / 6), y: r2(p1.y + (p2.y - p0.y) / 6) },
    { x: r2(p2.x - (p3.x - p1.x) / 6), y: r2(p2.y - (p3.y - p1.y) / 6) },
  ]
}

export function polyD(points: Pt[], closed = false): string {
  if (!points.length) return ''
  return `M ${points.map(fmt).join(' L ')}${closed ? ' Z' : ''}`
}

/** A smooth curve through the points, as an SVG path. */
export function smoothD(points: Pt[], closed = false): string {
  if (points.length < 3) return polyD(points, closed)
  const n = points.length
  let d = `M ${fmt(points[0])}`
  const segs = closed ? n : n - 1
  for (let i = 0; i < segs; i++) {
    const [c1, c2] = controls(points, i, closed)
    d += ` C ${fmt(c1)} ${fmt(c2)} ${fmt(points[(i + 1) % n])}`
  }
  return closed ? `${d} Z` : d
}

/** The curve as a dense run of points — for hit tests, boxes and patterns. */
export function sampleLine(points: Pt[], curve: boolean): Pt[] {
  if (!curve || points.length < 3) return points
  const out: Pt[] = [points[0]]
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i]
    const p2 = points[i + 1]
    const [c1, c2] = controls(points, i, false)
    const steps = Math.max(4, Math.ceil(dist(p1, p2) / 0.4))
    for (let s = 1; s <= steps; s++) {
      const t = s / steps
      const u = 1 - t
      out.push({
        x: u * u * u * p1.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * p2.x,
        y: u * u * u * p1.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * p2.y,
      })
    }
  }
  return out
}

/** Points every `step` yards along a run of points, the last one included. */
function resample(points: Pt[], step: number): { pts: Pt[]; length: number } {
  const pts: Pt[] = [points[0]]
  let carry = 0
  let length = 0
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]
    const b = points[i + 1]
    const seg = dist(a, b)
    length += seg
    let t = step - carry
    while (t <= seg) {
      pts.push({ x: a.x + ((b.x - a.x) * t) / seg, y: a.y + ((b.y - a.y) * t) / seg })
      t += step
    }
    carry = seg - (t - step)
  }
  const last = points[points.length - 1]
  if (dist(pts[pts.length - 1], last) > step * 0.05) pts.push(last)
  return { pts, length }
}

/**
 * A wave or a zig-zag laid along the line.
 *
 * It eases in over the first half wave and stops a little short of the end,
 * so the arrowhead sits on a straight bit and points where the line is going
 * rather than wherever the last wiggle happened to face.
 */
export function patternD(points: Pt[], curve: boolean, pattern: LinePattern, width: number): string {
  const line = sampleLine(points, curve)
  // A wave is long and low; a zig-zag is tighter, so its corners read as corners.
  const amp = pattern === 'wavy' ? 0.55 + width * 0.6 : 0.45 + width * 0.5
  const wave = pattern === 'wavy' ? 3.6 + width * 2 : 2.2 + width * 1.5
  // A zig-zag is its corners, a quarter wave apart; a wave is traced finely
  // enough that the eye sees a sine rather than the points it was made from.
  const per = pattern === 'wavy' ? 16 : 4
  const { pts, length } = resample(line, wave / per)
  if (length < wave) return curve ? smoothD(points) : polyD(points)
  const tail = wave * 0.6
  const out: Pt[] = []
  for (let i = 0; i < pts.length; i++) {
    const s = (i * wave) / per
    const p = pts[i]
    if (i === 0 || s > length - tail || i === pts.length - 1) {
      out.push(p)
      continue
    }
    const prev = pts[i - 1]
    const next = pts[i + 1]
    const dx = next.x - prev.x
    const dy = next.y - prev.y
    const len = Math.hypot(dx, dy) || 1
    const ease = Math.min(1, s / (wave / 2))
    // Quarter waves for a zig-zag: 0, +1, 0, −1 — its corners.
    const phase = pattern === 'wavy' ? Math.sin((2 * Math.PI * i) / per) : [0, 1, 0, -1][i % 4]
    const off = phase * amp * ease
    out.push({ x: r2(p.x - (dy / len) * off), y: r2(p.y + (dx / len) * off) })
  }
  return polyD(out)
}

/** The SVG path a line draws. */
export function pathD(path: BoardPath): string {
  const look = pathLook(path)
  if (look.pattern) return patternD(path.points, look.curve, look.pattern, look.width)
  return look.curve ? smoothD(path.points) : polyD(path.points)
}

// ── Words ───────────────────────────────────────────────────────────────────

/*
 * How wide a line of words is, without a browser to ask. Measured widths would
 * need the text on the glass first, and the picture export and a server render
 * have none; an estimate by letter is within a few per cent for the calls a
 * coach writes, which is all a highlight or a selection box needs.
 */
const NARROW = new Set("iljtf.,:;'|!()[]1 ")
const WIDE = new Set('MWmw@%')
function charWidth(ch: string): number {
  if (NARROW.has(ch)) return 0.3
  if (WIDE.has(ch)) return 0.86
  if (/[A-Z]/.test(ch)) return 0.68
  if (/[0-9]/.test(ch)) return 0.56
  return 0.54
}

export function lineWidth(line: string, t: Pick<BoardText, 'size' | 'bold' | 'font'>): number {
  if (t.font === 'mono') return line.length * 0.6 * t.size
  let w = 0
  for (const ch of line) w += charWidth(ch)
  const face = t.font === 'condensed' ? 0.82 : t.font === 'serif' ? 0.98 : 1
  return w * t.size * face * (t.bold ? 1.08 : 1)
}

export const LINE_HEIGHT = 1.2

export function textLines(text: string): string[] {
  return text.split('\n')
}

/**
 * The box a word takes up before it is turned: the first line's baseline is
 * at the text's own y, the way it has always been drawn.
 */
export function textBox(t: BoardText): Box {
  const lines = textLines(t.text)
  const w = Math.max(t.size * 0.5, ...lines.map((l) => lineWidth(l, t)))
  const align = t.align ?? 'middle'
  const left = align === 'start' ? t.x : align === 'end' ? t.x - w : t.x - w / 2
  const top = t.y - t.size * 0.8
  const h = t.size * (0.8 + 0.25) + (lines.length - 1) * t.size * LINE_HEIGHT
  return { x: left, y: top, w, h }
}

/** Round a number to a tenth, the grain positions are stored at. */
export const tenth = (n: number) => Math.round(n * 10) / 10
export const hundredth = (n: number) => Math.round(n * 100) / 100
