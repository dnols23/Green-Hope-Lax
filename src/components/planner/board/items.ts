// Everything that can be done to the things on a board, as pure functions of
// the board: find, box, move, stretch, turn, stack, copy, group, line up.
//
// A board keeps its players, lines, words and shapes in four lists, because
// that is how it has always been stored. The editor mostly wants to treat them
// as one pile of "items"; this is where the four lists become one and back.

import {
  FIELD,
  newId,
  type Board,
  type BoardItemBase,
  type BoardPath,
  type BoardShape,
  type BoardText,
  type BoardToken,
  type TokenKind,
} from '@/lib/planner'
import { boxOf, rotatePt, sampleLine, textBox, turnedBox, unionBox, type Box, type Pt } from './geometry'

export type ItemType = 'token' | 'path' | 'text' | 'shape'

export type Item =
  | { type: 'token'; it: BoardToken; i: number }
  | { type: 'path'; it: BoardPath; i: number }
  | { type: 'text'; it: BoardText; i: number }
  | { type: 'shape'; it: BoardShape; i: number }

/*
 * Where each kind of thing stacks when nobody has arranged anything: zones at
 * the bottom, then lines, then words, with players on top — the order the
 * board has always drawn in. Far apart, so the order within each layer (the
 * order things were drawn) never crosses into the next.
 */
const LAYER: Record<ItemType, number> = { shape: 0, path: 100_000, text: 200_000, token: 300_000 }

export const zOf = (item: Item) => item.it.z ?? LAYER[item.type] + item.i

/** Every item on the board, bottom first. */
export function stack(board: Board): Item[] {
  const all: Item[] = [
    ...(board.shapes ?? []).map((it, i) => ({ type: 'shape' as const, it, i })),
    ...board.paths.map((it, i) => ({ type: 'path' as const, it, i })),
    ...(board.texts ?? []).map((it, i) => ({ type: 'text' as const, it, i })),
    ...board.tokens.map((it, i) => ({ type: 'token' as const, it, i })),
  ]
  return all.sort((a, b) => zOf(a) - zOf(b))
}

export function findItem(board: Board, id: string): Item | undefined {
  const t = board.tokens.findIndex((x) => x.id === id)
  if (t >= 0) return { type: 'token', it: board.tokens[t], i: t }
  const p = board.paths.findIndex((x) => x.id === id)
  if (p >= 0) return { type: 'path', it: board.paths[p], i: p }
  const texts = board.texts ?? []
  const x = texts.findIndex((q) => q.id === id)
  if (x >= 0) return { type: 'text', it: texts[x], i: x }
  const shapes = board.shapes ?? []
  const s = shapes.findIndex((q) => q.id === id)
  if (s >= 0) return { type: 'shape', it: shapes[s], i: s }
  return undefined
}

export const allIds = (board: Board) => stack(board).map((x) => x.it.id)

/** Once a coach has arranged anything, every item carries its place in the stack. */
const arranged = (board: Board) => stack(board).some((x) => x.it.z !== undefined)

// ── Sizes ───────────────────────────────────────────────────────────────────

/** A token's own radius in yards, before its size is applied. */
export function baseRadius(kind: TokenKind): number {
  return kind === 'ball' ? 0.9 : kind === 'cone' ? 1.1 : kind === 'goal' ? 1.3 : kind === 'ladder' ? 3 : 1.9
}

export const tokenRadius = (t: BoardToken) => baseRadius(t.kind) * (t.size ?? 1)

/** Can it be turned? Only the things whose direction means something. */
export const turnable = (item: Item) =>
  item.type === 'shape' || item.type === 'text' || (item.type === 'token' && (item.it.kind === 'goal' || item.it.kind === 'ladder'))

/** A token's footprint before it is turned, centred on its spot. */
export function tokenLocalBox(t: BoardToken): Box {
  const s = t.size ?? 1
  const r = tokenRadius(t)
  if (t.kind === 'cone') return { x: t.x - r, y: t.y - r * 1.6, w: r * 2, h: r * 2.6 }
  if (t.kind === 'goal') return { x: t.x - 1.3 * s, y: t.y - 1.3 * s, w: 2.3 * s, h: 2.6 * s }
  if (t.kind === 'ladder') return { x: t.x - 3 * s, y: t.y - 0.6 * s, w: 6 * s, h: 1.2 * s }
  return { x: t.x - r, y: t.y - r, w: r * 2, h: r * 2 }
}

/**
 * The item's own box and turn — the frame a single selection is drawn in, so a
 * turned zone gets a turned frame round it rather than a loose upright one.
 */
