'use server'

import { revalidatePath } from 'next/cache'
import { requireSection } from './permissions'
import { createServiceClient } from './supabase-server'
import { cleanHandle, getRecruit, isRecruitStatus } from './recruits'
import { ymdOf } from './zoned'

/**
 * Writing the recruits board. Every coach adds and updates — it's the staff's
 * list, worked together. Taking one off is for whoever added it, or the head
 * coach.
 */

const str = (v: FormDataEntryValue | null, max = 2000) => String(v ?? '').trim().slice(0, max)
const orNull = (v: string) => v || null

function fields(fd: FormData) {
  const year = Number(str(fd.get('grad_year'), 4))
  const status = str(fd.get('status'))
  return {
    name: str(fd.get('name'), 120),
    grad_year: Number.isInteger(year) && year >= 2000 && year <= 2100 ? year : null,
    school: orNull(str(fd.get('school'), 120)),
    sports: orNull(str(fd.get('sports'), 200)),
    position: orNull(str(fd.get('position'), 60)),
    handle: cleanHandle(str(fd.get('handle'), 200)),
    parent_name: orNull(str(fd.get('parent_name'), 120)),
    parent_contact: orNull(str(fd.get('parent_contact'), 200)),
    next_step: orNull(str(fd.get('next_step'), 500)),
    notes: orNull(str(fd.get('notes'), 4000)),
    coach: orNull(str(fd.get('coach'), 120)),
    ...(isRecruitStatus(status) ? { status } : {}),
  }
}

function refresh() {
  revalidatePath('/admin/recruits')
}

export async function addRecruit(fd: FormData) {
  const viewer = await requireSection('recruits')
  const row = fields(fd)
  if (!row.name) return
  await createServiceClient()
    .from('recruits')
    .insert({
      ...row,
      ...(row.status === 'tweeted' ? { tweeted_at: ymdOf(new Date()) } : {}),
      added_by: viewer.email,
      added_by_name: viewer.name || viewer.email,
    })
  refresh()
}

export async function updateRecruit(fd: FormData) {
  await requireSection('recruits')
  const r = await getRecruit(str(fd.get('id')))
  if (!r) return
  const row = fields(fd)
  if (!row.name) return
  await createServiceClient()
    .from('recruits')
    .update({
      ...row,
      ...(row.status === 'tweeted' && !r.tweetedAt ? { tweeted_at: ymdOf(new Date()) } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', r.id)
  refresh()
}

/** Moving one along the board, from the list. Tweeting stamps the day. */
export async function setRecruitStatus(fd: FormData) {
  await requireSection('recruits')
  const r = await getRecruit(str(fd.get('id')))
  const status = str(fd.get('status'))
  if (!r || !isRecruitStatus(status)) return
  await createServiceClient()
    .from('recruits')
    .update({
      status,
      ...(status === 'tweeted' ? { tweeted_at: ymdOf(new Date()) } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', r.id)
  refresh()
}

export async function deleteRecruit(fd: FormData) {
  const viewer = await requireSection('recruits')
  const r = await getRecruit(str(fd.get('id')))
  if (!r) return
  const mine = !!r.addedBy && r.addedBy.toLowerCase() === viewer.email.toLowerCase()
  if (!viewer.isOwner && !mine) return
  await createServiceClient().from('recruits').delete().eq('id', r.id)
  refresh()
}
