import { createServiceClient } from './supabase-server'

// The program's wish list: what it needs, what it wants, who to ask and how.
// Coach-only data behind the service client, like the rest of the hub.

export type WishKind = 'need' | 'want'
export type WishStatus = 'pending' | 'approved' | 'rejected'
export type WishTeam = 'program' | 'varsity' | 'jv'

export const WISH_KINDS: { key: WishKind; label: string; plural: string }[] = [
  { key: 'need', label: 'Need', plural: 'Needs' },
  { key: 'want', label: 'Want', plural: 'Wants' },
]

export const WISH_STATUSES: { key: WishStatus; label: string }[] = [
  { key: 'pending', label: 'Open' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
]

export const WISH_TEAMS: { key: WishTeam; label: string }[] = [
  { key: 'program', label: 'Program' },
  { key: 'varsity', label: 'Varsity' },
  { key: 'jv', label: 'JV' },
]

export const isWishKind = (v: unknown): v is WishKind => v === 'need' || v === 'want'
export const isWishStatus = (v: unknown): v is WishStatus => v === 'pending' || v === 'approved' || v === 'rejected'
export const isWishTeam = (v: unknown): v is WishTeam => v === 'program' || v === 'varsity' || v === 'jv'

export interface WishItem {
  id: string
  title: string
  kind: WishKind
  team: WishTeam
  cost: string | null
  link: string | null
  contact: string | null
  pitch: string | null
  status: WishStatus
  nextSteps: string | null
  decidedAt: string | null
  addedBy: string | null
  addedByName: string | null
  createdAt: string
}

const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v : null)

function shape(r: Record<string, unknown>): WishItem {
  return {
    id: String(r.id),
    title: String(r.title ?? ''),
    kind: isWishKind(r.kind) ? r.kind : 'want',
    team: isWishTeam(r.team) ? r.team : 'program',
    cost: text(r.cost),
    link: text(r.link),
    contact: text(r.contact),
    pitch: text(r.pitch),
    status: isWishStatus(r.status) ? r.status : 'pending',
    nextSteps: text(r.next_steps),
    decidedAt: text(r.decided_at),
    addedBy: text(r.added_by),
    addedByName: text(r.added_by_name),
    createdAt: String(r.created_at ?? ''),
  }
}

/** The whole list, newest first — or null when the table isn't there yet. */
export async function listWishes(): Promise<WishItem[] | null> {
  const { data, error } = await createServiceClient()
    .from('wish_items')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) return null
  return ((data ?? []) as Record<string, unknown>[]).map(shape)
}

export async function getWish(id: string): Promise<WishItem | null> {
  const { data } = await createServiceClient().from('wish_items').select('*').eq('id', id).maybeSingle()
  return data ? shape(data as Record<string, unknown>) : null
}
