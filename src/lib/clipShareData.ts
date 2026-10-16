// Reading who clips were sent to, and each viewer's Film Room. Server only.
// The clip tables have no policies for signed-in reads; everything here goes
// through the server's own key, after the caller has been identified.

import { createServiceClient } from './supabase-server'
import { getViewer } from './permissions'
import { currentPlayer } from './playerAccess'
import { currentParent } from './parentAccess'
import { listStaff } from './staff'
import { filmHlsUrl, filmThumbUrl, getCfConfig } from './film'
import {
  isShareGroup,
  isSharePerson,
  reaches,
  sharesFor,
  viewerKey,
  type FilmViewer,
  type Recipient,
  type Share,
  type ShareTarget,
} from './clipShare'

export type FilmHub = 'admin' | 'team' | 'parents'

type Row = Record<string, unknown>
type Page = PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>

/** Every row, a page at a time — Supabase hands back at most 1000 per request. */
async function allRows(page: (from: number, to: number) => Page): Promise<Row[]> {
  const rows: Row[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await page(from, from + 999)
    if (error) throw new Error(error.message)
    const got = (data ?? []) as Row[]
    rows.push(...got)
    if (got.length < 1000) return rows
  }
}

/**
 * Who is watching, for the hub they are in. A coach in the Coaches Hub, a
 * player signed in as themselves in the Team Hub, a parent in the Parent Hub.
 * Someone in on the shared team code alone isn't anybody in particular, so
 * has no Film Room of their own.
 */
export async function filmViewerFor(hub: FilmHub): Promise<FilmViewer | null> {
  if (hub === 'admin') {
    const v = await getViewer()
    if (!v) return null
    return { kind: 'coach', key: viewerKey('coach', v.email), id: v.email.toLowerCase(), name: v.name || v.email, team: null }
  }
  if (hub === 'team') {
    const p = await currentPlayer()
    if (!p) return null
    const team = p.team === 'boys_jv' ? 'jv' : p.team === 'boys_varsity' ? 'varsity' : null
    return { kind: 'player', key: viewerKey('player', p.id), id: p.id, name: p.name, team }
  }
  const parent = await currentParent()
  if (!parent) return null
  return { kind: 'parent', key: viewerKey('parent', parent.id), id: parent.id, name: parent.name, team: null }
}

function readShare(r: Record<string, unknown>): Share | null {
  const target = r.target
  if (!isShareGroup(target) && !isSharePerson(target)) return null
  return { target: target as ShareTarget, targetId: String(r.target_id ?? '') }
}

/** The clips sent to this viewer, with when each was sent (the latest send). */
async function clipsSentTo(viewer: FilmViewer): Promise<Map<number, string>> {
  const targets = [...new Set(sharesFor(viewer).map((s) => s.target))]
  const svc = createServiceClient()
  const rows = await allRows((a, b) =>
    svc.from('clip_shares').select('clip_id, target, target_id, shared_by, created_at').in('target', targets).order('id').range(a, b)
  )
  const sent = new Map<number, string>()
  for (const r of rows) {
    const s = readShare(r)
    if (!s || !reaches(s, viewer)) continue
    // The head coach sending to "All coaches" isn't sending to himself.
    if (viewer.kind === 'coach' && String(r.shared_by ?? '').toLowerCase() === viewer.id) continue
    const id = Number(r.clip_id)
    const at = String(r.created_at ?? '')
    if (!sent.has(id) || at > sent.get(id)!) sent.set(id, at)
  }
  return sent
}

/** Was this clip sent to this viewer? Every write a viewer makes checks it. */
export async function clipReaches(viewer: FilmViewer, clipId: number): Promise<boolean> {
  const targets = [...new Set(sharesFor(viewer).map((s) => s.target))]
  const { data } = await createServiceClient()
    .from('clip_shares')
    .select('target, target_id')
    .eq('clip_id', clipId)
    .in('target', targets)
  return ((data ?? []) as Record<string, unknown>[]).some((r) => {
    const s = readShare(r)
    return !!s && reaches(s, viewer)
  })
}

export interface ClipMessage {
  id: string
  fromCoach: boolean
  author: string
  body: string
  createdAt: string
  readAt: string | null
}

function readMessage(r: Record<string, unknown>): ClipMessage {
  return {
    id: String(r.id),
    fromCoach: r.from_coach === true,
    author: String(r.author ?? r.viewer_name ?? ''),
    body: String(r.body ?? ''),
    createdAt: String(r.created_at ?? ''),
    readAt: (r.read_at as string) ?? null,
  }
}

export interface FeedClip {
  id: number
  name: string
  start: number
  end: number
  /** The coach's notes on the clip. */
  notes: string | null
  /** A question the coach asked, answered by replying. */
  prompt: string | null
  sentAt: string
  film: { id: number; name: string; url: string; thumb: string } | null
  seen: boolean
  myNote: string
  thread: ClipMessage[]
  /** Coach replies this viewer hasn't opened yet. */
  unreadFromCoach: number
}

