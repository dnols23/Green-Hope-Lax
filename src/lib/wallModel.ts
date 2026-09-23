// On the Wall — quotes played like music.
//
// Pure: the shapes, the covers and the arithmetic of a play queue (shuffle,
// repeat, next and back). The War Room panel, the full player and the wall mode
// all move through a playlist the same way because they all ask this file.

export interface WallQuote {
  id: string
  line: string
  who: string | null
  addedBy: string | null
  addedByName: string | null
  createdAt: string
}

export interface WallPlaylist {
  id: string
  name: string
  description: string | null
  ownerEmail: string
  ownerName: string | null
  shared: boolean
  cover: CoverKey
  emoji: string | null
  /** Quote ids, in play order. */
  quoteIds: string[]
  /** Whether the viewer may rename it, reorder it, add to it and delete it. */
  editable: boolean
}

export interface WallLibrary {
  /** False until 0040_wall.sql has been run; the wall still plays the built-ins. */
  ready: boolean
  quotes: WallQuote[]
  playlists: WallPlaylist[]
  /** Quote ids the viewer has hearted. */
  liked: string[]
  me: string
  isOwner: boolean
}

// ── Where the music comes from ───────────────────────────────────────────────

/** Two sources every coach has, and then the playlists. */
export const ALL_SOURCE = 'all'
export const LIKED_SOURCE = 'liked'

export function sourceIds(lib: WallLibrary, source: string): string[] {
  if (source === LIKED_SOURCE) {
    const liked = new Set(lib.liked)
    // Newest heart first, like a liked-songs list.
    return [...lib.liked].reverse().filter((id) => liked.has(id) && lib.quotes.some((q) => q.id === id))
  }
  const list = lib.playlists.find((p) => p.id === source)
  if (list) return list.quoteIds.filter((id) => lib.quotes.some((q) => q.id === id))
  return lib.quotes.map((q) => q.id)
}

export function sourceName(lib: WallLibrary, source: string): string {
  if (source === LIKED_SOURCE) return 'Liked quotes'
  return lib.playlists.find((p) => p.id === source)?.name ?? 'All quotes'
}

// ── Covers ───────────────────────────────────────────────────────────────────

export type CoverKey = 'green' | 'maroon' | 'gold' | 'night' | 'sky' | 'ember' | 'field' | 'steel'

/** Two-tone gradients a playlist tile can wear. Text on them is always white. */
export const COVERS: { key: CoverKey; label: string; from: string; to: string }[] = [
  { key: 'green', label: 'Falcon green', from: '#00693E', to: '#003d24' },
  { key: 'maroon', label: 'Maroon', from: '#8a2432', to: '#4a1119' },
  { key: 'gold', label: 'Gold', from: '#b07d00', to: '#5c4100' },
  { key: 'night', label: 'Night', from: '#1f2937', to: '#030712' },
  { key: 'sky', label: 'Sky', from: '#2a78d6', to: '#15407a' },
  { key: 'ember', label: 'Ember', from: '#d9541e', to: '#7a2708' },
  { key: 'field', label: 'Field', from: '#3f8f3a', to: '#1c4a1a' },
  { key: 'steel', label: 'Steel', from: '#4a5568', to: '#1a202c' },
]

export function isCoverKey(v: unknown): v is CoverKey {
  return COVERS.some((c) => c.key === v)
}

export function coverOf(key: string | null | undefined) {
  return COVERS.find((c) => c.key === key) ?? COVERS[0]
}

export function coverCss(key: string | null | undefined): string {
  const c = coverOf(key)
  return `linear-gradient(135deg, ${c.from} 0%, ${c.to} 100%)`
}

export const COVER_EMOJI = ['🔥', '🦅', '🥍', '💪', '🧠', '🏆', '⚔️', '🎯', '🛡', '⚡', '🗣', '❤️']

// ── The queue ────────────────────────────────────────────────────────────────

export type RepeatMode = 'off' | 'all' | 'one'

export const REPEAT_NEXT: Record<RepeatMode, RepeatMode> = { off: 'all', all: 'one', one: 'off' }

export function isRepeatMode(v: unknown): v is RepeatMode {
  return v === 'off' || v === 'all' || v === 'one'
}

/** How long each quote holds the wall before the next, in seconds. */
export const DWELL_CHOICES = [8, 12, 20, 30, 60]
export const DEFAULT_DWELL = 12

/** A small seeded shuffle, so the same seed gives the same order on every render. */
function rng(seed: number) {
  let s = seed >>> 0 || 1
  return () => {
    s ^= s << 13
    s >>>= 0
    s ^= s >>> 17
    s ^= s << 5
    s >>>= 0
    return s / 4294967296
  }
}

/**
 * The order a source plays in.
 *
 * Straight through unless shuffled. Shuffled, it is a fixed permutation for the
 * seed, with `first` pulled to the front — so switching shuffle on keeps the
 * quote on the wall where it is and shuffles what comes after, the way every
 * music app does it.
 */
export function playOrder(ids: string[], shuffle: boolean, seed: number, first?: string | null): string[] {
  if (!shuffle) return [...ids]
  const out = [...ids]
  const r = rng(seed)
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  if (first) {
    const at = out.indexOf(first)
    if (at > 0) {
      out.splice(at, 1)
      out.unshift(first)
    }
  }
  return out
}

/**
 * Where "next" goes. Null means the queue has run out and the player stops.
 *
 * `auto` is the timer running out rather than a tap: repeat-one holds the same
 * quote for another turn, but a tap on next always moves on, as it does in any
 * player.
 */
export function nextIndex(at: number, length: number, repeat: RepeatMode, auto: boolean): number | null {
  if (length === 0) return null
  if (auto && repeat === 'one') return at
  if (at + 1 < length) return at + 1
  return repeat === 'off' && auto ? null : 0
}

/** Where "back" goes: the previous quote, wrapping round when repeat is on. */
export function prevIndex(at: number, length: number, repeat: RepeatMode): number {
  if (length === 0) return 0
  if (at > 0) return at - 1
  return repeat === 'off' ? 0 : length - 1
}

/**
 * The same quote for the whole staff all day, a different one tomorrow — the
 * wall before anybody presses play.
 */
export function quoteIndexForDay(isoDate: string, length: number): number {
  if (length <= 0) return 0
  let hash = 0
  for (const ch of isoDate) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  return hash % length
}

/** Strip, trim and cap what a coach types before it is saved. */
export function cleanLine(raw: unknown, max = 600): string {
  return String(raw ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^["“”']+|["“”']+$/g, '')
    .trim()
    .slice(0, max)
}
