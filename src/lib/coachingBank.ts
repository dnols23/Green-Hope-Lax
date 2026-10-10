import { createServiceClient } from './supabase-server'

// The Coaching Bank: the head coach's philosophy, filed by area of coaching,
// for the staff to go through. He writes it; every coach reads it.
// Coach-only data behind the service client, like the rest of the hub.

export interface CoachingArea {
  label: string
  icon: string
}

/** The areas every bank starts with, in reading order. New ones he types go after. */
export const COACHING_AREAS: CoachingArea[] = [
  { label: 'Culture & Standards', icon: '🏛' },
  { label: 'Leadership', icon: '🧢' },
  { label: 'Teaching & Communication', icon: '🗣' },
  { label: 'Practice Planning', icon: '🗒' },
  { label: 'Running Drills', icon: '🏃' },
  { label: 'Player Development', icon: '📈' },
  { label: 'Offense', icon: '⚔️' },
  { label: 'Defense', icon: '🛡' },
  { label: 'Transition', icon: '🔁' },
  { label: 'Faceoffs', icon: '🎯' },
  { label: 'Goalies', icon: '🥅' },
  { label: 'Game Day', icon: '🏟' },
  { label: 'Recruiting & College', icon: '🎓' },
]

export const AREA_MAX = 60

export interface CoachingEntry {
  id: string
  area: string
  title: string
  url: string | null
  point: string | null
  notes: string | null
  position: number
  addedBy: string | null
  createdAt: string
}

const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v : null)

/** "Running Drills" ↔ "running-drills", for the address bar. */
export const areaSlug = (label: string) =>
  label
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

export function cleanArea(v: unknown): string {
  return String(v ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, AREA_MAX)
}

/** Every area to show: the defaults in their order, then any he started, A–Z. */
export function areasOf(entries: Pick<CoachingEntry, 'area'>[]): CoachingArea[] {
  const known = new Set(COACHING_AREAS.map((a) => areaSlug(a.label)))
  const extra = new Map<string, string>()
  for (const e of entries) {
    const slug = areaSlug(e.area)
    if (slug && !known.has(slug) && !extra.has(slug)) extra.set(slug, e.area)
  }
  return [
    ...COACHING_AREAS,
    ...[...extra.values()].sort((a, b) => a.localeCompare(b)).map((label) => ({ label, icon: '📌' })),
  ]
}

/** The same area however it was capitalised: "running drills" files under "Running Drills". */
export function canonicalArea(label: string, entries: Pick<CoachingEntry, 'area'>[] = []): string {
  const slug = areaSlug(label)
  return (
    COACHING_AREAS.find((a) => areaSlug(a.label) === slug)?.label ??
    entries.find((e) => areaSlug(e.area) === slug)?.area ??
    label
  )
}

export type ClipKind = 'instagram' | 'youtube' | 'vimeo'

export interface Clip {
  kind: ClipKind
  /** What goes in the iframe. */
  src: string
  /** Portrait (a Reel, a Short) or a landscape video. */
  tall: boolean
}

/** A clip the page can play in place, or null for a plain link. */
export function clipOf(url: string | null): Clip | null {
  if (!url) return null
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return null
  }
  const host = u.hostname.replace(/^(www\.|m\.)/, '')
  const parts = u.pathname.split('/').filter(Boolean)

  if (host === 'instagram.com') {
    const i = parts.findIndex((p) => p === 'reel' || p === 'reels' || p === 'p' || p === 'tv')
    const code = i >= 0 ? parts[i + 1] : null
    if (!code || !/^[\w-]+$/.test(code)) return null
    return { kind: 'instagram', src: `https://www.instagram.com/p/${code}/embed/`, tall: true }
  }
  if (host === 'youtube.com' || host === 'youtu.be' || host === 'youtube-nocookie.com') {
    const id =
      host === 'youtu.be'
        ? parts[0]
        : parts[0] === 'shorts' || parts[0] === 'embed' || parts[0] === 'live'
          ? parts[1]
          : u.searchParams.get('v')
    if (!id || !/^[\w-]{6,}$/.test(id)) return null
    return { kind: 'youtube', src: `https://www.youtube-nocookie.com/embed/${id}`, tall: parts[0] === 'shorts' }
  }
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const id = parts.find((p) => /^\d+$/.test(p))
    if (!id) return null
    return { kind: 'vimeo', src: `https://player.vimeo.com/video/${id}`, tall: false }
  }
  return null
}

function shape(r: Record<string, unknown>): CoachingEntry {
  return {
    id: String(r.id),
    area: String(r.area ?? ''),
    title: String(r.title ?? ''),
    url: text(r.url),
    point: text(r.point),
    notes: text(r.notes),
    position: Number(r.position) || 0,
    addedBy: text(r.added_by),
    createdAt: String(r.created_at ?? ''),
  }
}

/** The whole bank in reading order — or null when the table isn't there yet. */
export async function listCoachingEntries(): Promise<CoachingEntry[] | null> {
  const { data, error } = await createServiceClient()
    .from('coaching_entries')
    .select('*')
    .order('position', { ascending: true })
    .order('created_at', { ascending: false })
  if (error) return null
  return ((data ?? []) as Record<string, unknown>[]).map(shape)
}

export async function getCoachingEntry(id: string): Promise<CoachingEntry | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null
  const { data } = await createServiceClient().from('coaching_entries').select('*').eq('id', id).maybeSingle()
  return data ? shape(data as Record<string, unknown>) : null
}
