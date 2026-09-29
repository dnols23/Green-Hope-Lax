import {
  MAX_DEPTH,
  NESTABLE,
  emptyNoteBlock,
  isTextBlock,
  isTextKind,
  normalizeIndents,
  type NoteBlock,
  type NoteBlockKind,
} from './noteBlocks'
import { newId } from './planner'

/**
 * The outline inside a note.
 *
 * A note is stored as a flat list where each block says how far in it sits
 * (see noteBlocks). Everything that treats it as a tree — what is under what,
 * what a folded parent hides, moving an item with its sub-items — is worked
 * out here from that list. Pure, so every move can be checked without a
 * browser, and every result goes back through `normalizeIndents` so no edit
 * can leave the outline in a shape it could not be saved in.
 */

const depth = (b: NoteBlock | undefined) => b?.indent ?? 0

/** One past the last block tucked under block i. */
export function subtreeEnd(blocks: NoteBlock[], i: number): number {
  const d = depth(blocks[i])
  let j = i + 1
  while (j < blocks.length && depth(blocks[j]) > d) j++
  return j
}

export const hasChildren = (blocks: NoteBlock[], i: number) =>
  i + 1 < blocks.length && depth(blocks[i + 1]) > depth(blocks[i])

/** The blocks out of sight inside a folded parent. */
export function hiddenIds(blocks: NoteBlock[]): Set<string> {
  const hidden = new Set<string>()
  let foldedAt: number | null = null
  for (const b of blocks) {
    if (foldedAt !== null) {
      if (depth(b) > foldedAt) {
        hidden.add(b.id)
        continue
      }
      foldedAt = null
    }
    if (b.collapsed) foldedAt = depth(b)
  }
  return hidden
}

/** The to-dos anywhere under block i, and how many are ticked. */
export function progressUnder(blocks: NoteBlock[], i: number): { done: number; total: number } {
  let done = 0
  let total = 0
  for (let j = i + 1; j < subtreeEnd(blocks, i); j++) {
    const b = blocks[j]
    if (b.kind === 'todo') {
      total++
      if (b.done) done++
    }
  }
  return { done, total }
}

/** A numbered item's place among the numbered items beside it: 1, 2, 3. */
export function numberOf(blocks: NoteBlock[], i: number): number {
  const d = depth(blocks[i])
  let n = 1
  for (let j = i - 1; j >= 0; j--) {
    const dj = depth(blocks[j])
    if (dj > d) continue
    if (dj < d || blocks[j].kind !== 'number') break
    n++
  }
  return n
}

/** The block this one would sit under if it moved one step in. */
function previousSibling(blocks: NoteBlock[], i: number): number {
  const d = depth(blocks[i])
  for (let j = i - 1; j >= 0; j--) {
    const dj = depth(blocks[j])
    if (dj === d) return j
    if (dj < d) return -1
  }
  return -1
}

function nextSibling(blocks: NoteBlock[], i: number): number {
  const j = subtreeEnd(blocks, i)
  return j < blocks.length && depth(blocks[j]) === depth(blocks[i]) ? j : -1
}

/** The block this one sits under, if any. */
export function parentOf(blocks: NoteBlock[], i: number): number {
  const d = depth(blocks[i])
  for (let j = i - 1; j >= 0; j--) if (depth(blocks[j]) < d) return j
  return -1
}

function deepest(blocks: NoteBlock[], i: number): number {
  let m = depth(blocks[i])
  for (let j = i + 1; j < subtreeEnd(blocks, i); j++) m = Math.max(m, depth(blocks[j]))
  return m
}

export function canIndent(blocks: NoteBlock[], i: number): boolean {
  const p = previousSibling(blocks, i)
  return p >= 0 && NESTABLE.has(blocks[p].kind) && deepest(blocks, i) < MAX_DEPTH
}

export const canOutdent = (blocks: NoteBlock[], i: number) => depth(blocks[i]) > 0

const shift = (b: NoteBlock, by: number): NoteBlock => {
  const indent = Math.max(0, depth(b) + by)
  const next: NoteBlock = { ...b, indent }
  if (!indent) delete next.indent
  return next
}

/** One step in, under the item above, taking its own sub-items with it. */
export function indentAt(blocks: NoteBlock[], i: number): NoteBlock[] {
  if (!canIndent(blocks, i)) return blocks
  const end = subtreeEnd(blocks, i)
  const p = previousSibling(blocks, i)
  return normalizeIndents(
    blocks.map((b, j) => {
      // Going under a folded parent would make it vanish; the parent opens.
      if (j === p && b.collapsed) return { ...b, collapsed: undefined }
      return j >= i && j < end ? shift(b, 1) : b
    })
  )
}

/**
 * One step out. The items that came after it at its old level are now under
 * it, the way an outline does it — they were below it, and they still are.
 */
export function outdentAt(blocks: NoteBlock[], i: number): NoteBlock[] {
  if (!canOutdent(blocks, i)) return blocks
  const end = subtreeEnd(blocks, i)
  return normalizeIndents(blocks.map((b, j) => (j >= i && j < end ? shift(b, -1) : b)))
}

