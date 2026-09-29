'use server'

import { revalidatePath } from 'next/cache'
import { requireSection } from './permissions'
import { isSandboxed } from './sections'
import { createServiceClient } from './supabase-server'
import { COMP_FORMATS, isCompKey } from './compete'
import { DRILL_CATEGORIES } from './drills'
import { readBoard } from './planner'
import { listCompetitionTypes } from './competitionsData'

const NEEDS_0050 = 'Competitions in the drill bank need supabase/migrations/0050_competition_types.sql run in the Supabase SQL editor.'
const text = (v: FormDataEntryValue | null, max: number) => String(v ?? '').trim().slice(0, max) || null

function refresh() {
  revalidatePath('/admin/drills')
  revalidatePath('/admin/planner', 'layout')
}

/** A new competition's key, from its name: "Hot potato" → "hot-potato-4k2". */
function keyFor(label: string): string {
  const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30) || 'comp'
  return `${slug}-${Math.random().toString(36).slice(2, 5)}`
}

/** Add a competition, or change one — a built-in's change is kept under its own key. */
export async function saveCompetitionType(formData: FormData): Promise<void> {
  const viewer = await requireSection('drills')
  if (isSandboxed(viewer)) return
  const label = text(formData.get('label'), 60)
  if (!label) return
  const given = String(formData.get('key') ?? '')
  const key = isCompKey(given) ? given : keyFor(label)
  const fits = formData
    .getAll('fits')
    .map(String)
    .filter((c) => DRILL_CATEGORIES.some((d) => d.key === c))
  const link = text(formData.get('link'), 500)
  const { error } = await createServiceClient()
    .from('competition_types')
    .upsert(
      {
        key,
        label,
        summary: text(formData.get('summary'), 200),
        setup: text(formData.get('setup'), 4000),
        how: text(formData.get('how'), 4000),
        why: text(formData.get('why'), 4000),
        link: link && /^https?:\/\//i.test(link) ? link : null,
        link_label: text(formData.get('link_label'), 80),
        fits,
        created_by: viewer.email,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' },
    )
  if (error) console.error('[saveCompetitionType]', error.message)
  refresh()
}

/** A built-in back the way it shipped, or one of the staff's own gone. */
export async function removeCompetitionType(formData: FormData): Promise<void> {
  const viewer = await requireSection('drills')
  if (isSandboxed(viewer)) return
  const key = String(formData.get('key') ?? '')
  if (!isCompKey(key)) return
  await createServiceClient().from('competition_types').delete().eq('key', key)
  refresh()
}

/** A competition's field diagram. */
export async function saveCompetitionBoard(key: string, raw: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const viewer = await requireSection('drills')
  if (isSandboxed(viewer)) return { ok: false, error: 'Competitions are the staff’s to change.' }
  if (!isCompKey(key)) return { ok: false, error: 'That competition is gone.' }
  const { ready, list } = await listCompetitionTypes()
  if (!ready) return { ok: false, error: NEEDS_0050 }
  const f = list.find((x) => x.key === key) ?? COMP_FORMATS.find((x) => x.key === key)
  if (!f) return { ok: false, error: 'That competition is gone.' }
  const { error } = await createServiceClient()
    .from('competition_types')
    .upsert({ key, label: f.label, board: raw === null ? null : readBoard(raw), updated_at: new Date().toISOString() }, { onConflict: 'key' })
  if (error) return { ok: false, error: `Couldn’t save: ${error.message}` }
  refresh()
  return { ok: true }
}
