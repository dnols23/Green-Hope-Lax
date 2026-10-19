'use server'

import { revalidatePath } from 'next/cache'
import { createServiceClient } from './supabase-server'
import { getViewer } from './permissions'
import { clipReaches, filmViewerFor, listRecipients, shareInfo, type ClipMessage, type ClipShareInfo, type FilmHub } from './clipShareData'
import { isShareGroup, isSharePerson, type Recipient, type Share } from './clipShare'
import { emailClipSent } from './clipEmail'

/**
 * Sending clips, and everything a viewer does with one.
 *
 * Only the head coach sends clips and answers replies — they come back to
 * him. Whoever a clip reaches (a coach, a player signed in as themselves, a
 * parent) can mark it watched, keep their own notes on it and write back;
 * every one of those checks the clip really was sent to them.
 */

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string }

const HUBS: FilmHub[] = ['admin', 'team', 'parents']
const hubOf = (v: unknown): FilmHub => (HUBS.includes(v as FilmHub) ? (v as FilmHub) : 'team')
const clipIdOf = (v: unknown) => (Number.isInteger(Number(v)) && Number(v) > 0 ? Number(v) : null)

async function headCoach() {
  const v = await getViewer()
  return v?.isOwner ? v : null
}

function revalidateFeeds() {
  revalidatePath('/admin/film/watch')
  revalidatePath('/admin/film/replies')
  revalidatePath('/team/film')
  revalidatePath('/parents/film')
  revalidatePath('/team', 'layout')
  revalidatePath('/parents', 'layout')
  revalidatePath('/admin', 'layout')
}

// ── The head coach ──────────────────────────────────────────────────────────

/** Everything the send popup needs: the people, and who each clip already went to. */
export async function loadSharing(): Promise<Result<{ recipients: Recipient[]; info: Record<number, ClipShareInfo> }>> {
  const v = await headCoach()
  if (!v) return { ok: false, error: 'Only the head coach sends clips.' }
  const [recipients, info] = await Promise.all([listRecipients(v.email), shareInfo()])
  return { ok: true, recipients, info }
}

/**
 * Send a clip, and keep its notes with it. `shares` is the whole list of who
 * it goes to — anyone left off it no longer has it. Their notes and replies
 * stay, in case it is sent to them again.
 */
export async function sendClip(input: {
  clipId: number
  name: string
  notes: string
  prompt: string
  shares: Share[]
  /** Email everyone it newly reaches. On unless he turns it off. */
  notify?: boolean
}): Promise<Result<{ shares: Share[]; emailed: number }>> {
  const v = await headCoach()
  if (!v) return { ok: false, error: 'Only the head coach sends clips.' }
  const clipId = clipIdOf(input.clipId)
  if (!clipId) return { ok: false, error: 'That clip is gone.' }
  const name = String(input.name ?? '').trim().slice(0, 60)
  if (!name) return { ok: false, error: 'The clip needs a name.' }

  // Only real targets, once each.
  const seen = new Set<string>()
  const shares: Share[] = []
  for (const s of Array.isArray(input.shares) ? input.shares : []) {
    const target = s?.target
    const targetId = isShareGroup(target) ? '' : String(s?.targetId ?? '').trim()
    if (!isShareGroup(target) && !(isSharePerson(target) && targetId)) continue
    const id = target === 'coach' ? targetId.toLowerCase() : targetId
    const key = `${target}|${id}`
    if (seen.has(key) || shares.length >= 300) continue
    seen.add(key)
    shares.push({ target, targetId: id })
  }

  const svc = createServiceClient()
  const { error: clipError } = await svc
    .from('team_clips')
    .update({
      name,
      notes: String(input.notes ?? '').trim().slice(0, 4000) || null,
      prompt: String(input.prompt ?? '').trim().slice(0, 500) || null,
    })
    .eq('id', clipId)
  if (clipError) return { ok: false, error: 'Could not save the clip.' }

  const { data: before } = await svc.from('clip_shares').select('id, target, target_id').eq('clip_id', clipId)
  const had = (before ?? []) as { id: string; target: string; target_id: string }[]
  const drop = had.filter((r) => !seen.has(`${r.target}|${r.target_id}`)).map((r) => r.id)
  const add = shares.filter((s) => !had.some((r) => r.target === s.target && r.target_id === s.targetId))
  if (drop.length) {
    const { error } = await svc.from('clip_shares').delete().in('id', drop)
    if (error) return { ok: false, error: 'Could not update who it goes to.' }
  }
  if (add.length) {
    const { error } = await svc
      .from('clip_shares')
      .upsert(
        add.map((s) => ({ clip_id: clipId, target: s.target, target_id: s.targetId, shared_by: v.email })),
        { onConflict: 'clip_id,target,target_id', ignoreDuplicates: true }
      )
    if (error) return { ok: false, error: 'Could not send it.' }
  }
  revalidateFeeds()
  const emailed =
    input.notify === false
      ? 0
      : await emailClipSent({
          added: add,
          kept: shares.filter((s) => had.some((r) => r.target === s.target && r.target_id === s.targetId)),
          sender: { email: v.email, name: v.name || 'Coach' },
          clipName: name,
          notes: String(input.notes ?? '').trim() || null,
          prompt: String(input.prompt ?? '').trim() || null,
        })
  return { ok: true, shares, emailed }
}