export function frameOf(item: Item, turn: number): { box: Box; rot: number; pivot: Pt } {
  if (item.type === 'shape') {
    const s = item.it
    return { box: { x: s.x, y: s.y, w: s.w, h: s.h }, rot: s.rot ?? 0, pivot: { x: s.x + s.w / 2, y: s.y + s.h / 2 } }
  }
  if (item.type === 'text') {
    // Words are counter-turned with the board so they always read upright.
    return { box: textBox(item.it), rot: (item.it.rot ?? 0) - turn, pivot: { x: item.it.x, y: item.it.y } }
  }
  if (item.type === 'token') {
    return { box: tokenLocalBox(item.it), rot: item.it.rot ?? 0, pivot: { x: item.it.x, y: item.it.y } }
  }
  return { box: boxOf(sampleLine(item.it.points, !!item.it.curve)), rot: 0, pivot: item.it.points[0] }
}

/** The upright box that holds the item, in field yards. */
export function itemBox(item: Item, turn: number): Box {
  const f = frameOf(item, turn)
  if (!f.rot) return f.box
  const corners = [
    { x: f.box.x, y: f.box.y },
    { x: f.box.x + f.box.w, y: f.box.y },
    { x: f.box.x + f.box.w, y: f.box.y + f.box.h },
    { x: f.box.x, y: f.box.y + f.box.h },
  ].map((p) => rotatePt(p, f.pivot, f.rot))
  return boxOf(corners)
}

export function selectionBox(board: Board, ids: string[], turn: number): Box | null {
  const set = new Set(ids)
  return unionBox(stack(board).filter((x) => set.has(x.it.id)).map((x) => itemBox(x, turn)))
}

export { turnedBox }

// ── Changing things ─────────────────────────────────────────────────────────

export type Mappers = {
  token?: (t: BoardToken) => BoardToken
  path?: (p: BoardPath) => BoardPath
  text?: (t: BoardText) => BoardText
  shape?: (s: BoardShape) => BoardShape
}

/** Change the items with these ids, each by the rule for its kind. */
export function mapItems(board: Board, ids: Iterable<string>, fn: Mappers): Board {
  const set = new Set(ids)
  const next: Board = {
    ...board,
    tokens: fn.token ? board.tokens.map((t) => (set.has(t.id) ? fn.token!(t) : t)) : board.tokens,
    paths: fn.path ? board.paths.map((p) => (set.has(p.id) ? fn.path!(p) : p)) : board.paths,
  }
  if (board.texts) next.texts = fn.text ? board.texts.map((t) => (set.has(t.id) ? fn.text!(t) : t)) : board.texts
  if (board.shapes) next.shapes = fn.shape ? board.shapes.map((s) => (set.has(s.id) ? fn.shape!(s) : s)) : board.shapes
  return next
}

/** The same patch to everything, whatever it is. */
export function patchAll(board: Board, ids: Iterable<string>, patch: Partial<BoardItemBase>): Board {
  return mapItems(board, ids, {
    token: (t) => clean({ ...t, ...patch }),
    path: (p) => clean({ ...p, ...patch }),
    text: (t) => clean({ ...t, ...patch }),
    shape: (s) => clean({ ...s, ...patch }),
  })
}

/** Leave no `undefined` keys lying about in what gets saved. */
export function clean<T extends object>(o: T): T {
  const out = { ...o }
  for (const k of Object.keys(out) as (keyof T)[]) if (out[k] === undefined) delete out[k]
  return out
}

const r3 = (n: number) => Math.round(n * 1000) / 1000
const clampX = (x: number) => Math.max(-4, Math.min(FIELD.length + 4, x))
const clampY = (y: number) => Math.max(-4, Math.min(FIELD.width + 4, y))
const movePt = (p: Pt, dx: number, dy: number) => ({ x: r3(clampX(p.x + dx)), y: r3(clampY(p.y + dy)) })

/** Slide items by a distance. Locked ones stay where they are. */
export function moveItems(board: Board, ids: Iterable<string>, dx: number, dy: number): Board {
  const unlocked = [...ids].filter((id) => !findItem(board, id)?.it.locked)
  return mapItems(board, unlocked, {
    token: (t) => ({ ...t, ...movePt(t, dx, dy) }),
    text: (t) => ({ ...t, ...movePt(t, dx, dy) }),
    shape: (s) => ({ ...s, ...movePt(s, dx, dy) }),
    path: (p) => ({ ...p, points: p.points.map((pt) => movePt(pt, dx, dy)) }),
  })
}

/**
 * Stretch items from one box to another. A shape stretches with it; players
 * and words keep their size and move with the stretch, the way a set spreads
 * out when the box round it is pulled wider.
 */
