'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireSection } from './permissions'
import { isSandboxed } from './sections'
import { createServiceClient } from './supabase-server'
import { PROGRESSION_POSITIONS, readSteps, type ProgressionStep } from './progressions'

const PAGE = '/admin/drills/progressions'

function refresh() {
  revalidatePath(PAGE)
  revalidatePath('/admin/planner', 'layout')
}

const position = (v: unknown) => (PROGRESSION_POSITIONS.some((p) => p.key === v) ? String(v) : 'all')

/** A new, empty progression — opened straight away to fill in. */
export async function createProgression(form: FormData) {
  const viewer = await requireSection('drills')
  if (isSandboxed(viewer)) return
  const name = String(form.get('name') ?? '').trim().slice(0, 120)
  if (!name) return
  const { data } = await createServiceClient()
    .from('drill_progressions')
    .insert({ name, position: position(form.get('position')), steps: [], created_by: viewer.email })
    .select('id')
    .single()
  refresh()
  if (data?.id) redirect(`${PAGE}?open=${data.id}`)
}

/** Name, position, notes and steps, saved as they change. */
export async function saveProgression(input: {
  id: string
  name: string
  position: string
  notes: string
  steps: ProgressionStep[]
}): Promise<{ ok: boolean; error?: string }> {
  const viewer = await requireSection('drills')
  if (isSandboxed(viewer)) return { ok: false, error: 'Read only.' }
  const name = String(input.name ?? '').trim().slice(0, 120)
  if (!name) return { ok: false, error: 'Give it a name.' }
  const { error } = await createServiceClient()
    .from('drill_progressions')
    .update({
      name,
      position: position(input.position),
      notes: String(input.notes ?? '').trim().slice(0, 4000) || null,
      steps: readSteps(input.steps),
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.id)
  if (error) return { ok: false, error: error.message }
  refresh()
  return { ok: true }
}

export async function deleteProgression(id: string) {
  const viewer = await requireSection('drills')
  if (isSandboxed(viewer)) return
  await createServiceClient().from('drill_progressions').delete().eq('id', String(id))
  refresh()
}

