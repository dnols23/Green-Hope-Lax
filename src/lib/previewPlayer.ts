import { createServiceClient } from './supabase-server'
import { currentPlayer } from './playerAccess'
import { getViewer } from './permissions'
import { canSee } from './sections'
import type { Player } from './types'

// Seeing the Team Hub the way a player sees it.
//
// A coach writing the board has no way to check their own work. They are signed
// in as a coach, so /team renders them the shared-password view: the player's
// own card is missing, and "Open my work" is not there at all. The board looked
// finished and was not.
//
// A preview is a query parameter and nothing else. No cookie is set, no invite
// token is read or minted, and last_seen_at is never touched — so previewing a
// player does not make it look like that player finally opened their link. That
// column is how a coach knows who is still missing, and a preview that wrote to
// it would quietly destroy the only signal they have.
//
// It is also not a way in. The parameter is honoured only for someone who is
// already signed in as a coach with the Team Hub section, which is the same
// grant that let them write the posts they are checking. For anyone else it is
// ignored, so a player who finds ?preview= in a shared URL sees their own page.

export const PREVIEW_PARAM = 'preview'

export interface Viewing {
  player: Player | null
  /** True only when a coach is standing in for that player. */
  previewing: boolean
}

/**
 * Who the Team Hub should render for: a real player from their invite cookie,
 * a player a coach is previewing, or nobody (the shared-password view).
 */
export async function viewingAs(previewId?: string): Promise<Viewing> {
  if (previewId) {
    const viewer = await getViewer()
    if (canSee(viewer, 'team')) {
      const svc = createServiceClient()
      const { data } = await svc
        .from('players')
        .select('*')
        .eq('id', previewId)
        .maybeSingle()
      if (data) return { player: data as Player, previewing: true }
    }
  }
  return { player: await currentPlayer(), previewing: false }
}

/** Carries the preview through a link, so previewing does not dead-end. */
export function withPreview(href: string, player: Player | null, previewing: boolean): string {
  if (!previewing || !player) return href
  const join = href.includes('?') ? '&' : '?'
  return `${href}${join}${PREVIEW_PARAM}=${encodeURIComponent(player.id)}`
}