/** Up past the item above it at its own level, sub-items and all. */
export function moveUpAt(blocks: NoteBlock[], i: number): NoteBlock[] {
  const p = previousSibling(blocks, i)
  if (p < 0) return blocks
  const end = subtreeEnd(blocks, i)
  return normalizeIndents([...blocks.slice(0, p), ...blocks.slice(i, end), ...blocks.slice(p, i), ...blocks.slice(end)])
}

export function moveDownAt(blocks: NoteBlock[], i: number): NoteBlock[] {
  const n = nextSibling(blocks, i)
  if (n < 0) return blocks
  const end = subtreeEnd(blocks, i)
  const nEnd = subtreeEnd(blocks, n)
  return normalizeIndents([...blocks.slice(0, i), ...blocks.slice(n, nEnd), ...blocks.slice(i, end), ...blocks.slice(nEnd)])
}

export const canMoveUp = (blocks: NoteBlock[], i: number) => previousSibling(blocks, i) >= 0
export const canMoveDown = (blocks: NoteBlock[], i: number) => nextSibling(blocks, i) >= 0

/**
 * Picked up and put down somewhere else: the block and everything under it
 * go in just before `beforeId` (or at the end), `indent` steps in.
 */
export function moveTo(blocks: NoteBlock[], id: string, beforeId: string | null, indent: number): NoteBlock[] {
  const i = blocks.findIndex((b) => b.id === id)
  if (i < 0 || id === beforeId) return blocks
  const end = subtreeEnd(blocks, i)
  const moving = blocks.slice(i, end)
  if (beforeId && moving.some((b) => b.id === beforeId)) return blocks
  const rest = [...blocks.slice(0, i), ...blocks.slice(end)]
  const at = beforeId ? rest.findIndex((b) => b.id === beforeId) : rest.length
  const by = Math.max(0, Math.min(indent, MAX_DEPTH)) - depth(blocks[i])
  const placed = moving.map((b) => shift(b, by))
  const at2 = at < 0 ? rest.length : at
  return normalizeIndents([...rest.slice(0, at2), ...placed, ...rest.slice(at2)])
}

/** Gone, with everything under it — what Delete in the block menu does. */
export function removeWithChildren(blocks: NoteBlock[], i: number): NoteBlock[] {
  return normalizeIndents([...blocks.slice(0, i), ...blocks.slice(subtreeEnd(blocks, i))])
}

/** Gone, and what was under it moves up a level to take its place. */
export function removeKeepingChildren(blocks: NoteBlock[], i: number): NoteBlock[] {
  const end = subtreeEnd(blocks, i)
  return normalizeIndents(
    blocks.flatMap((b, j) => (j === i ? [] : j > i && j < end ? [shift(b, -1)] : [b]))
  )
}

/** A copy of a block, and of everything under it, just below the original. */
export function duplicateAt(blocks: NoteBlock[], i: number): { blocks: NoteBlock[]; id: string } {
  const end = subtreeEnd(blocks, i)
  const copies = blocks.slice(i, end).map((b) => ({ ...structuredClone(b), id: newId('n') }))
  return { blocks: [...blocks.slice(0, end), ...copies, ...blocks.slice(end)], id: copies[0].id }
}

/** The same words as another kind of block — "Turn into" in Notion. */
export function turnInto(b: NoteBlock, kind: NoteBlockKind, level?: 1 | 2 | 3): NoteBlock {
  const keep = {
    id: b.id,
    ...(b.indent ? { indent: b.indent } : {}),
    ...(b.color ? { color: b.color } : {}),
    ...(b.tint ? { tint: b.tint } : {}),
    ...(b.collapsed ? { collapsed: true } : {}),
  }
  if (!isTextKind(kind)) return { ...emptyNoteBlock(kind, b.id), ...(b.indent ? { indent: b.indent } : {}) }
  const words = isTextBlock(b)
    ? { text: b.text, ...(b.marks?.length ? { marks: b.marks } : {}), ...(b.details ? { details: b.details } : {}) }
    : { text: '' }
  switch (kind) {
    case 'heading':
      return { ...keep, ...words, kind, level: level ?? 2 }
    case 'todo':
      return { ...keep, ...words, kind, done: b.kind === 'todo' ? b.done : false }
    case 'callout':
      return { ...keep, ...words, kind, icon: b.kind === 'callout' ? b.icon ?? '💡' : '💡' }
    default:
      return { ...keep, ...words, kind }
  }
}

/** Where two versions of a note first differ — where undo puts the caret. */
export function firstDifference(a: NoteBlock[], b: NoteBlock[]): number {
  const n = Math.max(a.length, b.length)
  for (let i = 0; i < n; i++) {
    if (a[i] !== b[i] && JSON.stringify(a[i]) !== JSON.stringify(b[i])) return i
  }
  return -1
}
