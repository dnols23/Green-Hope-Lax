/**
 * The words inside a note block, and the bold and links on them.
 *
 * A block keeps its words as a plain string, exactly as every note has always
 * kept them, and any formatting as ranges laid over that string: "bold from 4
 * to 9". Anything that only wants the words — the one-line summary in the
 * Notes list, the scout's clean-up of old prompts, a search — reads `text` and
 * never sees a marker. A note written before there was formatting is a string
 * with no ranges, which is just what it was.
 *
 * Pure: no DOM here, so the server can check what it is given with the same
 * rules the editor uses.
 */

export type MarkType = 'b' | 'i' | 'u' | 's' | 'code' | 'a'

/** Outermost first — the order the tags nest in when drawn. */
export const MARK_TYPES: MarkType[] = ['a', 'b', 'i', 'u', 's', 'code']

export interface NoteMark {
  type: MarkType
  /** Where it starts, counted in characters of `text`. */
  start: number
  /** Where it stops — the first character not covered. */
  end: number
  /** Links only. */
  href?: string
}

export interface Rich {
  text: string
  marks?: NoteMark[]
}

export const MAX_MARKS = 200

/**
 * A link or picture address that is safe to put in an href or a src.
 *
 * `javascript:` and `data:` are refused outright — a note is shared with the
 * whole staff and a link in it must only ever go somewhere. A bare
 * "youtube.com/watch?v=…" is what people paste, so it gets its https:// back.
 */
