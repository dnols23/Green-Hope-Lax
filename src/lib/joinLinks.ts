import { createServiceClient } from './supabase-server'

/**
 * The ways in, and whether each one is open.
 *
 * Four doors: the shared team code, and a link each for players, parents and
 * coaches. Every one can be switched off from Sign-in settings, and every link
 * can be replaced — a link that has travelled further than it was meant to is a
 * thing that happens, and the answer has to be one click, not a migration.
 */

export type JoinKind = 'player' | 'parent' | 'coach'

export const JOIN_KINDS: {
  kind: JoinKind
  label: string
  blurb: string
  path: string
  /** Off by default where being wrong is expensive. */
  defaultOn: boolean
}[] = [
  {
    kind: 'player',
    label: 'Players',
    blurb: 'A player follows it, picks himself off the roster, and is signed in to his own page.',
    path: '/team/join-team',
    defaultOn: true,
  },
  {
    kind: 'parent',
    label: 'Parents',
    blurb: 'A parent follows it, gives a name and an email, and is in the Parent Hub.',
    path: '/parents/join',
    defaultOn: true,
  },
  {
    kind: 'coach',
    label: 'Coaches',
    blurb:
      'Makes an admin account with assistant-coach access. Anyone holding this link becomes a coach, so it starts switched off.',
    path: '/staff/join',
    defaultOn: false,
  },
]

const TOKEN_KEYS: Record<JoinKind, string> = {
  player: 'player_join_token',
  parent: 'parent_join_token',
  coach: 'coach_join_token',
}

export const SIGNIN_KEY = 'signin_settings'

export interface SigninSettings {
  /** The shared team password on /team/login. */
  codeOn: boolean
  links: Record<JoinKind, boolean>
}

export function defaultSettings(): SigninSettings {
  return {
    codeOn: true,
    links: Object.fromEntries(JOIN_KINDS.map((j) => [j.kind, j.defaultOn])) as Record<JoinKind, boolean>,
  }
}

export function parseSigninSettings(value: string | null | undefined): SigninSettings {
  const out = defaultSettings()
  if (!value) return out
  try {
    const raw = JSON.parse(value) as Partial<SigninSettings>
    if (typeof raw.codeOn === 'boolean') out.codeOn = raw.codeOn
    for (const j of JOIN_KINDS) {
      const on = raw.links?.[j.kind]
      if (typeof on === 'boolean') out.links[j.kind] = on
    }
  } catch {
    // An unreadable settings row is the same as one that was never written.
  }
  return out
}

export async function readSigninSettings(): Promise<SigninSettings> {
  try {
    const { data } = await createServiceClient()
      .from('app_settings')
      .select('value')
      .eq('key', SIGNIN_KEY)
      .maybeSingle()
    return parseSigninSettings(data?.value as string | undefined)
  } catch {
    return defaultSettings()
  }
}

export async function writeSigninSettings(next: SigninSettings): Promise<void> {
  await createServiceClient()
    .from('app_settings')
    .upsert({ key: SIGNIN_KEY, value: JSON.stringify(next) }, { onConflict: 'key' })
}

function newToken(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/** The link for this door. Made on first ask, kept until it is replaced. */
export async function ensureJoinLink(kind: JoinKind): Promise<string | null> {
  const svc = createServiceClient()
  const key = TOKEN_KEYS[kind]
  const { data } = await svc.from('app_settings').select('value').eq('key', key).maybeSingle()
  const existing = (data?.value as string | undefined)?.trim()
  if (existing) return existing

  const token = newToken()
  const { error } = await svc.from('app_settings').upsert({ key, value: token }, { onConflict: 'key' })
  return error ? null : token
}

/** A new link. The old one stops working; anyone already through stays in. */
export async function rollJoinLink(kind: JoinKind): Promise<string | null> {
  const token = newToken()
  const { error } = await createServiceClient()
    .from('app_settings')
    .upsert({ key: TOKEN_KEYS[kind], value: token }, { onConflict: 'key' })
  return error ? null : token
}

/** Is this the current link, and is this door open? Both have to be true. */
export async function joinLinkValid(kind: JoinKind, token: string): Promise<boolean> {
  if (!token) return false
  const [settings, current] = await Promise.all([readSigninSettings(), ensureJoinLink(kind)])
  if (!settings.links[kind]) return false
  return !!current && token === current
}
