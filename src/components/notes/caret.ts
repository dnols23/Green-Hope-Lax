import { readMarks, type MarkType, type NoteMark, type Rich } from '@/lib/noteText'

/**
 * Reading an editable line back, and putting the caret where it belongs.
 *
 * Browser only. The editor draws each block's words as a little HTML (see
 * richToHtml) and lets the browser handle the typing; after each keystroke
 * what is on screen is read back into words and ranges here. Offsets are
 * counted the same way everywhere — a character is one, a line break is one —
 * so an offset read from the screen can be used on the words, and back.
 */

const BLOCK_TAGS = new Set(['DIV', 'P', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'PRE'])

type Active = { type: MarkType; href?: string }

function marksOf(el: HTMLElement): Active[] {
  const out: Active[] = []
  switch (el.tagName) {
    case 'B':
    case 'STRONG':
      out.push({ type: 'b' })
      break
    case 'I':
    case 'EM':
      out.push({ type: 'i' })
      break
    case 'U':
    case 'INS':
      out.push({ type: 'u' })
      break
    case 'S':
    case 'STRIKE':
    case 'DEL':
      out.push({ type: 's' })
      break
    case 'CODE':
      out.push({ type: 'code' })
      break
    case 'A': {
      const href = el.getAttribute('href')
      if (href) out.push({ type: 'a', href })
      break
    }
  }
  // Some browsers format with a styled span rather than a tag.
  const st = el.style
  if (st) {
    if (st.fontWeight === 'bold' || Number(st.fontWeight) >= 600) out.push({ type: 'b' })
    if (st.fontStyle === 'italic') out.push({ type: 'i' })
    const deco = `${st.textDecorationLine} ${st.textDecoration}`
    if (deco.includes('line-through')) out.push({ type: 's' })
    if (deco.includes('underline')) out.push({ type: 'u' })
  }
  return out
}

/**
 * The words and formatting in a stretch of the editable DOM. `trim` drops a
 * last <br> the browser keeps only so an empty line has height — it is not a
 * line anybody typed.
 */
function read(root: Node, trim: boolean): Rich {
  let text = ''
  const marks: NoteMark[] = []
  let lastBr = false
  const walk = (node: Node, active: Active[]) => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) {
        const data = (child as Text).data.replace(/ /g, ' ').replace(/\r\n?/g, '\n')
        if (!data) continue
        const start = text.length
        text += data
        lastBr = false
        for (const m of active) marks.push({ type: m.type, start, end: text.length, ...(m.href ? { href: m.href } : {}) })
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const el = child as HTMLElement
        if (el.tagName === 'BR') {
          text += '\n'
          lastBr = true
          continue
        }
        if (BLOCK_TAGS.has(el.tagName) && text.length && !text.endsWith('\n')) text += '\n'
        walk(el, [...active, ...marksOf(el)])
      }
    }
  }
  walk(root, [])
  if (trim && lastBr) text = text.slice(0, -1)
  return { text, marks: readMarks(marks, text.length) }
}

export const domToRich = (el: HTMLElement): Rich => read(el, true)

/** How many characters in from the start of `root` a DOM position is. */
function offsetOf(root: HTMLElement, node: Node, offset: number): number {
  const range = document.createRange()
  range.setStart(root, 0)
  try {
    range.setEnd(node, offset)
  } catch {
    return 0
  }
  const box = document.createElement('div')
  box.appendChild(range.cloneContents())
  return read(box, false).text.length
}

/** Where the selection starts and ends inside this block, or null if it is not in it. */
export function getOffsets(root: HTMLElement): { start: number; end: number } | null {
  const sel = window.getSelection()
  if (!sel || !sel.rangeCount) return null
  const r = sel.getRangeAt(0)
  if (!root.contains(r.startContainer) || !root.contains(r.endContainer)) return null
  const start = offsetOf(root, r.startContainer, r.startOffset)
  const end = r.collapsed ? start : offsetOf(root, r.endContainer, r.endOffset)
  return { start: Math.min(start, end), end: Math.max(start, end) }
}

/** The DOM position `target` characters in. */
function positionAt(root: HTMLElement, target: number): [Node, number] {
  let acc = 0
  let found: [Node, number] | null = null
  const walk = (node: Node) => {
    const kids = Array.from(node.childNodes)
    for (let k = 0; k < kids.length && !found; k++) {
      const child = kids[k]
      if (child.nodeType === Node.TEXT_NODE) {
        const len = (child as Text).data.length
        if (target <= acc + len) {
          found = [child, target - acc]
          return
        }
        acc += len
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        if ((child as HTMLElement).tagName === 'BR') {
          if (target <= acc) {
            found = [node, k]
            return
          }
          acc += 1
        } else {
          walk(child)
        }
      }
    }
  }
  walk(root)
  return found ?? [root, root.childNodes.length]
}

export function setSelection(root: HTMLElement, start: number, end = start) {
  const sel = window.getSelection()
  if (!sel) return
  const range = document.createRange()
  const [a, ao] = positionAt(root, start)
  range.setStart(a, ao)
  if (end !== start) {
    const [b, bo] = positionAt(root, end)
    range.setEnd(b, bo)
  } else {
    range.collapse(true)
  }
  sel.removeAllRanges()
  sel.addRange(range)
}

/** The caret's box on screen, when the browser will say. */
export function caretRect(root: HTMLElement): DOMRect | null {
  const sel = window.getSelection()
  if (!sel || !sel.rangeCount) return null
  const r = sel.getRangeAt(0)
  if (!root.contains(r.startContainer)) return null
  const rects = r.getClientRects()
  if (rects.length) return rects[rects.length - 1]
  const b = r.getBoundingClientRect()
  return b.width || b.height ? b : null
}

/**
 * Is the caret on the first (or last) line of this block? Arrow up from the
 * first line goes to the block above; from anywhere else it moves a line.
 */
export function caretLine(root: HTMLElement): { first: boolean; last: boolean } {
  const rect = caretRect(root)
  if (!rect || !root.textContent) return { first: true, last: true }
  const box = root.getBoundingClientRect()
  const st = getComputedStyle(root)
  const line = parseFloat(st.lineHeight) || rect.height || 20
  return {
    first: rect.top - (box.top + parseFloat(st.paddingTop || '0')) < line * 0.75,
    last: box.bottom - parseFloat(st.paddingBottom || '0') - rect.bottom < line * 0.75,
  }
}

/**
 * The caret put at a point on screen — arrowing up from halfway along a line
 * lands halfway along the line above, as it does in any editor.
 */
export function caretToPoint(root: HTMLElement, x: number, line: 'first' | 'last'): boolean {
  const box = root.getBoundingClientRect()
  const st = getComputedStyle(root)
  const lh = parseFloat(st.lineHeight) || 20
  const y = line === 'first' ? box.top + parseFloat(st.paddingTop || '0') + lh / 2 : box.bottom - parseFloat(st.paddingBottom || '0') - lh / 2
  const px = Math.max(box.left + 1, Math.min(x, box.right - 1))
  const doc = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null
    caretRangeFromPoint?: (x: number, y: number) => Range | null
  }
  let node: Node | null = null
  let offset = 0
  if (doc.caretPositionFromPoint) {
    const p = doc.caretPositionFromPoint(px, y)
    if (p) {
      node = p.offsetNode
      offset = p.offset
    }
  } else if (doc.caretRangeFromPoint) {
    const r = doc.caretRangeFromPoint(px, y)
    if (r) {
      node = r.startContainer
      offset = r.startOffset
    }
  }
  if (!node || !root.contains(node)) return false
  setSelection(root, offsetOf(root, node, offset))
  return true
}
