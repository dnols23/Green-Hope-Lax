import { createServiceClient } from './supabase-server'
import type { Viewer } from './sections'
import { WALL_QUOTES } from './warRoom'
import { isCoverKey, type WallLibrary, type WallPlaylist, type WallQuote } from './wallModel'

/**
 * On the Wall, read from the database.
 *
 * Everything is read with the service role and filtered here: a coach gets every
 * quote, every shared playlist and their own private ones, and their own hearts.
 * Until 0040_wall.sql has been run the wall still plays — the lines that used to
 * live in the code — it just can't save anything.
 */

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v : null
}

function readQuote(r: Record<string, unknown>): WallQuote {
  return {
    id: String(r.id),
    line: String(r.line ?? ''),
    who: str(r.who),
    addedBy: str(r.added_by),
    addedByName: str(r.added_by_name),
    createdAt: String(r.created_at ?? ''),
  }
}

/** The built-ins, for a site that hasn't run the SQL yet. */
function builtIns(): WallQuote[] {
  return WALL_QUOTES.map((q, i) => ({
    id: `builtin-${i + 1}`,
    line: q.line,
    who: q.who ?? null,
    addedBy: null,
    addedByName: null,
    createdAt: '',
  }))
}

export function mayEditPlaylist(viewer: Viewer | null, ownerEmail: string): boolean {
  if (!viewer) return false
  return viewer.isOwner || viewer.email.toLowerCase() === ownerEmail.toLowerCase()
}

/** Whoever added a quote can fix or remove it, and so can the head of the program. */
export function mayEditQuote(viewer: Viewer | null, addedBy: string | null): boolean {
  if (!viewer) return false
  if (viewer.isOwner) return true
  return !!addedBy && viewer.email.toLowerCase() === addedBy.toLowerCase()
}

export async function loadWall(viewer: Viewer | null): Promise<WallLibrary> {
  const me = viewer?.email.toLowerCase() ?? ''
  const empty: WallLibrary = {
    ready: false,
    quotes: builtIns(),
    playlists: [],
    liked: [],
    me,
    isOwner: viewer?.isOwner ?? false,
  }
  if (!viewer) return empty

  const svc = createServiceClient()
  const [quotesRes, listsRes, itemsRes, likesRes] = await Promise.all([
    svc.from('wall_quotes').select('*').order('created_at', { ascending: true }).order('seed_key', { ascending: true }),
    svc.from('wall_playlists').select('*').order('created_at', { ascending: true }),
    svc.from('wall_playlist_items').select('playlist_id, quote_id, position').order('position', { ascending: true }),
    svc.from('wall_likes').select('quote_id, created_at').eq('coach_email', me).order('created_at', { ascending: true }),
  ])
  if (quotesRes.error) return empty

  const quotes = ((quotesRes.data ?? []) as Record<string, unknown>[]).map(readQuote)
  const items = (itemsRes.data ?? []) as { playlist_id: string; quote_id: string }[]

  const playlists: WallPlaylist[] = ((listsRes.data ?? []) as Record<string, unknown>[])
    .map((r) => {
      const id = String(r.id)
      const ownerEmail = String(r.owner_email ?? '').toLowerCase()
      return {
        id,
        name: String(r.name ?? 'Playlist'),
        description: str(r.description),
        ownerEmail,
        ownerName: str(r.owner_name),
        shared: r.shared !== false,
        cover: isCoverKey(r.cover) ? r.cover : 'green',
        emoji: str(r.emoji),
        quoteIds: items.filter((i) => String(i.playlist_id) === id).map((i) => String(i.quote_id)),
        editable: mayEditPlaylist(viewer, ownerEmail),
      }
    })
    // Private playlists are their maker's alone.
    .filter((p) => p.shared || p.ownerEmail === me)
    // Mine first, then the staff's.
    .sort((a, b) => Number(b.ownerEmail === me) - Number(a.ownerEmail === me))

  return {
    ready: true,
    quotes,
    playlists,
    liked: ((likesRes.data ?? []) as { quote_id: string }[]).map((l) => String(l.quote_id)),
    me,
    isOwner: viewer.isOwner,
  }
}

// ── Writes ───────────────────────────────────────────────────────────────────

export async function getPlaylistOwner(id: string): Promise<string | null> {
  const { data } = await createServiceClient().from('wall_playlists').select('owner_email').eq('id', id).maybeSingle()
  return data ? String((data as { owner_email?: string }).owner_email ?? '') : null
}

export async function getQuoteAdder(id: string): Promise<{ exists: boolean; addedBy: string | null }> {
  const { data } = await createServiceClient().from('wall_quotes').select('added_by').eq('id', id).maybeSingle()
  return { exists: !!data, addedBy: data ? str((data as { added_by?: unknown }).added_by) : null }
}

/** Where a new quote goes on a playlist: after everything already there. */
export async function nextPosition(playlistId: string): Promise<number> {
  const { data } = await createServiceClient()
    .from('wall_playlist_items')
    .select('position')
    .eq('playlist_id', playlistId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()
  return (Number((data as { position?: number } | null)?.position) || 0) + 1
}
