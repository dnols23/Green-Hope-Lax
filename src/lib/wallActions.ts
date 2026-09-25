'use server'

import { getViewer, isSandboxed } from './permissions'
import { createServiceClient } from './supabase-server'
import { getPlaylistOwner, getQuoteAdder, mayEditPlaylist, mayEditQuote, nextPosition } from './wallData'
import { cleanLine, isCoverKey } from './wallModel'

/**
 * Writing the wall.
 *
 * Called straight from the player with plain values. Every one re-reads who is
 * asking and whose playlist or quote it is from the database — the browser only
 * ever says what it wants, never whether it may.
 */

export type WallResult = { ok: true; id?: string; liked?: boolean } | { ok: false; error: string }

const NOT_READY = 'Couldn’t save — has supabase/migrations/0040_wall.sql been run?'
const MAX_PLAYLISTS = 100 // per coach

// ── Quotes ───────────────────────────────────────────────────────────────────

export async function addWallQuote(input: {
  line: string
  who?: string | null
  /** Also put it on this playlist. */
  playlistId?: string | null
}): Promise<WallResult> {
  const viewer = await getViewer()
  if (!viewer) return { ok: false, error: 'Sign in again.' }
  // Every quote plays in every War Room; this coach's ideas go to the head coach first.
  if (isSandboxed(viewer)) return { ok: false, error: 'Send this one to the head coach to put on the wall.' }
  const line = cleanLine(input.line)
  if (!line) return { ok: false, error: 'Type the quote first.' }
  const who = cleanLine(input.who, 120) || null

  const svc = createServiceClient()
  const { data, error } = await svc
    .from('wall_quotes')
    .insert({ line, who, added_by: viewer.email.toLowerCase(), added_by_name: viewer.name || null })
    .select('id')
    .single()
  if (error || !data) return { ok: false, error: NOT_READY }
  const id = String((data as { id: string }).id)

  if (input.playlistId) {
    const owner = await getPlaylistOwner(String(input.playlistId))
    if (owner !== null && mayEditPlaylist(viewer, owner)) {
      await svc.from('wall_playlist_items').insert({
        playlist_id: String(input.playlistId),
        quote_id: id,
        position: await nextPosition(String(input.playlistId)),
      })
    }
  }
  return { ok: true, id }
}

export async function editWallQuote(id: string, input: { line: string; who?: string | null }): Promise<WallResult> {
  const viewer = await getViewer()
  const found = await getQuoteAdder(id)
  if (!viewer || !found.exists) return { ok: false, error: 'That quote is gone.' }
  if (!mayEditQuote(viewer, found.addedBy)) return { ok: false, error: 'Only whoever added it can change it.' }
  const line = cleanLine(input.line)
  if (!line) return { ok: false, error: 'Type the quote first.' }
  const { error } = await createServiceClient()
    .from('wall_quotes')
    .update({ line, who: cleanLine(input.who, 120) || null })
    .eq('id', id)
  return error ? { ok: false, error: 'Couldn’t save it.' } : { ok: true, id }
}

/** Off every playlist and every heart with it. */
export async function deleteWallQuote(id: string): Promise<WallResult> {
  const viewer = await getViewer()
  const found = await getQuoteAdder(id)
  if (!viewer || !found.exists) return { ok: false, error: 'That quote is gone.' }
  if (!mayEditQuote(viewer, found.addedBy)) return { ok: false, error: 'Only whoever added it can delete it.' }
  await createServiceClient().from('wall_quotes').delete().eq('id', id)
  return { ok: true }
}

// ── Hearts ───────────────────────────────────────────────────────────────────

export async function toggleWallLike(quoteId: string, like: boolean): Promise<WallResult> {
  const viewer = await getViewer()
  if (!viewer) return { ok: false, error: 'Sign in again.' }
  const svc = createServiceClient()
  const me = viewer.email.toLowerCase()
  if (like) {
    const { error } = await svc
      .from('wall_likes')
      .upsert({ coach_email: me, quote_id: quoteId }, { onConflict: 'coach_email,quote_id', ignoreDuplicates: true })
    if (error) return { ok: false, error: NOT_READY }
  } else {
    await svc.from('wall_likes').delete().eq('coach_email', me).eq('quote_id', quoteId)
  }
  return { ok: true, liked: like }
}

// ── Playlists ────────────────────────────────────────────────────────────────

export interface PlaylistInput {
  name: string
  description?: string | null
  shared?: boolean
  cover?: string
  emoji?: string | null
}