export function scaleItems(board: Board, ids: Iterable<string>, from: Box, to: Box): Board {
  const sx = from.w > 0.01 ? to.w / from.w : 1
  const sy = from.h > 0.01 ? to.h / from.h : 1
  const map = (p: Pt) => ({ x: r3(to.x + (p.x - from.x) * sx), y: r3(to.y + (p.y - from.y) * sy) })
  const unlocked = [...ids].filter((id) => !findItem(board, id)?.it.locked)
  return mapItems(board, unlocked, {
    token: (t) => ({ ...t, ...map(t) }),
    text: (t) => ({ ...t, ...map(t) }),
    path: (p) => ({ ...p, points: p.points.map(map) }),
    shape: (s) => {
      const c = map({ x: s.x + s.w / 2, y: s.y + s.h / 2 })
      const w = Math.max(0.3, s.w * Math.abs(sx))
      const h = Math.max(0.3, s.h * Math.abs(sy))
      return { ...s, x: r3(c.x - w / 2), y: r3(c.y - h / 2), w: r3(w), h: r3(h) }
    },
  })
}

export type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'

/**
 * One shape, stretched by one handle, in its own turned frame: the opposite
 * corner (or edge) stays put, which is what a hand on a handle expects.
 */
export function resizeShape(s: BoardShape, handle: Handle, to: Pt, keepRatio: boolean): BoardShape {
  const rot = s.rot ?? 0
  const c = { x: s.x + s.w / 2, y: s.y + s.h / 2 }
  // The pointer, in the shape's own upright frame, from its middle.
  const p = rotatePt(to, c, -rot)
  const lx = p.x - c.x
  const ly = p.y - c.y
  let left = -s.w / 2
  let right = s.w / 2
  let top = -s.h / 2
  let bottom = s.h / 2
  if (handle.includes('w')) left = Math.min(lx, right - 0.3)
  if (handle.includes('e')) right = Math.max(lx, left + 0.3)
  if (handle.includes('n')) top = Math.min(ly, bottom - 0.3)
  if (handle.includes('s')) bottom = Math.max(ly, top + 0.3)
  let w = right - left
  let h = bottom - top
  if (keepRatio && handle.length === 2 && s.w > 0 && s.h > 0) {
    const k = Math.max(w / s.w, h / s.h)
    w = s.w * k
    h = s.h * k
    if (handle.includes('w')) left = right - w
    else right = left + w
    if (handle.includes('n')) top = bottom - h
    else bottom = top + h
  }
  // The new middle, back in field terms.
  const mid = rotatePt({ x: c.x + (left + right) / 2, y: c.y + (top + bottom) / 2 }, c, rot)
  return { ...s, x: r3(mid.x - w / 2), y: r3(mid.y - h / 2), w: r3(w), h: r3(h) }
}

/** Delete, returning the board without them. */
export function deleteItems(board: Board, ids: Iterable<string>): Board {
  const set = new Set(ids)
  const next: Board = {
    ...board,
    tokens: board.tokens.filter((t) => !set.has(t.id)),
    paths: board.paths.filter((p) => !set.has(p.id)),
    texts: (board.texts ?? []).filter((t) => !set.has(t.id)),
  }
  if (board.shapes) next.shapes = board.shapes.filter((s) => !set.has(s.id))
  return next
}

/** A loose bag of items, the way the clipboard and "add" carry them. */
export interface Bundle {
  tokens: BoardToken[]
  paths: BoardPath[]
  texts: BoardText[]
  shapes: BoardShape[]
}

export const emptyBundle = (): Bundle => ({ tokens: [], paths: [], texts: [], shapes: [] })

/** The items with these ids, bottom first, as a bundle. */
export function bundleOf(board: Board, ids: Iterable<string>): Bundle {
  const set = new Set(ids)
  const out = emptyBundle()
  for (const x of stack(board)) {
    if (!set.has(x.it.id)) continue
    if (x.type === 'token') out.tokens.push(x.it)
    else if (x.type === 'path') out.paths.push(x.it)
    else if (x.type === 'text') out.texts.push(x.it)
    else out.shapes.push(x.it)
  }
  return out
}

/**
 * Put new items on the board. Before anything has been arranged they join the
 * top of their own layer; after, they go on top of everything, as new things
 * do in any drawing program.
 */
