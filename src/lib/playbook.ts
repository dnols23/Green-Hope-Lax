// The Playbook: what we are actually running, in order, with the words round it.
//
// The Library is a shelf — everything anybody kept, in case. This is the deck:
// a page per play, a title, the reads, the coaching points, and the pages that
// are only words. Varsity and JV keep their own, and the head coach is the only
// one who writes either.
//
// Pure — the editor and the viewer both import it.

import { DEFAULT_TEAM, isTeam, type Team } from './teams'

export const PLAYBOOK_KEY = 'playbook'

/** How a page arranges what is on it. */
export type PageLayout = 'split' | 'stack' | 'full'

export const PAGE_LAYOUTS: { key: PageLayout; label: string; hint: string }[] = [
  { key: 'split', label: 'Side by side', hint: 'The play on the left, the words on the right.' },
  { key: 'stack', label: 'Stacked', hint: 'The words under the play — better on a phone.' },
  { key: 'full', label: 'Full bleed', hint: 'The play as big as the page allows.' },
]

export function isLayout(v: unknown): v is PageLayout {
  return v === 'split' || v === 'stack' || v === 'full'
}

export type TextSize = 'heading' | 'body' | 'small'

export const TEXT_SIZES: { key: TextSize; label: string }[] = [
  { key: 'heading', label: 'Heading' },
  { key: 'body', label: 'Body' },
  { key: 'small', label: 'Small print' },
]

export interface PlayBlock {
  kind: 'play'
  id: string
  playId: string
  caption?: string
}
export interface ShotBlock {
  kind: 'shot'
  id: string
  url: string
  caption?: string
}
export interface TextBlock {
  kind: 'text'
  id: string
  body: string
  size: TextSize
}
export interface ListBlock {
  kind: 'list'
  id: string
  items: string[]
  /** "Reads", "Coaching points", "If they slide early" — whatever the list is. */
  heading?: string
}

export type SlideBlock = PlayBlock | ShotBlock | TextBlock | ListBlock

export const BLOCK_KINDS: { kind: SlideBlock['kind']; label: string; icon: string }[] = [
  { kind: 'play', label: 'A play off the board', icon: '🖍' },
  { kind: 'shot', label: 'A picture from the Library', icon: '🖼' },
  { kind: 'text', label: 'Words', icon: '✍️' },
  { kind: 'list', label: 'A list of points', icon: '•' },
]

export interface PlaybookPage {
  id: string
  team: Team
  sortOrder: number
  title: string
  blocks: SlideBlock[]
  layout: PageLayout
  notes: string | null
  createdBy: string | null
  updatedAt: string
}

/** Playbook-level settings, kept in app_settings so they need no migration. */
export interface PlaybookSettings {
  title: string
  /** On the players' side of the Team Hub. */
  publishPlayers: boolean
  /** Readable by the rest of the coaching staff. */
  publishCoaches: boolean
}

export const DEFAULT_SETTINGS: PlaybookSettings = {
  title: 'Playbook',
  publishPlayers: false,
  publishCoaches: false,
}

export function settingsKey(team: Team): string {
  return `${PLAYBOOK_KEY}:${team}`
}

export function readSettings(raw: unknown): PlaybookSettings {
  if (typeof raw !== 'string' || !raw) return { ...DEFAULT_SETTINGS }
  try {
    const o = JSON.parse(raw) as Partial<PlaybookSettings>
    return {
      title: typeof o.title === 'string' && o.title.trim() ? o.title : DEFAULT_SETTINGS.title,
      publishPlayers: o.publishPlayers === true,
      publishCoaches: o.publishCoaches === true,
    }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

// ── Reading a page back out of the database ──────────────────────────────────

const str = (v: unknown, fallback = '') => (typeof v === 'string' ? v : fallback)

/**
 * One block, kept honest.
 *
 * Anything that doesn't read as a block it recognises is dropped rather than
 * rendered as a hole — a half-written page from a future version of this file
 * should lose that block, not take the page down with it.
 */
export function readBlock(raw: unknown): SlideBlock | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const id = str(o.id) || Math.random().toString(36).slice(2)
  switch (o.kind) {
    case 'play': {
      const playId = str(o.playId)
      return playId ? { kind: 'play', id, playId, caption: str(o.caption) || undefined } : null
    }
    case 'shot': {
      const url = str(o.url)
      return url ? { kind: 'shot', id, url, caption: str(o.caption) || undefined } : null
    }
    case 'text': {
      const size = o.size === 'heading' || o.size === 'small' ? o.size : 'body'
      return { kind: 'text', id, body: str(o.body), size }
    }
    case 'list': {
      const items = Array.isArray(o.items) ? o.items.map((i) => str(i)).filter(Boolean) : []
      return { kind: 'list', id, items, heading: str(o.heading) || undefined }
    }
    default:
      return null
  }
}

export function readBlocks(raw: unknown): SlideBlock[] {
  if (!Array.isArray(raw)) return []
  return raw.map(readBlock).filter((b): b is SlideBlock => b !== null)
}

export function readPage(row: Record<string, unknown>): PlaybookPage {
  return {
    id: String(row.id),
    team: isTeam(row.team) ? row.team : DEFAULT_TEAM,
    sortOrder: Number(row.sort_order) || 0,
    title: str(row.title),
    blocks: readBlocks(row.blocks),
    layout: isLayout(row.layout) ? row.layout : 'split',
    notes: (row.notes as string) ?? null,
    createdBy: (row.created_by as string) ?? null,
    updatedAt: String(row.updated_at ?? ''),
  }
}

// ── Making one ───────────────────────────────────────────────────────────────

let seq = 0
/** Ids only have to be unique inside one page. */
export function blockId(): string {
  seq += 1
  return `b${seq}-${Math.random().toString(36).slice(2, 8)}`
}

export function emptyBlock(kind: SlideBlock['kind']): SlideBlock {
  const id = blockId()
  switch (kind) {
    case 'play':
      return { kind: 'play', id, playId: '' }
    case 'shot':
      return { kind: 'shot', id, url: '' }
    case 'list':
      return { kind: 'list', id, items: [''] }
    default:
      return { kind: 'text', id, body: '', size: 'body' }
  }
}

/** The play a page leads with, for the thumbnail on the deck screen. */
export function leadPlayId(page: PlaybookPage): string | null {
  const found = page.blocks.find((b) => b.kind === 'play') as PlayBlock | undefined
  return found?.playId || null
}

/** A page with nothing on it reads as a section divider, not a mistake. */
export function isDivider(page: PlaybookPage): boolean {
  return page.blocks.length === 0
}

/** Move a page within the deck, returning the new order of ids. */
export function reorder(ids: string[], from: number, to: number): string[] {
  if (from === to || from < 0 || to < 0 || from >= ids.length || to >= ids.length) return ids
  const next = [...ids]
  next.splice(to, 0, next.splice(from, 1)[0])
  return next
}
