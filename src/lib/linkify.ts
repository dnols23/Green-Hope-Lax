// Splits plain text into runs of text and links.
//
// News and announcement bodies are typed into a plain textarea, so a pasted URL
// arrives as ordinary text. This turns those into real links without letting any
// other markup through — the pieces are rendered by React, which escapes them.

export interface LinkPiece {
  href: string
  /** What to show — a long share URL is trimmed down so it stays readable. */
  label: string
}

export type Piece = string | LinkPiece

const URL_RE = /https?:\/\/[^\s<>"']+/g

/** Punctuation that almost always belongs to the sentence, not the URL. */
const TRAILING = '.,;:!?'

function trimTrailing(url: string): { url: string; rest: string } {
  let end = url.length
  while (end > 0) {
    const ch = url[end - 1]
    if (TRAILING.includes(ch)) { end--; continue }
    // A closing bracket only counts as part of the URL if it was opened in it.
    if (ch === ')' || ch === ']') {
      const open = ch === ')' ? '(' : '['
      const slice = url.slice(0, end)
      const opens = slice.split(open).length - 1
      const closes = slice.split(ch).length - 1
      if (closes > opens) { end--; continue }
    }
    break
  }
  return { url: url.slice(0, end), rest: url.slice(end) }
}

/** A long URL shown in full wraps badly on a phone, so show the readable part. */
export function displayUrl(href: string): string {
  const trim = (s: string) => s.replace(/\/+$/, '')
  const bare = trim(href.replace(/^https?:\/\//, ''))
  if (bare.length <= 48) return bare
  const noQuery = trim(bare.split('?')[0])
  if (noQuery.length <= 48) return noQuery
  return noQuery.slice(0, 47) + '…'
}

export function linkify(text: string): Piece[] {
  const pieces: Piece[] = []
  let last = 0
  for (const match of text.matchAll(URL_RE)) {
    const start = match.index
    const { url, rest } = trimTrailing(match[0])
    if (!url) continue
    if (start > last) pieces.push(text.slice(last, start))
    pieces.push({ href: url, label: displayUrl(url) })
    if (rest) pieces.push(rest)
    last = start + match[0].length
  }
  if (last < text.length) pieces.push(text.slice(last))
  return pieces
}
