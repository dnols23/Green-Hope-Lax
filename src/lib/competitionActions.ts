'use server'

import { revalidatePath } from 'next/cache'
import { requireSection } from './permissions'
import { isSandboxed } from './sections'
import { createServiceClient } from './supabase-server'
import { COMP_FORMATS, isCompKey, readConsequences, type Consequence } from './compete'
import { DRILL_CATEGORIES } from './drills'
import { readBoard } from './planner'
import { CONSEQUENCES_KEY, listCompetitionTypes } from './competitionsData'

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

// ── Consequences ─────────────────────────────────────────────────────────────

async function ownConsequences(): Promise<Consequence[]> {
  const { data } = await createServiceClient().from('app_settings').select('value').eq('key', CONSEQUENCES_KEY).maybeSingle()
  return readConsequences((data as { value?: unknown } | null)?.value)
}

async function writeConsequences(list: Consequence[]) {
  const { error } = await createServiceClient()
    .from('app_settings')
    .upsert({ key: CONSEQUENCES_KEY, value: JSON.stringify(readConsequences(list)) }, { onConflict: 'key' })
  return error
}

/** A new consequence, from the competition card: added and handed back to use at once. */
export async function addConsequence(
  label: string,
  summary: string,
): Promise<{ ok: true; item: Consequence } | { ok: false; error: string }> {
  const viewer = await requireSection('drills')
  if (isSandboxed(viewer)) return { ok: false, error: 'The consequences list is the staff’s to change.' }
  const name = String(label ?? '').trim().slice(0, 60)
  if (!name) return { ok: false, error: 'Give it a name.' }
  const item: Consequence = { key: keyFor(name), label: name, summary: String(summary ?? '').trim().slice(0, 200) }
  const error = await writeConsequences([...(await ownConsequences()), item])
  if (error) return { ok: false, error: `Couldn’t save: ${error.message}` }
  refresh()
  return { ok: true, item }
}

/** Add or change one of the staff's own, from the drill bank. */
export async function saveConsequence(formData: FormData): Promise<void> {
  const viewer = await requireSection('drills')
  if (isSandboxed(viewer)) return
  const label = text(formData.get('label'), 60)
  if (!label) return
  const summary = text(formData.get('summary'), 200) ?? ''
  const given = String(formData.get('key') ?? '')
  const list = await ownConsequences()
  const next = list.some((c) => c.key === given)
    ? list.map((c) => (c.key === given ? { ...c, label, summary } : c))
    : [...list, { key: keyFor(label), label, summary }]
  await writeConsequences(next)
  refresh()
}

export async function removeConsequence(formData: FormData): Promise<void> {
  const viewer = await requireSection('drills')
  if (isSandboxed(viewer)) return
  const key = String(formData.get('key') ?? '')
  await writeConsequences((await ownConsequences()).filter((c) => c.key !== key))
  refresh()
}
