import { cookies } from 'next/headers'
import { createServiceClient } from './supabase-server'
import type { Player } from './types'

// One invite link per player.
//
// The link carries a long random token. Following it sets a cookie, so a player
// lands on their own page and stays there — no password for them to forget and
// no account for a coach to administer. A token is a key to one player's
// evaluation and drill set and nothing else; revoking it is a row update rather
// than a new password for the whole team.

export { PLAYER_COOKIE } from './playerAccess.edge'
import { PLAYER_COOKIE } from './playerAccess.edge'

export interface PlayerAccess {
  playerId: string
  token: string
  createdAt: string
  lastSeenAt: string | null
  revokedAt: string | null
}

function newToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24))
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/** True once the invite tables exist. */
export async function playerAccessReady(): Promise<boolean> {
  const svc = createServiceClient()
  const { error } = await svc.from('player_access').select('id').limit(1)
  return !error
}

function shape(row: Record<string, unknown>): PlayerAccess {
  return {
    playerId: String(row.player_id),
    token: String(row.token),
    createdAt: String(row.created_at ?? ''),
    lastSeenAt: (row.last_seen_at as string) ?? null,
    revokedAt: (row.revoked_at as string) ?? null,
  }
}

export async function listPlayerAccess(): Promise<Record<string, PlayerAccess>> {
  const svc = createServiceClient()
  const { data, error } = await svc.from('player_access').select('*')
  if (error) return {}
  const out: Record<string, PlayerAccess> = {}
  for (const row of (data ?? []) as Record<string, unknown>[]) {
    const access = shape(row)
    out[access.playerId] = access
  }
  return out
}

/** The player's link, made on first ask and kept from then on. */
export async function ensurePlayerToken(playerId: string): Promise<string | null> {
  const svc = createServiceClient()
  const { data: existing } = await svc
    .from('player_access')
    .select('token, revoked_at')
    .eq('player_id', playerId)
    .maybeSingle()
  if (existing && !(existing as { revoked_at: string | null }).revoked_at) {
    return String((existing as { token: string }).token)
  }

  const token = newToken()
  if (existing) {
    await svc
      .from('player_access')
      .update({ token, revoked_at: null, created_at: new Date().toISOString() })
      .eq('player_id', playerId)
  } else {
    const { error } = await svc.from('player_access').insert({ player_id: playerId, token })
    if (error) return null
  }
  return token
}

export async function revokePlayerToken(playerId: string): Promise<void> {
  const svc = createServiceClient()
  await svc
    .from('player_access')
    .update({ revoked_at: new Date().toISOString() })
    .eq('player_id', playerId)
}

/** Who is looking, from the cookie. Null for a shared-password visitor. */
export async function currentPlayer(): Promise<Player | null> {
  const jar = await cookies()
  const token = jar.get(PLAYER_COOKIE)?.value
  if (!token) return null
  return playerForToken(token)
}

export async function playerForToken(token: string): Promise<Player | null> {
  if (!token) return null
  const svc = createServiceClient()
  const { data } = await svc
    .from('player_access')
    .select('player_id, revoked_at, players(*)')
    .eq('token', token)
    .maybeSingle()
  if (!data) return null
  const row = data as unknown as { revoked_at: string | null; players: Player | null }
  if (row.revoked_at) return null
  return row.players ?? null
}

/** Note that a link was used, so a coach can see who has actually opened theirs. */
export async function touchPlayerToken(token: string): Promise<void> {
  const svc = createServiceClient()
  await svc
    .from('player_access')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('token', token)
}