/** A viewer's Film Room: what was sent to them, newest first. */
export async function feedFor(viewer: FilmViewer): Promise<FeedClip[]> {
  const sent = await clipsSentTo(viewer)
  const ids = [...sent.keys()]
  if (!ids.length) return []
  const svc = createServiceClient()
  const cf = getCfConfig()
  const [clips, views, notes, messages] = await Promise.all([
    svc.from('team_clips').select('id, video_id, name, start_time, end_time, notes, prompt').in('id', ids),
    svc.from('clip_views').select('clip_id').eq('viewer', viewer.key).in('clip_id', ids),
    svc.from('clip_viewer_notes').select('clip_id, body').eq('viewer', viewer.key).in('clip_id', ids),
    svc.from('clip_messages').select('*').eq('viewer', viewer.key).in('clip_id', ids).order('created_at', { ascending: true }),
  ])
  const clipRows = (clips.data ?? []) as Record<string, unknown>[]
  const videoIds = [...new Set(clipRows.map((c) => Number(c.video_id)))]
  const { data: videos } = videoIds.length
    ? await svc.from('team_videos').select('id, uid, name').in('id', videoIds)
    : { data: [] }
  const videoById = new Map(((videos ?? []) as Record<string, unknown>[]).map((v) => [Number(v.id), v]))
  const seen = new Set(((views.data ?? []) as { clip_id: number }[]).map((v) => Number(v.clip_id)))
  const noteBy = new Map(((notes.data ?? []) as { clip_id: number; body: string }[]).map((n) => [Number(n.clip_id), n.body]))
  const threadBy = new Map<number, ClipMessage[]>()
  for (const m of (messages.data ?? []) as Record<string, unknown>[]) {
    const id = Number(m.clip_id)
    threadBy.set(id, [...(threadBy.get(id) ?? []), readMessage(m)])
  }

  return clipRows
    .map((c): FeedClip => {
      const id = Number(c.id)
      const v = videoById.get(Number(c.video_id))
      const thread = threadBy.get(id) ?? []
      return {
        id,
        name: String(c.name ?? 'Clip'),
        start: Number(c.start_time) || 0,
        end: Number(c.end_time) || 0,
        notes: (c.notes as string) || null,
        prompt: (c.prompt as string) || null,
        sentAt: sent.get(id) ?? '',
        film:
          v && cf
            ? {
                id: Number(v.id),
                name: String(v.name ?? ''),
                url: filmHlsUrl(cf.customerCode, String(v.uid)),
                thumb: filmThumbUrl(cf.customerCode, String(v.uid)),
              }
            : null,
        seen: seen.has(id),
        myNote: noteBy.get(id) ?? '',
        thread,
        unreadFromCoach: thread.filter((m) => m.fromCoach && !m.readAt).length,
      }
    })
    .sort((a, b) => b.sentAt.localeCompare(a.sentAt))
}

/** How much is waiting: clips not yet watched, and coach replies not yet read. */
export async function newForViewer(viewer: FilmViewer): Promise<number> {
  try {
    const sent = await clipsSentTo(viewer)
    const ids = [...sent.keys()]
    if (!ids.length) return 0
    const svc = createServiceClient()
    const [{ data: views }, { count }] = await Promise.all([
      svc.from('clip_views').select('clip_id').eq('viewer', viewer.key).in('clip_id', ids),
      svc
        .from('clip_messages')
        .select('id', { count: 'exact', head: true })
        .eq('viewer', viewer.key)
        .eq('from_coach', true)
        .is('read_at', null),
    ])
    const seen = new Set(((views ?? []) as { clip_id: number }[]).map((v) => Number(v.clip_id)))
    return ids.filter((id) => !seen.has(id)).length + (count ?? 0)
  } catch {
    return 0
  }
}

/** Replies waiting for the head coach. */
export async function unreadReplies(): Promise<number> {
  try {
    const { count } = await createServiceClient()
      .from('clip_messages')
      .select('id', { count: 'exact', head: true })
      .eq('from_coach', false)
      .is('read_at', null)
    return count ?? 0
  } catch {
    return 0
  }
}

/** Everyone a clip can be sent to by name: the staff, this season's players, the parents. */
export async function listRecipients(ownerEmail: string): Promise<Recipient[]> {
  const svc = createServiceClient()
  const [staff, players, parents] = await Promise.all([
    listStaff(),
    svc.from('players').select('id, name, number, team').eq('is_active', true).order('name'),
    svc.from('parents').select('id, name, player_name').order('name'),
  ])
  const coaches: Recipient[] = staff
    .filter((s) => s.email.toLowerCase() !== ownerEmail.toLowerCase())
    .map((s) => ({ kind: 'coach', id: s.email.toLowerCase(), name: s.name || s.email, detail: 'Coach' }))
  const kids: Recipient[] = ((players.data ?? []) as Record<string, unknown>[]).map((p) => ({
    kind: 'player',
    id: String(p.id),
    name: String(p.name ?? ''),
    detail: [p.number != null && String(p.number).trim() ? `#${String(p.number).trim()}` : null, p.team === 'boys_jv' ? 'JV' : 'Varsity']
      .filter(Boolean)
      .join(' · '),
  }))
  const folks: Recipient[] = ((parents.data ?? []) as Record<string, unknown>[]).map((p) => ({
    kind: 'parent',
    id: String(p.id),
    name: String(p.name ?? ''),
    detail: p.player_name ? `Parent of ${String(p.player_name)}` : 'Parent',
  }))
  return [...coaches, ...kids, ...folks].filter((r) => r.name)
}

