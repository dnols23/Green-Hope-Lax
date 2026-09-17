import { createServiceClient } from './supabase-server'

/**
 * Contact details, kept apart from the roster on purpose.
 *
 * The players table is read by the public roster page; a parent's mobile number
 * and a child's emergency contact have no business on a table anyone can read.
 * This one is server-only, and every screen that shows it is coach-only.
 */

export interface PlayerContact {
  player_id: string
  player_email: string | null
  player_phone: string | null
  guardian_name: string | null
  guardian_email: string | null
  guardian_phone: string | null
  guardian2_name: string | null
  guardian2_email: string | null
  guardian2_phone: string | null
  emergency_name: string | null
  emergency_phone: string | null
  emergency_relation: string | null
  preferred: string | null
  notes: string | null
  updated_at: string | null
  updated_by: string | null
}

export const PREFERRED_OPTIONS = [
  { key: 'guardian', label: 'First guardian' },
  { key: 'guardian2', label: 'Second guardian' },
  { key: 'emergency', label: 'Emergency contact' },
  { key: 'player', label: 'The player himself' },
] as const

/** True once the contacts table exists. */
export async function contactsReady(): Promise<boolean> {
  const { error } = await createServiceClient().from('player_contacts').select('player_id').limit(1)
  return !error
}

export async function getContact(playerId: string): Promise<PlayerContact | null> {
  const { data } = await createServiceClient()
    .from('player_contacts')
    .select('*')
    .eq('player_id', playerId)
    .maybeSingle()
  return (data as PlayerContact) ?? null
}

export async function saveContact(
  playerId: string,
  fields: Partial<PlayerContact>,
  by: string | null
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await createServiceClient()
    .from('player_contacts')
    .upsert(
      { ...fields, player_id: playerId, updated_at: new Date().toISOString(), updated_by: by },
      { onConflict: 'player_id' }
    )
  return error ? { ok: false, error: error.message } : { ok: true }
}

/** Who to try first, in plain words, for the top of a player's page. */
export function firstCall(contact: PlayerContact | null): { name: string; phone: string; who: string } | null {
  if (!contact) return null
  const options: Record<string, { name: string | null; phone: string | null; who: string }> = {
    guardian: { name: contact.guardian_name, phone: contact.guardian_phone, who: 'guardian' },
    guardian2: { name: contact.guardian2_name, phone: contact.guardian2_phone, who: 'guardian' },
    emergency: {
      name: contact.emergency_name,
      phone: contact.emergency_phone,
      who: contact.emergency_relation || 'emergency contact',
    },
    player: { name: null, phone: contact.player_phone, who: 'the player' },
  }
  const order = [contact.preferred, 'emergency', 'guardian', 'guardian2', 'player'].filter(
    (k): k is string => typeof k === 'string'
  )
  for (const key of order) {
    const pick = options[key]
    if (pick?.phone) return { name: pick.name ?? '', phone: pick.phone, who: pick.who }
  }
  return null
}