export function addBundle(board: Board, add: Bundle): Board {
  const onTop = arranged(board)
  let z = onTop ? Math.max(0, ...stack(board).map(zOf)) + 1 : 0
  const place = <T extends BoardItemBase>(it: T): T => {
    const { z: _z, ...rest } = it
    return onTop ? ({ ...rest, z: z++ } as T) : (rest as T)
  }
  // Placed in stacking order across the kinds, so a pasted group keeps its own order.
  const order = [
    ...add.shapes.map((it) => ({ k: 'shape' as const, it, z: it.z ?? LAYER.shape })),
    ...add.paths.map((it) => ({ k: 'path' as const, it, z: it.z ?? LAYER.path })),
    ...add.texts.map((it) => ({ k: 'text' as const, it, z: it.z ?? LAYER.text })),
    ...add.tokens.map((it) => ({ k: 'token' as const, it, z: it.z ?? LAYER.token })),
  ].sort((a, b) => a.z - b.z)
  const next = emptyBundle()
  for (const o of order) {
    if (o.k === 'shape') next.shapes.push(place(o.it as BoardShape))
    else if (o.k === 'path') next.paths.push(place(o.it as BoardPath))
    else if (o.k === 'text') next.texts.push(place(o.it as BoardText))
    else next.tokens.push(place(o.it as BoardToken))
  }
  const out: Board = {
    ...board,
    tokens: [...board.tokens, ...next.tokens],
    paths: [...board.paths, ...next.paths],
    texts: [...(board.texts ?? []), ...next.texts],
  }
  if (board.shapes?.length || next.shapes.length) out.shapes = [...(board.shapes ?? []), ...next.shapes]
  return out
}

export const bundleIds = (b: Bundle) => [...b.shapes, ...b.paths, ...b.texts, ...b.tokens].map((x) => x.id)

/**
 * A copy of a bundle with fresh ids, shifted by (dx, dy). Groups inside it
 * become new groups, so a duplicated group is its own group and not a limb of
 * the original. A copy is never locked or tied to a roster player — a second
 * #27 on the field is a drawing, not the player.
 */
export function cloneBundle(b: Bundle, dx: number, dy: number): Bundle {
  const groups = new Map<string, string>()
  const regroup = (g?: string) => {
    if (!g) return undefined
    if (!groups.has(g)) groups.set(g, newId('g'))
    return groups.get(g)
  }
  const fresh = <T extends BoardItemBase>(it: T, prefix: string): T =>
    clean({ ...it, id: newId(prefix), group: regroup(it.group), locked: undefined })
  return {
    tokens: b.tokens.map((t) => ({ ...fresh(t, 't'), playerId: undefined, ...movePt(t, dx, dy) })).map(clean),
    texts: b.texts.map((t) => ({ ...fresh(t, 'x'), ...movePt(t, dx, dy) })),
    shapes: b.shapes.map((s) => ({ ...fresh(s, 's'), ...movePt(s, dx, dy) })),
    paths: b.paths.map((p) => ({ ...fresh(p, 'p'), points: p.points.map((pt) => movePt(pt, dx, dy)) })),
  }
}

/** Everything that belongs with these: the rest of any group they are in. */
export function withGroups(board: Board, ids: string[]): string[] {
  const all = stack(board)
  const groups = new Set(all.filter((x) => ids.includes(x.it.id) && x.it.group).map((x) => x.it.group))
  if (!groups.size) return ids
  const out = new Set(ids)
  for (const x of all) if (x.it.group && groups.has(x.it.group)) out.add(x.it.id)
  return [...out]
}

// ── Stacking ────────────────────────────────────────────────────────────────

export type Reorder = 'front' | 'back' | 'forward' | 'backward'

/**
 * Move items up or down the stack. The whole board is then numbered 1…n in
 * its new order, which is what "arranged" means from here on.
 */
export function reorder(board: Board, ids: string[], how: Reorder): Board {
  const set = new Set(ids)
  const order = stack(board).map((x) => x.it.id)
  let next: string[]
  if (how === 'front') next = [...order.filter((id) => !set.has(id)), ...order.filter((id) => set.has(id))]
  else if (how === 'back') next = [...order.filter((id) => set.has(id)), ...order.filter((id) => !set.has(id))]
  else {
    next = [...order]
    // One step past the nearest thing that is not moving, keeping the moving
    // ones in their own order.
    if (how === 'forward') {
      for (let i = next.length - 2; i >= 0; i--) {
        if (set.has(next[i]) && !set.has(next[i + 1])) [next[i], next[i + 1]] = [next[i + 1], next[i]]
      }
    } else {
      for (let i = 1; i < next.length; i++) {
        if (set.has(next[i]) && !set.has(next[i - 1])) [next[i], next[i - 1]] = [next[i - 1], next[i]]
      }
    }
  }
  const rank = new Map(next.map((id, i) => [id, i + 1]))
  const setZ = <T extends BoardItemBase>(it: T): T => ({ ...it, z: rank.get(it.id) })
  const out: Board = {
    ...board,
    tokens: board.tokens.map(setZ),
    paths: board.paths.map(setZ),
    texts: (board.texts ?? []).map(setZ),
  }
  if (board.shapes) out.shapes = board.shapes.map(setZ)
  return out
}