export interface ClipShareInfo {
  shares: Share[]
  /** How many people have watched it. */
  watched: number
  /** Replies on it the head coach hasn't read. */
  unread: number
  /** Conversations on it. */
  threads: number
}

/** For the head coach's clip list: who each clip went to and how it's landing. */
export async function shareInfo(): Promise<Record<number, ClipShareInfo>> {
  const svc = createServiceClient()
  const [shares, views, messages] = await Promise.all([
    allRows((a, b) => svc.from('clip_shares').select('clip_id, target, target_id, created_at').order('created_at').order('id').range(a, b)),
    allRows((a, b) => svc.from('clip_views').select('clip_id').order('clip_id').order('viewer').range(a, b)),
    allRows((a, b) => svc.from('clip_messages').select('clip_id, viewer, from_coach, read_at').order('created_at').order('id').range(a, b)),
  ])
  const out: Record<number, ClipShareInfo> = {}
  const get = (id: number) => (out[id] ??= { shares: [], watched: 0, unread: 0, threads: 0 })
  for (const r of shares) {
    const s = readShare(r)
    if (s) get(Number(r.clip_id)).shares.push(s)
  }
  for (const r of views) get(Number(r.clip_id)).watched++
  const threads = new Set<string>()
  for (const r of messages) {
    const id = Number(r.clip_id)
    const key = `${id}|${r.viewer}`
    if (!threads.has(key)) {
      threads.add(key)
      get(id).threads++
    }
    if (r.from_coach !== true && !r.read_at) get(id).unread++
  }
  return out
}

export interface ReplyThread {
  clipId: number
  clipName: string
  prompt: string | null
  film: { url: string; thumb: string } | null
  start: number
  end: number
  viewer: string
  viewerName: string
  messages: ClipMessage[]
  unread: number
  lastAt: string
}

/** The head coach's replies: one conversation per clip per person, newest first. */
export async function listReplyThreads(): Promise<ReplyThread[]> {
  const svc = createServiceClient()
  const rows = await allRows((a, b) =>
    svc.from('clip_messages').select('*').order('created_at', { ascending: true }).order('id').range(a, b)
  )
  if (!rows.length) return []
  const clipIds = [...new Set(rows.map((r) => Number(r.clip_id)))]
  const { data: clips } = await svc.from('team_clips').select('id, video_id, name, prompt, start_time, end_time').in('id', clipIds)
  const clipById = new Map(((clips ?? []) as Record<string, unknown>[]).map((c) => [Number(c.id), c]))
  const videoIds = [...new Set(((clips ?? []) as Record<string, unknown>[]).map((c) => Number(c.video_id)))]
  const { data: videos } = videoIds.length ? await svc.from('team_videos').select('id, uid').in('id', videoIds) : { data: [] }
  const uidBy = new Map(((videos ?? []) as Record<string, unknown>[]).map((v) => [Number(v.id), String(v.uid)]))
  const cf = getCfConfig()

  const threads = new Map<string, ReplyThread>()
  for (const r of rows) {
    const clipId = Number(r.clip_id)
    const c = clipById.get(clipId)
    if (!c) continue
    const viewer = String(r.viewer)
    const key = `${clipId}|${viewer}`
    let t = threads.get(key)
    if (!t) {
      const uid = uidBy.get(Number(c.video_id))
      t = {
        clipId,
        clipName: String(c.name ?? 'Clip'),
        prompt: (c.prompt as string) || null,
        film: uid && cf ? { url: filmHlsUrl(cf.customerCode, uid), thumb: filmThumbUrl(cf.customerCode, uid) } : null,
        start: Number(c.start_time) || 0,
        end: Number(c.end_time) || 0,
        viewer,
        viewerName: '',
        messages: [],
        unread: 0,
        lastAt: '',
      }
      threads.set(key, t)
    }
    const m = readMessage(r)
    t.messages.push(m)
    if (!m.fromCoach) {
      t.viewerName = String(r.viewer_name ?? t.viewerName)
      if (!m.readAt) t.unread++
    }
    t.lastAt = m.createdAt
  }
  return [...threads.values()]
    .map((t) => ({ ...t, viewerName: t.viewerName || nameFromKey(t.viewer) }))
    .sort((a, b) => Number(b.unread > 0) - Number(a.unread > 0) || b.lastAt.localeCompare(a.lastAt))
}

function nameFromKey(key: string): string {
  return key.startsWith('coach:') ? key.slice(6) : 'Someone'
}

/** "Coach Nolan" — who replies go to, as the families know him. */
export async function headCoachName(): Promise<string> {
  try {
    const owner = (await listStaff()).find((s) => s.isOwner)
    const name = owner?.name?.trim()
    if (!name) return 'Coach'
    return /^coach\b/i.test(name) ? name : `Coach ${name}`
  } catch {
    return 'Coach'
  }
}