function cleanPlaylist(input: PlaylistInput) {
  return {
    name: cleanLine(input.name, 80),
    description: cleanLine(input.description, 300) || null,
    shared: input.shared !== false,
    cover: isCoverKey(input.cover) ? input.cover : 'green',
    emoji: cleanLine(input.emoji, 8) || null,
  }
}

export async function createWallPlaylist(input: PlaylistInput & { quoteIds?: string[] }): Promise<WallResult> {
  const viewer = await getViewer()
  if (!viewer) return { ok: false, error: 'Sign in again.' }
  const row = cleanPlaylist(input)
  // A sandboxed coach's playlists are his own.
  if (isSandboxed(viewer)) row.shared = false
  if (!row.name) return { ok: false, error: 'Give the playlist a name.' }

  const svc = createServiceClient()
  const me = viewer.email.toLowerCase()
  const { count } = await svc.from('wall_playlists').select('id', { count: 'exact', head: true }).eq('owner_email', me)
  if ((count ?? 0) >= MAX_PLAYLISTS) return { ok: false, error: 'That’s a lot of playlists — delete an old one first.' }

  const { data, error } = await svc
    .from('wall_playlists')
    .insert({ ...row, owner_email: me, owner_name: viewer.name || null })
    .select('id')
    .single()
  if (error || !data) return { ok: false, error: NOT_READY }
  const id = String((data as { id: string }).id)

  const quoteIds = [...new Set((input.quoteIds ?? []).map(String))].slice(0, 500)
  if (quoteIds.length) {
    await svc.from('wall_playlist_items').insert(
      quoteIds.map((quote_id, i) => ({ playlist_id: id, quote_id, position: i + 1 })),
    )
  }
  return { ok: true, id }
}

async function guardPlaylist(id: string): Promise<WallResult | null> {
  const viewer = await getViewer()
  const owner = await getPlaylistOwner(id)
  if (!viewer || owner === null) return { ok: false, error: 'That playlist is gone.' }
  if (!mayEditPlaylist(viewer, owner)) return { ok: false, error: 'That playlist isn’t yours to change.' }
  return null
}

export async function updateWallPlaylist(id: string, input: PlaylistInput): Promise<WallResult> {
  const refused = await guardPlaylist(id)
  if (refused) return refused
  const row = cleanPlaylist(input)
  // A sandboxed coach's playlists are his own.
  if (isSandboxed(await getViewer())) row.shared = false
  if (!row.name) return { ok: false, error: 'Give the playlist a name.' }
  const { error } = await createServiceClient()
    .from('wall_playlists')
    .update({ ...row, updated_at: new Date().toISOString() })
    .eq('id', id)
  return error ? { ok: false, error: 'Couldn’t save it.' } : { ok: true, id }
}

export async function deleteWallPlaylist(id: string): Promise<WallResult> {
  const refused = await guardPlaylist(id)
  if (refused) return refused
  await createServiceClient().from('wall_playlists').delete().eq('id', id)
  return { ok: true }
}

export async function addToWallPlaylist(id: string, quoteId: string): Promise<WallResult> {
  const refused = await guardPlaylist(id)
  if (refused) return refused
  const { error } = await createServiceClient()
    .from('wall_playlist_items')
    .upsert(
      { playlist_id: id, quote_id: quoteId, position: await nextPosition(id) },
      { onConflict: 'playlist_id,quote_id', ignoreDuplicates: true },
    )
  return error ? { ok: false, error: 'Couldn’t add it.' } : { ok: true, id }
}

export async function removeFromWallPlaylist(id: string, quoteId: string): Promise<WallResult> {
  const refused = await guardPlaylist(id)
  if (refused) return refused
  await createServiceClient().from('wall_playlist_items').delete().eq('playlist_id', id).eq('quote_id', quoteId)
  return { ok: true, id }
}

/** A drag in the track list: the playlist's quotes, in their new order. */
export async function reorderWallPlaylist(id: string, quoteIds: string[]): Promise<WallResult> {
  const refused = await guardPlaylist(id)
  if (refused) return refused
  const svc = createServiceClient()
  const ids = [...new Set(quoteIds.map(String))].slice(0, 500)
  await Promise.all(
    ids.map((quote_id, i) =>
      svc.from('wall_playlist_items').update({ position: i + 1 }).eq('playlist_id', id).eq('quote_id', quote_id),
    ),
  )
  return { ok: true, id }
}
