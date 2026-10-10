'use server'

import { revalidatePath } from 'next/cache'
import { requireSection } from './permissions'
import { createServiceClient } from './supabase-server'
import { canonicalArea, cleanArea, getCoachingEntry, listCoachingEntries, areaSlug } from './coachingBank'

/**
 * Writing the Coaching Bank. It is the head coach's philosophy, so only he
 * writes it; every coach can read it.
 */

const str = (v: FormDataEntryValue | null, max = 4000) => String(v ?? '').trim().slice(0, max)
const orNull = (v: string) => v || null
const PATH = '/admin/coaching'

async function owner() {
  const viewer = await requireSection('coaching')
  return viewer.isOwner ? viewer : null
}

async function fields(fd: FormData) {
  let url = str(fd.get('url'), 500)
  if (url && !/^https?:\/\//i.test(url)) url = `https://${url}`
  const all = (await listCoachingEntries()) ?? []
  return {
    area: canonicalArea(cleanArea(fd.get('area')), all),
    title: str(fd.get('title'), 200),
    url: orNull(url),
    point: orNull(str(fd.get('point'), 2000)),
    notes: orNull(str(fd.get('notes'), 8000)),
    all,
  }
}

export async function addCoachingEntry(fd: FormData) {
  const viewer = await owner()
  if (!viewer) return
  const { all, ...row } = await fields(fd)
  if (!row.title || !row.area) return
  // New entries go to the top of their area.
  const inArea = all.filter((e) => areaSlug(e.area) === areaSlug(row.area))
  const position = inArea.length ? Math.min(...inArea.map((e) => e.position)) - 1 : 0
  await createServiceClient().from('coaching_entries').insert({ ...row, position, added_by: viewer.email })
  revalidatePath(PATH)
}

export async function updateCoachingEntry(fd: FormData) {
  if (!(await owner())) return
  const entry = await getCoachingEntry(str(fd.get('id')))
  if (!entry) return
  const { all, ...row } = await fields(fd)
  if (!row.title || !row.area) return
  const moved = areaSlug(row.area) !== areaSlug(entry.area)
  const inArea = all.filter((e) => areaSlug(e.area) === areaSlug(row.area))
  await createServiceClient()
    .from('coaching_entries')
    .update({
      ...row,
      // Filed somewhere new: it goes to the top there.
      ...(moved ? { position: inArea.length ? Math.min(...inArea.map((e) => e.position)) - 1 : 0 } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', entry.id)
  revalidatePath(PATH)
}

export async function deleteCoachingEntry(id: string) {
  if (!(await owner())) return
  const entry = await getCoachingEntry(id)
  if (!entry) return
  await createServiceClient().from('coaching_entries').delete().eq('id', entry.id)
  revalidatePath(PATH)
}

/** Up or down one place within its area. */
export async function moveCoachingEntry(fd: FormData) {
  if (!(await owner())) return
  const id = str(fd.get('id'))
  const dir = str(fd.get('dir')) === 'up' ? -1 : 1
  const all = await listCoachingEntries()
  const entry = all?.find((e) => e.id === id)
  if (!all || !entry) return
  const inArea = all.filter((e) => areaSlug(e.area) === areaSlug(entry.area))
  const i = inArea.findIndex((e) => e.id === id)
  const other = inArea[i + dir]
  if (!other) return
  // Renumber the area so ties (two entries at 0) can't stop a swap.
  const order = inArea.map((e) => e.id)
  ;[order[i], order[i + dir]] = [order[i + dir], order[i]]
  const svc = createServiceClient()
  await Promise.all(order.map((eid, n) => svc.from('coaching_entries').update({ position: n }).eq('id', eid)))
  revalidatePath(PATH)
}
