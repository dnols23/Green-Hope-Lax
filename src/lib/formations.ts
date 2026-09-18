import { FIELD, newId, type BoardToken, type TokenKind } from './planner'

/**
 * The sets a coach actually calls, ready to drop on the field.
 *
 * Counted the way lacrosse counts them — from behind the goal forwards. A
 * 2-3-1 is two behind, three in the middle, one up top; the number nearest the
 * cage comes first. Every spot is yards from the middle of the goal being
 * attacked: dx is how far in FRONT of the cage (so a negative dx is behind it),
 * dy is across.
 *
 * Stored as offsets rather than field positions so one definition works on
 * either goal — drop a set on the far cage and it faces the right way.
 */

export interface FormationSpot {
  kind: TokenKind
  label: string
  /** Yards in front of the goal. Negative is behind the cage. */
  dx: number
  /** Yards across from the middle of the goal. */
  dy: number
}

export interface Formation {
  key: string
  name: string
  blurb: string
  spots: FormationSpot[]
}

const A = (dx: number, dy: number): FormationSpot => ({ kind: 'offense', label: 'A', dx, dy })
const M = (dx: number, dy: number): FormationSpot => ({ kind: 'offense', label: 'M', dx, dy })

export const FORMATIONS: Formation[] = [
  {
    key: '2-3-1',
    name: '2-3-1',
    blurb: 'Two behind, one on the crease, three midfielders in an umbrella round the box.',
    spots: [A(-6, -7), A(-6, 7), A(4.5, 0), M(16, -13), M(19, 0), M(16, 13)],
  },
  {
    key: '2-2-2',
    name: '2-2-2',
    blurb: 'Two behind, an attackman and a midfielder on the crease, two up at the box corners.',
    spots: [A(-6, -7), A(-6, 7), A(4.5, -3.5), M(4.5, 3.5), M(19, -15), M(19, 15)],
  },
  {
    key: '2-2-2-open',
    name: '2-2-2 open',
    blurb: 'The same set opened into a circle — the crease pair slide out to the box sides, nobody in front of the cage.',
    spots: [A(-7, -6), A(-7, 6), A(7, -16), M(7, 16), M(18, -9), M(18, 9)],
  },
  {
    key: '1-4-1',
    name: '1-4-1',
    blurb: 'One at X, four across the middle, one up top.',
    spots: [A(-7, 0), M(9, -18), A(9, -5), A(9, 5), M(9, 18), M(19, 0)],
  },
  {
    key: '3-3',
    name: '3-3',
    blurb: 'All six above the goal line, in a rectangle — three low, three high.',
    spots: [A(6, -14), A(6, 0), A(6, 14), M(18, -14), M(18, 0), M(18, 14)],
  },
]

/**
 * Which way the offense is facing at a spot on the field: -1 when the cage
 * being attacked is the right-hand one (so "in front of the goal" is back
 * towards midfield), +1 when it is the left-hand one.
 */
export function facingAt(x: number): 1 | -1 {
  return x < FIELD.length / 2 ? 1 : -1
}

/** Where the goal is on the half of the field a point falls in. */
export function goalNear(x: number): { x: number; y: number } {
  return {
    x: x < FIELD.length / 2 ? FIELD.goalLineFromEnd : FIELD.length - FIELD.goalLineFromEnd,
    y: FIELD.width / 2,
  }
}

const clampX = (x: number) => Math.max(0, Math.min(FIELD.length, Math.round(x * 10) / 10))
const clampY = (y: number) => Math.max(0, Math.min(FIELD.width, Math.round(y * 10) / 10))

/**
 * Lay a set of spots down with the goal at `at`, facing whichever way that half
 * of the field faces. Anything that would land off the grass is pulled back on.
 */
export function placeSpots(spots: FormationSpot[], at: { x: number; y: number }, facing: 1 | -1): BoardToken[] {
  return spots.map((s) => ({
    id: newId('t'),
    kind: s.kind,
    label: s.label,
    x: clampX(at.x + facing * s.dx),
    y: clampY(at.y + s.dy),
  }))
}

// ── Looks the staff saved themselves ────────────────────────────────────────

/**
 * A group of discs a coach drew, boxed and kept.
 *
 * Offsets are measured from the middle of the group the same way a formation's
 * are — in front of the cage rather than left-to-right on the field — so the
 * same look dropped on the far goal comes out mirrored, which is what "run it
 * at the other end" means.
 */
export interface SavedLook {
  id: string
  name: string
  spots: FormationSpot[]
}

export const LOOKS_KEY = 'board_looks'

/** Turn the discs inside the box into a look, measured from their middle. */
export function lookFromTokens(name: string, tokens: BoardToken[]): SavedLook | null {
  if (!tokens.length) return null
  const cx = tokens.reduce((n, t) => n + t.x, 0) / tokens.length
  const cy = tokens.reduce((n, t) => n + t.y, 0) / tokens.length
  const facing = facingAt(cx)
  return {
    id: newId('lk'),
    name: name.trim() || 'Look',
    // dx is measured the way a formation's is: in front of the cage.
    spots: tokens.map((t) => ({
      kind: t.kind,
      label: t.label,
      dx: Math.round((t.x - cx) * facing * 10) / 10,
      dy: Math.round((t.y - cy) * 10) / 10,
    })),
  }
}

/** Read the stored list, forgiving anything that is not one. */
export function parseLooks(raw: unknown): SavedLook[] {
  let value: unknown = raw
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw)
    } catch {
      return []
    }
  }
  if (!Array.isArray(value)) return []

  const out: SavedLook[] = []
  for (const item of value) {
    const l = (item ?? {}) as Record<string, unknown>
    const spots = Array.isArray(l.spots)
      ? l.spots
          .map((s) => {
            const spot = (s ?? {}) as Record<string, unknown>
            return {
              kind: (typeof spot.kind === 'string' ? spot.kind : 'offense') as TokenKind,
              label: typeof spot.label === 'string' ? spot.label.slice(0, 4) : '',
              dx: Number(spot.dx) || 0,
              dy: Number(spot.dy) || 0,
            }
          })
          .filter((s) => Number.isFinite(s.dx) && Number.isFinite(s.dy))
      : []
    if (!spots.length) continue
    out.push({
      id: typeof l.id === 'string' && l.id ? l.id : newId('lk'),
      name: typeof l.name === 'string' && l.name.trim() ? l.name.trim().slice(0, 40) : 'Look',
      spots: spots.slice(0, 30),
    })
  }
  // A shelf, not a landfill.
  return out.slice(0, 40)
}

/** Drop a saved look. Going on the other cage mirrors it, as a formation does. */
export function placeLook(look: SavedLook, at: { x: number; y: number }): BoardToken[] {
  return placeSpots(look.spots, at, facingAt(at.x))
}
