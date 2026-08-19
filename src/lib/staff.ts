import { createServiceClient } from './supabase-server'
import type { StaffRole } from './sections'

// Who the coaching staff are, and what each of them may open.
//
// Kept in app_settings — the key/value table the site already uses for the team
// password — rather than a table of its own, so turning coach sign-ins on needs
// no database migration. app_settings has RLS on with no anon or authenticated
// policies, so only the server can read or write these rows.
//
// One row per person, keyed "staff:<email>", holding JSON.

const PREFIX = 'staff:'

export interface StaffRecord {
  email: string
  name: string
  role: StaffRole
  isOwner: boolean
  permissions: string[]
}

const keyFor = (email: string) => `${PREFIX}${email.toLowerCase().trim()}`

function parse(key: string, value: string): StaffRecord | null {
  try {
    const raw = JSON.parse(value) as Partial<StaffRecord>
    return {
      email: key.slice(PREFIX.length),
      name: typeof raw.name === 'string' ? raw.name : key.slice(PREFIX.length),
      role: raw.role === 'head' ? 'head' : 'assistant',
      isOwner: raw.isOwner === true,
      permissions: Array.isArray(raw.permissions) ? raw.permissions.map(String) : [],
    }
  } catch {
    return null
  }
}

export async function readStaff(email: string): Promise<StaffRecord | null> {
  const svc = createServiceClient()
  const key = keyFor(email)
  const { data } = await svc.from('app_settings').select('value').eq('key', key).maybeSingle()
  if (!data?.value) return null
  return parse(key, data.value as string)
}

export async function listStaff(): Promise<StaffRecord[]> {
  const svc = createServiceClient()
  const { data } = await svc.from('app_settings').select('key, value').like('key', `${PREFIX}%`)
  const rows = (data ?? []) as { key: string; value: string }[]
  return rows
    .map((r) => parse(r.key, r.value))
    .filter((r): r is StaffRecord => r !== null)
    .sort((a, b) => Number(b.isOwner) - Number(a.isOwner) || a.name.localeCompare(b.name))
}

export async function writeStaff(rec: StaffRecord): Promise<void> {
  const svc = createServiceClient()
  const { email, ...rest } = rec
  await svc
    .from('app_settings')
    .upsert({ key: keyFor(email), value: JSON.stringify(rest) }, { onConflict: 'key' })
}

export async function deleteStaff(email: string): Promise<void> {
  const svc = createServiceClient()
  await svc.from('app_settings').delete().eq('key', keyFor(email))
}

/** Is anyone marked as owner yet? Drives the first-run stand-in. */
export async function hasOwner(): Promise<boolean> {
  const all = await listStaff()
  return all.some((s) => s.isOwner)
}
