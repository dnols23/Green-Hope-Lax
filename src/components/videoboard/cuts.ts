// The head coach's edit of a film: the stretches cut out of it.
//
// Non-destructive. The film on Cloudflare is never touched; the board just
// skips the cut stretches when anyone plays it, so an edit can always be
// undone and saved clips (which point at the original's times) still land
// where they were made. Pure, so the editor, the panels and the API agree.

/** A stretch cut out of the film, in seconds of the original. */
export type Cut = [start: number, end: number]

/** Shorter than this isn't a cut anyone meant to make. */
const MIN_CUT = 0.1
/** Two cuts this close together are one cut. */
const JOIN = 0.05
export const MAX_CUTS = 500

const round = (t: number) => Math.round(t * 1000) / 1000

/** Sorted, inside the film, overlapping cuts merged, slivers dropped. */
export function normCuts(cuts: unknown, duration = Infinity): Cut[] {
  if (!Array.isArray(cuts)) return []
  const list: Cut[] = []
  for (const c of cuts) {
    if (!Array.isArray(c) || c.length < 2) continue
    const a = Math.max(0, Math.min(duration, Number(c[0])))
    const b = Math.max(0, Math.min(duration, Number(c[1])))
    if (!Number.isFinite(a) || !Number.isFinite(b) || b - a < MIN_CUT) continue
    list.push([a, b])
  }
  list.sort((x, y) => x[0] - y[0])
  const out: Cut[] = []
  for (const c of list) {
    const last = out[out.length - 1]
    if (last && c[0] <= last[1] + JOIN) last[1] = Math.max(last[1], c[1])
    else out.push([c[0], c[1]])
  }
  return out.slice(0, MAX_CUTS).map(([a, b]) => [round(a), round(b)])
}

export function addCut(cuts: Cut[], a: number, b: number, duration?: number): Cut[] {
  return normCuts([...cuts, [Math.min(a, b), Math.max(a, b)]], duration)
}

/** Put a stretch back. */
export function keepRange(cuts: Cut[], a: number, b: number, duration?: number): Cut[] {
  const out: Cut[] = []
  for (const [x, y] of cuts) {
    if (y <= a || x >= b) out.push([x, y])
    else {
      if (x < a) out.push([x, a])
      if (y > b) out.push([b, y])
    }
  }
  return normCuts(out, duration)
}

/** Where to jump to if the playhead is inside a cut, else null. */
export function skipFrom(cuts: Cut[], t: number): number | null {
  for (const [a, b] of cuts) {
    if (t >= a && t < b - 0.01) return b
    if (a > t) break
  }
  return null
}

export function cutTotal(cuts: Cut[]): number {
  return cuts.reduce((s, [a, b]) => s + (b - a), 0)
}

export interface Segment {
  start: number
  end: number
  cut: boolean
}

/**
 * The film as the editor shows it: pieces between every split and every cut
 * edge, each either kept or cut.
 */
export function segmentsOf(duration: number, cuts: Cut[], splits: number[]): Segment[] {
  if (!(duration > 0)) return []
  const edges = new Set<number>([0, duration])
  for (const s of splits) if (s > 0 && s < duration) edges.add(round(s))
  for (const [a, b] of cuts) {
    if (a > 0 && a < duration) edges.add(a)
    if (b > 0 && b < duration) edges.add(b)
  }
  const pts = [...edges].sort((x, y) => x - y)
  const out: Segment[] = []
  for (let i = 0; i < pts.length - 1; i++) {
    const start = pts[i]
    const end = pts[i + 1]
    if (end - start < 0.001) continue
    const mid = (start + end) / 2
    out.push({ start, end, cut: cuts.some(([a, b]) => mid >= a && mid < b) })
  }
  return out
}

/** The kept pieces, in order — what "export as new films" makes. */
export function keptParts(duration: number, cuts: Cut[], splits: number[]): Segment[] {
  return segmentsOf(duration, cuts, splits).filter((s) => !s.cut)
}