/** The head coach answers someone. Their side of the conversation counts as read. */
export async function answerReply(input: { clipId: number; viewer: string; body: string }): Promise<Result<{ message: ClipMessage }>> {
  const v = await headCoach()
  if (!v) return { ok: false, error: 'Only the head coach answers here.' }
  const clipId = clipIdOf(input.clipId)
  const body = String(input.body ?? '').trim().slice(0, 4000)
  const viewer = String(input.viewer ?? '')
  if (!clipId || !body || !/^(coach|player|parent):/.test(viewer)) return { ok: false, error: 'Nothing to send.' }
  const svc = createServiceClient()
  const now = new Date().toISOString()
  await svc
    .from('clip_messages')
    .update({ read_at: now })
    .eq('clip_id', clipId)
    .eq('viewer', viewer)
    .eq('from_coach', false)
    .is('read_at', null)
  const { data, error } = await svc
    .from('clip_messages')
    .insert({ clip_id: clipId, viewer, from_coach: true, author: v.name || 'Coach', body })
    .select('*')
    .single()
  if (error || !data) return { ok: false, error: 'Could not send it.' }
  revalidateFeeds()
  const r = data as Record<string, unknown>
  return {
    ok: true,
    message: { id: String(r.id), fromCoach: true, author: String(r.author ?? ''), body, createdAt: String(r.created_at), readAt: null },
  }
}

/** Opening a conversation reads it. */
export async function readReplies(input: { clipId: number; viewer: string }): Promise<Result> {
  if (!(await headCoach())) return { ok: false, error: 'Only the head coach reads these.' }
  const clipId = clipIdOf(input.clipId)
  if (!clipId) return { ok: false, error: 'That clip is gone.' }
  await createServiceClient()
    .from('clip_messages')
    .update({ read_at: new Date().toISOString() })
    .eq('clip_id', clipId)
    .eq('viewer', String(input.viewer ?? ''))
    .eq('from_coach', false)
    .is('read_at', null)
  revalidateFeeds()
  return { ok: true }
}

// ── Whoever it was sent to ──────────────────────────────────────────────────

async function viewerFor(hub: unknown, clipId: unknown) {
  const id = clipIdOf(clipId)
  if (!id) return null
  const viewer = await filmViewerFor(hubOf(hub))
  if (!viewer || !(await clipReaches(viewer, id))) return null
  return { viewer, clipId: id }
}

/** Pressing play counts as watching — and reads any answer from the coach. */
export async function markWatched(hub: FilmHub, clipId: number): Promise<Result> {
  const who = await viewerFor(hub, clipId)
  if (!who) return { ok: false, error: 'This clip wasn’t sent to you.' }
  const svc = createServiceClient()
  await svc
    .from('clip_views')
    .upsert(
      { clip_id: who.clipId, viewer: who.viewer.key, viewer_name: who.viewer.name },
      { onConflict: 'clip_id,viewer', ignoreDuplicates: true }
    )
  await svc
    .from('clip_messages')
    .update({ read_at: new Date().toISOString() })
    .eq('clip_id', who.clipId)
    .eq('viewer', who.viewer.key)
    .eq('from_coach', true)
    .is('read_at', null)
  revalidatePath(hub === 'admin' ? '/admin' : hub === 'team' ? '/team' : '/parents', 'layout')
  return { ok: true }
}

/** A viewer's own notes on a clip. Nobody else sees them. */
export async function saveMyNotes(hub: FilmHub, clipId: number, body: string): Promise<Result> {
  const who = await viewerFor(hub, clipId)
  if (!who) return { ok: false, error: 'This clip wasn’t sent to you.' }
  const { error } = await createServiceClient()
    .from('clip_viewer_notes')
    .upsert(
      { clip_id: who.clipId, viewer: who.viewer.key, body: String(body ?? '').slice(0, 8000), updated_at: new Date().toISOString() },
      { onConflict: 'clip_id,viewer' }
    )
  return error ? { ok: false, error: 'Could not save your notes.' } : { ok: true }
}

/** Write back to the coach about a clip — a question, or an answer to his. */
export async function replyToCoach(hub: FilmHub, clipId: number, body: string): Promise<Result<{ message: ClipMessage }>> {
  const who = await viewerFor(hub, clipId)
  if (!who) return { ok: false, error: 'This clip wasn’t sent to you.' }
  const text = String(body ?? '').trim().slice(0, 4000)
  if (!text) return { ok: false, error: 'Write something first.' }
  const { data, error } = await createServiceClient()
    .from('clip_messages')
    .insert({
      clip_id: who.clipId,
      viewer: who.viewer.key,
      viewer_name: who.viewer.name,
      from_coach: false,
      author: who.viewer.name,
      body: text,
    })
    .select('*')
    .single()
  if (error || !data) return { ok: false, error: 'Could not send it. Try again.' }
  revalidatePath('/admin/film/replies')
  revalidatePath('/admin', 'layout')
  const r = data as Record<string, unknown>
  return {
    ok: true,
    message: { id: String(r.id), fromCoach: false, author: who.viewer.name, body: text, createdAt: String(r.created_at), readAt: null },
  }
}