// ── Lining things up ────────────────────────────────────────────────────────

export type Align = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom'

/** Items that move as one: a group is one unit, anything else is its own. */
function units(board: Board, ids: string[], turn: number): { ids: string[]; box: Box }[] {
  const set = new Set(ids)
  const byKey = new Map<string, Item[]>()
  for (const x of stack(board)) {
    if (!set.has(x.it.id)) continue
    const key = x.it.group ?? x.it.id
    byKey.set(key, [...(byKey.get(key) ?? []), x])
  }
  return [...byKey.values()].map((items) => ({
    ids: items.map((x) => x.it.id),
    box: unionBox(items.map((x) => itemBox(x, turn)))!,
  }))
}

/** Line the selection up on the edge or middle of the box round all of it. */
export function align(board: Board, ids: string[], how: Align, turn: number): Board {
  const us = units(board, ids, turn)
  const all = unionBox(us.map((u) => u.box))
  if (!all || us.length < 2) return board
  let next = board
  for (const u of us) {
    const b = u.box
    const dx =
      how === 'left' ? all.x - b.x : how === 'right' ? all.x + all.w - (b.x + b.w) : how === 'center' ? all.x + all.w / 2 - (b.x + b.w / 2) : 0
    const dy =
      how === 'top' ? all.y - b.y : how === 'bottom' ? all.y + all.h - (b.y + b.h) : how === 'middle' ? all.y + all.h / 2 - (b.y + b.h / 2) : 0
    if (dx || dy) next = moveItems(next, u.ids, dx, dy)
  }
  return next
}

/** Space the selection out evenly, first to last, across or down. */
export function distribute(board: Board, ids: string[], axis: 'x' | 'y', turn: number): Board {
  const us = units(board, ids, turn)
  if (us.length < 3) return board
  const mid = (b: Box) => (axis === 'x' ? b.x + b.w / 2 : b.y + b.h / 2)
  us.sort((a, b) => mid(a.box) - mid(b.box))
  const first = mid(us[0].box)
  const step = (mid(us[us.length - 1].box) - first) / (us.length - 1)
  let next = board
  us.forEach((u, i) => {
    const d = first + step * i - mid(u.box)
    if (Math.abs(d) > 0.001) next = axis === 'x' ? moveItems(next, u.ids, d, 0) : moveItems(next, u.ids, 0, d)
  })
  return next
}

// ── Snapping ────────────────────────────────────────────────────────────────

export type Guide = { axis: 'x' | 'y'; at: number }

/**
 * Where a moving box would like to land: its edges and middle against every
 * other item's edges and middles, and the field's own lines — the centre line,
 * the goal lines, the restraining lines, the middle of the field across.
 * Within `tol` yards it snaps, and the line it snapped to is handed back to be
 * drawn as a guide.
 */
export function snapBox(moving: Box, others: Box[], tol: number): { dx: number; dy: number; guides: Guide[] } {
  const G = FIELD.goalLineFromEnd
  const R = G + FIELD.restrainingFromGoalLine
  const xs = [FIELD.length / 2, G, FIELD.length - G, R, FIELD.length - R, 0, FIELD.length]
  const ys = [FIELD.width / 2, FIELD.boxFromSideline, FIELD.width - FIELD.boxFromSideline, 0, FIELD.width]
  for (const o of others) {
    xs.push(o.x, o.x + o.w / 2, o.x + o.w)
    ys.push(o.y, o.y + o.h / 2, o.y + o.h)
  }
  const pick = (mine: number[], targets: number[]) => {
    let best: { d: number; at: number } | null = null
    for (const m of mine) {
      for (const t of targets) {
        const d = t - m
        if (Math.abs(d) <= tol && (!best || Math.abs(d) < Math.abs(best.d))) best = { d, at: t }
      }
    }
    return best
  }
  const bx = pick([moving.x, moving.x + moving.w / 2, moving.x + moving.w], xs)
  const by = pick([moving.y, moving.y + moving.h / 2, moving.y + moving.h], ys)
  const guides: Guide[] = []
  if (bx) guides.push({ axis: 'x', at: bx.at })
  if (by) guides.push({ axis: 'y', at: by.at })
  return { dx: bx?.d ?? 0, dy: by?.d ?? 0, guides }
}
