'use server'

import { revalidatePath } from 'next/cache'
import { requireSection } from './permissions'
import { createServiceClient } from './supabase-server'
import { getWish, isWishKind, isWishStatus, isWishTeam } from './wishlist'
import type { Viewer } from './sections'

/**
 * Writing the wish list.
 *
 * Any coach may put something on it and change what he put there; the head of
 * the program makes the call — approved or rejected — and keeps the next steps.
 */

const str = (v: FormDataEntryValue | null, max = 2000) => String(v ?? '').trim().slice(0, max)
const orNull = (v: string) => v || null

function mayEdit(viewer: Viewer, addedBy: string | null) {
  return viewer.isOwner || (!!addedBy && addedBy.toLowerCase() === viewer.email.toLowerCase())
}

function fields(fd: FormData) {
  const kind = str(fd.get('kind'))
  const team = str(fd.get('team'))
  let link = str(fd.get('link'), 500)
  if (link && !/^https?:\/\//i.test(link)) link = `https://${link}`
  return {
    title: str(fd.get('title'), 200),
    kind: isWishKind(kind) ? kind : 'want',
    team: isWishTeam(team) ? team : 'program',
    cost: orNull(str(fd.get('cost'), 80)),
    link: orNull(link),
    contact: orNull(str(fd.get('contact'), 1000)),
    pitch: orNull(str(fd.get('pitch'), 4000)),
  }
}

export async function addWish(fd: FormData) {
  const viewer = await requireSection('wishlist')
  const row = fields(fd)
  if (!row.title) return
  await createServiceClient()
    .from('wish_items')
    .insert({ ...row, added_by: viewer.email, added_by_name: viewer.name || viewer.email })
  revalidatePath('/admin/wishlist')
}

export async function updateWish(fd: FormData) {
  const viewer = await requireSection('wishlist')
  const item = await getWish(str(fd.get('id')))
  if (!item || !mayEdit(viewer, item.addedBy)) return
  const row = fields(fd)
  if (!row.title) return
  await createServiceClient()
    .from('wish_items')
    .update({ ...row, updated_at: new Date().toISOString() })
    .eq('id', item.id)
  revalidatePath('/admin/wishlist')
}

export async function deleteWish(fd: FormData) {
  const viewer = await requireSection('wishlist')
  const item = await getWish(str(fd.get('id')))
  if (!item || !mayEdit(viewer, item.addedBy)) return
  await createServiceClient().from('wish_items').delete().eq('id', item.id)
  revalidatePath('/admin/wishlist')
}

/** The head coach's call. Pressing the same one again puts it back to open. */
export async function decideWish(fd: FormData) {
  const viewer = await requireSection('wishlist')
  if (!viewer.isOwner) return
  const item = await getWish(str(fd.get('id')))
  const status = str(fd.get('status'))
  if (!item || !isWishStatus(status)) return
  const next = item.status === status ? 'pending' : status
  await createServiceClient()
    .from('wish_items')
    .update({
      status: next,
      decided_at: next === 'pending' ? null : new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', item.id)
  revalidatePath('/admin/wishlist')
}

export async function saveNextSteps(fd: FormData) {
  const viewer = await requireSection('wishlist')
  if (!viewer.isOwner) return
  const id = str(fd.get('id'))
  if (!id) return
  await createServiceClient()
    .from('wish_items')
    .update({ next_steps: orNull(str(fd.get('next_steps'), 4000)), updated_at: new Date().toISOString() })
    .eq('id', id)
  revalidatePath('/admin/wishlist')
}