export function safeUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  let s = raw.trim()
  if (!s || s.length > 2000 || /\s/.test(s)) return null
  if (s.startsWith('//')) s = `https:${s}`
  if (/^https?:\/\/[^/]/i.test(s)) return s
  if (/^(mailto|tel):/i.test(s)) return s
  // Any other scheme — javascript:, data:, file: — is not a place to send a coach.
  if (/^[a-z][a-z0-9+.-]*:/i.test(s)) return null
  // A page on this site.
  if (s.startsWith('/')) return s
  // example.com, youtu.be/abc — a host with a dot in it.
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)+([/?#:].*)?$/i.test(s)) return `https://${s}`
  return null
}

/** Only an https picture — no mailto or tel for an <img>. */
export function safeImageUrl(raw: unknown): string | null {
  const s = safeUrl(raw)
  return s && (/^https?:\/\//i.test(s) || s.startsWith('/')) ? s : null
}

/**
 * Formatting that makes sense for this many characters: known kinds, inside
 * the text, not empty, and runs of the same kind that touch joined into one.
 */
export function readMarks(raw: unknown, length: number): NoteMark[] {
  if (!Array.isArray(raw)) return []
  const out: NoteMark[] = []
  for (const r of raw.slice(0, MAX_MARKS * 2)) {
    const m = (r ?? {}) as Record<string, unknown>
    const type = m.type as MarkType
    if (!MARK_TYPES.includes(type)) continue
    const start = Math.max(0, Math.min(length, Math.floor(Number(m.start))))
    const end = Math.max(0, Math.min(length, Math.floor(Number(m.end))))
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue
    if (type === 'a') {
      const href = safeUrl(m.href)
      if (!href) continue
      out.push({ type, start, end, href })
    } else {
      out.push({ type, start, end })
    }
  }
  return tidyMarks(out).slice(0, MAX_MARKS)
}

/** Sorted, and overlapping or touching runs of one kind merged. */
export function tidyMarks(marks: NoteMark[]): NoteMark[] {
  const sorted = marks
    .filter((m) => m.end > m.start)
    .sort((a, b) => MARK_TYPES.indexOf(a.type) - MARK_TYPES.indexOf(b.type) || a.start - b.start)
  const out: NoteMark[] = []
  for (const m of sorted) {
    const last = out[out.length - 1]
    if (last && last.type === m.type && m.start <= last.end && (m.type !== 'a' || last.href === m.href)) {
      last.end = Math.max(last.end, m.end)
    } else {
      out.push({ ...m })
    }
  }
  return out
}

export const plain = (text: string): Rich => ({ text, marks: [] })

/** The characters from start to end, with their formatting. */
export function sliceRich(r: Rich, start: number, end = r.text.length): Rich {
  const s = Math.max(0, Math.min(start, r.text.length))
  const e = Math.max(s, Math.min(end, r.text.length))
  const marks = (r.marks ?? [])
    .map((m) => ({ ...m, start: Math.max(m.start, s) - s, end: Math.min(m.end, e) - s }))
    .filter((m) => m.end > m.start)
  return { text: r.text.slice(s, e), marks }
}

/** Two pieces run together: what merging two blocks does. */
export function concatRich(a: Rich, b: Rich): Rich {
  const at = a.text.length
  return {
    text: a.text + b.text,
    marks: tidyMarks([
      ...(a.marks ?? []).map((m) => ({ ...m })),
      ...(b.marks ?? []).map((m) => ({ ...m, start: m.start + at, end: m.end + at })),
    ]),
  }
}

/** Every character from start to end has this kind of mark. */
export function hasMark(r: Rich, start: number, end: number, type: MarkType): boolean {
  if (end <= start) {
    // A caret: inside a mark counts, sitting at its very end counts too.
    return (r.marks ?? []).some((m) => m.type === type && m.start < start && start <= m.end)
  }
  let at = start
  const runs = (r.marks ?? []).filter((m) => m.type === type).sort((a, b) => a.start - b.start)
  for (const m of runs) {
    if (m.start > at) break
    at = Math.max(at, m.end)
    if (at >= end) return true
  }
  return false
}

/** The link under this stretch, if one covers any of it. */
export function linkAt(r: Rich, start: number, end: number): NoteMark | null {
  return (
    (r.marks ?? []).find(
      (m) => m.type === 'a' && (end > start ? m.start < end && m.end > start : m.start < start && start <= m.end)
    ) ?? null
  )
}

function without(marks: NoteMark[], type: MarkType, start: number, end: number): NoteMark[] {
  return marks.flatMap((m) => {
    if (m.type !== type || m.end <= start || m.start >= end) return [m]
    const keep: NoteMark[] = []
    if (m.start < start) keep.push({ ...m, end: start })
    if (m.end > end) keep.push({ ...m, start: end })
    return keep
  })
}

/**
 * Bold on, or off if it is all bold already — what Ctrl+B does. A link is
 * set to the address given, or taken off with none.
 */
export function toggleMark(r: Rich, start: number, end: number, type: MarkType, href?: string | null): Rich {
  if (end <= start) return r
  const marks = r.marks ?? []
  if (type === 'a') {
    const url = href ? safeUrl(href) : null
    const rest = without(marks, 'a', start, end)
    return { text: r.text, marks: tidyMarks(url ? [...rest, { type, start, end, href: url }] : rest) }
  }
  if (hasMark(r, start, end, type)) return { text: r.text, marks: tidyMarks(without(marks, type, start, end)) }
  return { text: r.text, marks: tidyMarks([...marks, { type, start, end }]) }
}

export function sameRich(a: Rich, b: Rich): boolean {
  if (a.text !== b.text) return false
  const am = a.marks ?? []
  const bm = b.marks ?? []
  if (am.length !== bm.length) return false
  return am.every((m, i) => {
    const n = bm[i]
    return m.type === n.type && m.start === n.start && m.end === n.end && (m.href ?? '') === (n.href ?? '')
  })
}

const escape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

const TAG: Record<Exclude<MarkType, 'a'>, string> = { b: 'strong', i: 'em', u: 'u', s: 's', code: 'code' }

/**
 * The HTML an editable block is filled with. Every character is escaped and
 * the only tags are the handful above, so what was typed can never become
 * markup. A line break is a <br>; one at the very end gets a second so the
 * empty line it opens can be seen and typed on.
 */
export function richToHtml(r: Rich): string {
  const text = r.text
  if (!text) return ''
  const marks = tidyMarks(r.marks ?? [])
  const cuts = new Set<number>([0, text.length])
  for (const m of marks) {
    cuts.add(Math.min(m.start, text.length))
    cuts.add(Math.min(m.end, text.length))
  }
  const points = [...cuts].sort((a, b) => a - b)
  let html = ''
  for (let k = 0; k < points.length - 1; k++) {
    const from = points[k]
    const to = points[k + 1]
    if (to <= from) continue
    const on = marks.filter((m) => m.start <= from && m.end >= to)
    let piece = escape(text.slice(from, to)).replace(/\n/g, '<br>')
    // Innermost first, so the outermost wraps last.
    for (const type of [...MARK_TYPES].reverse()) {
      const m = on.filter((x) => x.type === type).pop()
      if (!m) continue
      piece =
        type === 'a'
          ? `<a href="${escape(m.href ?? '')}" target="_blank" rel="noopener noreferrer">${piece}</a>`
          : `<${TAG[type]}>${piece}</${TAG[type]}>`
    }
    html += piece
  }
  if (text.endsWith('\n')) html += '<br>'
  return html
}
