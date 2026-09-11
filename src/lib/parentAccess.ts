import { cookies } from 'next/headers'
import { createServiceClient } from './supabase-server'

/**
 * How a parent gets in.
 *
 * One join link, sent in a team email. A parent follows it, says who they are,
 * and gets their own cookie from then on — nothing to remember, nothing for a
 * coach to administer. The join link is a single shared secret, so when a
 * season ends the coach rolls it and last year's email stops working; the
 * parents already through keep their own way back in.
 */

export { PARENT_COOKIE } from './parentAccess.edge'
import { PARENT_COOKIE } from './parentAccess.edge'

export const PARENT_JOIN_KEY = 'parent_join_token'

export interface Parent {
  id: string
  name: string
  email: string
  phone: string | null
  player_name: string | null
  token: string
  is_team_parent: boolean
  created_at: string
  last_seen_at: string | null
}

function newToken(bytes = 24): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/** True once the parent tables exist, so a screen can say so instead of erroring. */
export async function parentHubReady(): Promise<boolean> {
  const { error } = await createServiceClient().from('parents').select('id').limit(1)
  return !error
}

/** The link a coach emails. Made on first ask, kept until it is rolled. */
export async function ensureJoinToken(): Promise<string | null> {
  const svc = createServiceClient()
  const { data } = await svc
    .from('app_settings')
    .select('value')
    .eq('key', PARENT_JOIN_KEY)
    .maybeSingle()
  const existing = (data?.value as string | undefined)?.trim()
  if (existing) return existing

  const token = newToken(16)
  const { error } = await svc
    .from('app_settings')
    .upsert({ key: PARENT_JOIN_KEY, value: token }, { onConflict: 'key' })
  return error ? null : token
}

/** A new link. Anyone already registered keeps their own access. */
export async function rollJoinToken(): Promise<string | null> {
  const token = newToken(16)
  const { error } = await createServiceClient()
    .from('app_settings')
    .upsert({ key: PARENT_JOIN_KEY, value: token }, { onConflict: 'key' })
  return error ? null : token
}

export async function joinTokenValid(token: string): Promise<boolean> {
  if (!token) return false
  const current = await ensureJoinToken()
  return !!current && token === current
}

export async function parentForToken(token: string): Promise<Parent | null> {
  if (!token) return null
  const { data } = await createServiceClient()
    .from('parents')
    .select('*')
    .eq('token', token)
    .maybeSingle()
  return (data as Parent) ?? null
}

/** Who is looking, from the cookie. */
export async function currentParent(): Promise<Parent | null> {
  const token = (await cookies()).get(PARENT_COOKIE)?.value
  return token ? parentForToken(token) : null
}

/**
 * Register, or come back.
 *
 * Email is the identity: a parent who signs up again from a second phone gets
 * their existing row and their existing token, not a duplicate that splits
 * their sign-ups in two.
 */
export async function registerParent(input: {
  name: string
  email: string
  phone?: string | null
  playerName?: string | null
}): Promise<{ parent: Parent | null; created: boolean; error?: string }> {
  const svc = createServiceClient()
  const email = input.email.trim().toLowerCase()

  const { data: existing } = await svc.from('parents').select('*').eq('email', email).maybeSingle()
  if (existing) {
    const { data } = await svc
      .from('parents')
      .update({
        name: input.name,
        phone: input.phone ?? (existing as Parent).phone,
        player_name: input.playerName ?? (existing as Parent).player_name,
        last_seen_at: new Date().toISOString(),
      })
      .eq('id', (existing as Parent).id)
      .select('*')
      .maybeSingle()
    return { parent: (data as Parent) ?? (existing as Parent), created: false }
  }

  const { data, error } = await svc
    .from('parents')
    .insert({
      name: input.name,
      email,
      phone: input.phone ?? null,
      player_name: input.playerName ?? null,
      token: newToken(),
      last_seen_at: new Date().toISOString(),
    })
    .select('*')
    .maybeSingle()

  if (error) return { parent: null, created: false, error: error.message }
  return { parent: data as Parent, created: true }
}

export async function listParents(): Promise<Parent[]> {
  const { data } = await createServiceClient()
    .from('parents')
    .select('*')
    .order('created_at', { ascending: false })
  return (data as Parent[]) ?? []
}

export async function setTeamParent(id: string, on: boolean): Promise<void> {
  await createServiceClient().from('parents').update({ is_team_parent: on }).eq('id', id)
}

export async function removeParent(id: string): Promise<void> {
  await createServiceClient().from('parents').delete().eq('id', id)
}

export async function touchParent(token: string): Promise<void> {
  await createServiceClient()
    .from('parents')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('token', token)
}
