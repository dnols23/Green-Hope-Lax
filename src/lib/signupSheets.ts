import { createServiceClient } from './supabase-server'

/**
 * Sign-up sheets — who is bringing what, who is driving, who is working the
 * table.
 *
 * A sheet is a list of slots; a slot needs a number of people; a claim is one
 * person taking one of them. The claim copies the name onto itself instead of
 * only pointing at a parent row, so a sheet still reads right after somebody
 * leaves the program.
 */

export interface SignupSlot {
  id: string
  sheet_id: string
  label: string
  detail: string | null
  needed: number
  sort_order: number
}

export interface SignupClaim {
  id: string
  slot_id: string
  parent_id: string | null
  name: string
  email: string | null
  note: string | null
  created_at: string
}

export interface SignupSheet {
  id: string
  title: string
  description: string | null
  event_date: string | null
  location: string | null
  is_open: boolean
  created_by: string | null
  created_at: string
}

export interface SheetWithSlots extends SignupSheet {
  slots: (SignupSlot & { claims: SignupClaim[] })[]
}

/**
 * Parse the slots a coach types, one per line:
 *
 *     Water & oranges | 2 | enough for 25 kids
 *     Drive the pop-up tent
 *
 * The count and the note are optional because most lines are just a job.
 */
export function parseSlots(raw: string): { label: string; needed: number; detail: string | null }[] {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [labelRaw, countRaw, ...rest] = line.split('|').map((p) => p.trim())
      const needed = Number.parseInt(countRaw ?? '', 10)
      return {
        label: labelRaw,
        needed: Number.isFinite(needed) && needed > 0 ? Math.min(needed, 50) : 1,
        detail: rest.join(' | ').trim() || null,
      }
    })
    .filter((s) => s.label.length > 0)
}

export async function listSheets(includeClosed = false): Promise<SignupSheet[]> {
  let q = createServiceClient()
    .from('signup_sheets')
    .select('*')
    .order('event_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })
  if (!includeClosed) q = q.eq('is_open', true)
  const { data } = await q
  return (data as SignupSheet[]) ?? []
}

/** One sheet, its slots, and who has taken them. */
export async function getSheet(id: string): Promise<SheetWithSlots | null> {
  const svc = createServiceClient()
  const { data: sheet } = await svc.from('signup_sheets').select('*').eq('id', id).maybeSingle()
  if (!sheet) return null

  const { data: slots } = await svc
    .from('signup_slots')
    .select('*')
    .eq('sheet_id', id)
    .order('sort_order', { ascending: true })

  const slotRows = (slots as SignupSlot[]) ?? []
  const { data: claims } = await svc
    .from('signup_claims')
    .select('*')
    .in('slot_id', slotRows.length ? slotRows.map((s) => s.id) : ['00000000-0000-0000-0000-000000000000'])
    .order('created_at', { ascending: true })

  const claimRows = (claims as SignupClaim[]) ?? []
  return {
    ...(sheet as SignupSheet),
    slots: slotRows.map((s) => ({ ...s, claims: claimRows.filter((c) => c.slot_id === s.id) })),
  }
}

/** How many spots are still open on a sheet — the one number a parent scans for. */
export function spotsLeft(sheet: SheetWithSlots): number {
  return sheet.slots.reduce((n, s) => n + Math.max(0, s.needed - s.claims.length), 0)
}

export async function createSheet(input: {
  title: string
  description?: string | null
  eventDate?: string | null
  location?: string | null
  createdBy?: string | null
  slots: string
}): Promise<{ id: string | null; error?: string }> {
  const svc = createServiceClient()
  const { data, error } = await svc
    .from('signup_sheets')
    .insert({
      title: input.title,
      description: input.description || null,
      event_date: input.eventDate || null,
      location: input.location || null,
      created_by: input.createdBy || null,
    })
    .select('id')
    .maybeSingle()

  if (error || !data) return { id: null, error: error?.message ?? 'Could not create the sheet.' }

  const id = String((data as { id: string }).id)
  const slots = parseSlots(input.slots)
  if (slots.length) {
    const { error: slotError } = await svc.from('signup_slots').insert(
      slots.map((s, i) => ({ sheet_id: id, label: s.label, needed: s.needed, detail: s.detail, sort_order: i }))
    )
    if (slotError) return { id, error: slotError.message }
  }
  return { id }
}

export async function setSheetOpen(id: string, open: boolean): Promise<void> {
  await createServiceClient().from('signup_sheets').update({ is_open: open }).eq('id', id)
}

export async function deleteSheet(id: string): Promise<void> {
  await createServiceClient().from('signup_sheets').delete().eq('id', id)
}

/**
 * Take a spot.
 *
 * Refuses a full slot and refuses a second claim from the same person, both
 * checked at the moment of writing — two parents tapping at once is the normal
 * case for a sheet that just went out by email.
 */
export async function claimSlot(input: {
  slotId: string
  parentId: string | null
  name: string
  email: string | null
  note: string | null
}): Promise<{ ok: boolean; error?: string }> {
  const svc = createServiceClient()

  const { data: slot } = await svc
    .from('signup_slots')
    .select('id, needed, sheet_id, label')
    .eq('id', input.slotId)
    .maybeSingle()
  if (!slot) return { ok: false, error: 'That spot is no longer on the sheet.' }

  const { data: sheet } = await svc
    .from('signup_sheets')
    .select('is_open')
    .eq('id', (slot as { sheet_id: string }).sheet_id)
    .maybeSingle()
  if (!sheet || !(sheet as { is_open: boolean }).is_open) {
    return { ok: false, error: 'This sheet is closed.' }
  }

  const { data: claims } = await svc.from('signup_claims').select('*').eq('slot_id', input.slotId)
  const rows = (claims as SignupClaim[]) ?? []
  if (rows.length >= (slot as { needed: number }).needed) {
    return { ok: false, error: 'Somebody just took the last spot.' }
  }
  if (input.parentId && rows.some((c) => c.parent_id === input.parentId)) {
    return { ok: false, error: 'You already have this one.' }
  }

  const { error } = await svc.from('signup_claims').insert({
    slot_id: input.slotId,
    parent_id: input.parentId,
    name: input.name,
    email: input.email,
    note: input.note,
  })
  return error ? { ok: false, error: error.message } : { ok: true }
}

export async function releaseClaim(claimId: string, parentId: string | null): Promise<void> {
  const svc = createServiceClient()
  // A parent may only drop their own; a coach passes null and may drop any.
  let q = svc.from('signup_claims').delete().eq('id', claimId)
  if (parentId) q = q.eq('parent_id', parentId)
  await q
}
