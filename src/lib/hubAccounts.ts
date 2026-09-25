import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { createServiceClient } from './supabase-server'
import { hashTeamPassword } from './teamAuth'
import { readSigninSettings } from './joinLinks'
import { DEFAULT_ACK_URL, type Answers } from './hubQuestions'

// Team Hub and Parent Hub accounts: a code gets you to the sign-up, an email
// and password get you back in. Server-only.

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>

export type HubKind = 'player' | 'parent'

export async function hashPassword(pw: string): Promise<string> {
  const salt = randomBytes(16)
  const key = await scrypt(pw, salt, 32)
  return `scrypt$${salt.toString('hex')}$${key.toString('hex')}`
}

export async function checkPassword(pw: string, stored: string): Promise<boolean> {
  const [scheme, saltHex, keyHex] = stored.split('$')
  if (scheme !== 'scrypt' || !saltHex || !keyHex) return false
  const want = Buffer.from(keyHex, 'hex')
  const got = await scrypt(pw, Buffer.from(saltHex, 'hex'), want.length)
  return got.length === want.length && timingSafeEqual(got, want)
}

// ── Settings: the parent code and where the code of conduct lives ─────────────

export const HUB_REG_KEY = 'hub_registration'

export interface HubRegistration {
  /** The Parent Hub code can be switched off like the team code. */
  parentCodeOn: boolean
  /** The school athletics code of conduct, if it has its own page or PDF. */
  conductUrl: string
  /** The Athlete Acknowledgement form every player must submit. */
  ackUrl: string
}

export function parseHubRegistration(value: string | null | undefined): HubRegistration {
  const out: HubRegistration = { parentCodeOn: true, conductUrl: '', ackUrl: DEFAULT_ACK_URL }
  if (!value) return out
  try {
    const raw = JSON.parse(value) as Partial<HubRegistration>
    if (typeof raw.parentCodeOn === 'boolean') out.parentCodeOn = raw.parentCodeOn
    if (typeof raw.conductUrl === 'string') out.conductUrl = raw.conductUrl
    if (typeof raw.ackUrl === 'string' && raw.ackUrl) out.ackUrl = raw.ackUrl
  } catch {
    // Unreadable reads as never written.
  }
  return out
}

export async function readHubRegistration(): Promise<HubRegistration> {
  try {
    const { data } = await createServiceClient().from('app_settings').select('value').eq('key', HUB_REG_KEY).maybeSingle()
    return parseHubRegistration(data?.value as string | undefined)
  } catch {
    return parseHubRegistration(null)
  }
}

export async function writeHubRegistration(next: HubRegistration): Promise<void> {
  await createServiceClient()
    .from('app_settings')
    .upsert({ key: HUB_REG_KEY, value: JSON.stringify(next) }, { onConflict: 'key' })
}

/**
 * Is this the code for this hub, and is that door open? The Team Hub uses the
 * team password that already exists; the Parent Hub has its own.
 */
export async function codeValid(kind: HubKind, code: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const typed = code.trim()
  if (!typed) return { ok: false, error: 'Enter the code.' }
  const svc = createServiceClient()
  if (kind === 'player') {
    const { codeOn } = await readSigninSettings()
    if (!codeOn) return { ok: false, error: 'Sign-ups are closed. Ask a coach.' }
    const { data } = await svc.from('app_settings').select('value').eq('key', 'team_password_hash').maybeSingle()
    return data?.value && (await hashTeamPassword(typed)) === data.value
      ? { ok: true }
      : { ok: false, error: 'That code isn’t right. Ask a coach.' }
  }
  const reg = await readHubRegistration()
  if (!reg.parentCodeOn) return { ok: false, error: 'Sign-ups are closed. Ask a coach.' }
  const { data } = await svc.from('app_settings').select('value').eq('key', 'parent_code_hash').maybeSingle()
  if (!data?.value) return { ok: false, error: 'The parent code hasn’t been set yet. Ask a coach.' }
  return (await hashTeamPassword(`parent:${typed}`)) === data.value
    ? { ok: true }
    : { ok: false, error: 'That code isn’t right. Ask a coach.' }
}

// ── Accounts ─────────────────────────────────────────────────────────────────

export interface HubAccount {
  id: string
  kind: HubKind
  email: string
  name: string
  phone: string | null
  playerId: string | null
  playerIds: string[]
  parentId: string | null
  contacts: Record<string, string>
  answers: Answers
  conductSignedName: string | null
  conductAgreedAt: string | null
  createdAt: string
  lastSeenAt: string | null
}

function shape(r: Record<string, unknown>): HubAccount {
  const obj = (v: unknown) => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, never>) : {})
  return {
    id: String(r.id),
    kind: r.kind === 'parent' ? 'parent' : 'player',
    email: String(r.email ?? ''),
    name: String(r.name ?? ''),
    phone: (r.phone as string) ?? null,
    playerId: (r.player_id as string) ?? null,
    playerIds: Array.isArray(r.player_ids) ? (r.player_ids as unknown[]).map(String) : [],
    parentId: (r.parent_id as string) ?? null,
    contacts: obj(r.contacts),
    answers: obj(r.answers),
    conductSignedName: (r.conduct_signed_name as string) ?? null,
    conductAgreedAt: (r.conduct_agreed_at as string) ?? null,
    createdAt: String(r.created_at ?? ''),
    lastSeenAt: (r.last_seen_at as string) ?? null,
  }
}

/** Every account, newest first — or null before the table exists. */
export async function listHubAccounts(): Promise<HubAccount[] | null> {
  const { data, error } = await createServiceClient()
    .from('hub_accounts')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) return null
  return ((data ?? []) as Record<string, unknown>[]).map(shape)
}

export async function findAccount(kind: HubKind, email: string): Promise<(HubAccount & { passwordHash: string }) | null> {
  const { data } = await createServiceClient()
    .from('hub_accounts')
    .select('*')
    .eq('kind', kind)
    .eq('email', email.trim().toLowerCase())
    .maybeSingle()
  if (!data) return null
  const row = data as Record<string, unknown>
  return { ...shape(row), passwordHash: String(row.password_hash ?? '') }
}

export async function playerHasAccount(playerId: string): Promise<boolean> {
  const { data } = await createServiceClient()
    .from('hub_accounts')
    .select('id')
    .eq('kind', 'player')
    .eq('player_id', playerId)
    .maybeSingle()
  return !!data
}

/** The players someone can pick from: this season's active players, by name. */
export async function rosterForSignup(): Promise<{ id: string; name: string; number: string | null; team: string; taken: boolean }[]> {
  const svc = createServiceClient()
  const [{ data: players }, { data: taken }] = await Promise.all([
    svc.from('players').select('id, name, number, team, is_active').eq('is_active', true).order('name'),
    svc.from('hub_accounts').select('player_id').eq('kind', 'player'),
  ])
  const takenIds = new Set(((taken ?? []) as { player_id: string | null }[]).map((t) => t.player_id))
  return ((players ?? []) as { id: string; name: string; number: string | null; team: string }[]).map((p) => ({
    id: p.id,
    name: p.name,
    number: p.number,
    team: p.team === 'boys_jv' ? 'JV' : p.team === 'boys_varsity' ? 'Varsity' : '',
    taken: takenIds.has(p.id),
  }))
}
