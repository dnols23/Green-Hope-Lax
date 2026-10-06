'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { requireOwner } from './permissions'
import { readTeam, withTeam, type Team } from './teams'
import { readBlocks, isLayout, isPageKind, startingBlocks } from './playbook'
import { addPage, deletePage, getSettings, orderPages, playbookSpots, savePage, writeSettings } from './playbookData'
import { getPlay, savePlay } from './plays'

const str = (v: FormDataEntryValue | null) => (typeof v === 'string' ? v.trim() : '')

/**
 * Writing the playbook.
 *
 * Every one of these calls requireOwner(). The playbook is the head coach's
 * word on what the team runs — an assistant with a good idea should say it out
 * loud, not edit the deck.
 */

export async function addPlaybookPage(formData: FormData) {
  const owner = await requireOwner()
  const team = readTeam(formData.get('team'))
  /* What sort of page: a field (whole or one end), words, or a picture. A page
     can also be born with a play already on it — that is what "Add to
     playbook" on the board does. */
  const kindRaw = str(formData.get('kind'))
  // "field-half" is a field page that starts on one end.
  const half = kindRaw === 'field-half' || str(formData.get('half')) === '1'
  const kind = kindRaw === 'field-half' ? 'field' : isPageKind(kindRaw) ? kindRaw : 'field'
  const playId = str(formData.get('play_id'))
  const title =
    str(formData.get('title')) ||
    (kind === 'words' ? 'New section' : kind === 'picture' ? 'Picture' : half ? 'Half field' : 'New play')
  const blocks = startingBlocks(kind, { half, playId: playId || undefined })

  const id = await addPage(team, title, owner.name || owner.email, blocks, kind)
  revalidatePath('/admin/playbook')
  if (id) redirect(withTeam(`/admin/playbook/${id}`, team))
  redirect(withTeam('/admin/playbook', team))
}

/**
 * Straight off the board into the deck.
 *
 * The Library keeps everything; this is the other button — the one that says
 * we are running it. The play is saved first (to the head coach's own shelf,
 * the same one Save uses), then it gets a page at the end of that team's
 * playbook — unless it already has one there, in which case that page is the
 * answer. The coach stays on the board; the button turns into a link to the page.
 */
export async function addPlayToPlaybook(input: {
  team: string
  name: string
  board: string
  clip: string | null
}): Promise<{ ok: true; playId: string; pageId: string; team: Team } | { ok: false; error: string }> {
  const owner = await requireOwner()
  const team = readTeam(input.team)
  const name = String(input.name ?? '').trim().slice(0, 200)
  if (!name) return { ok: false, error: 'Name the play first.' }

  let board: unknown = {}
  let clip: unknown = null
  try {
    board = JSON.parse(input.board || '{}')
    clip = input.clip ? JSON.parse(input.clip) : null
  } catch {
    return { ok: false, error: 'That board could not be read. Try again.' }
  }

  const by = owner.name || owner.email
  const playId = await savePlay(name, board, by, clip, owner.email)
  if (!playId) return { ok: false, error: 'The play would not save. Try again.' }

  const already = (await playbookSpots())[playId]?.find((s) => s.team === team)
  const pageId = already?.pageId ?? (await addPage(team, name, by, startingBlocks('field', { playId }), 'field'))
  if (!pageId) return { ok: false, error: 'Saved the play, but the playbook page would not make. Try again.' }

  revalidatePath('/admin/playboard')
  revalidatePath('/admin/library')
  revalidatePath('/admin/playbook')
  return { ok: true, playId, pageId, team }
}

/** A play already on a shelf (the Library), onto a page of a team's playbook. */
export async function addSavedPlayToPlaybook(input: {
  playId: string
  team: string
}): Promise<{ ok: true; pageId: string; team: Team } | { ok: false; error: string }> {
  const owner = await requireOwner()
  const team = readTeam(input.team)
  const play = await getPlay(String(input.playId ?? ''))
  if (!play) return { ok: false, error: 'That play is gone.' }
  const already = (await playbookSpots())[play.id]?.find((s) => s.team === team)
  const pageId =
    already?.pageId ??
    (await addPage(team, play.name, owner.name || owner.email, startingBlocks('field', { playId: play.id }), 'field'))
  if (!pageId) return { ok: false, error: 'The playbook page would not make. Try again.' }
  revalidatePath('/admin/library')
  revalidatePath('/admin/playboard')
  revalidatePath('/admin/playbook')
  return { ok: true, pageId, team }
}

export async function savePlaybookPage(formData: FormData) {
  await requireOwner()
  const id = str(formData.get('id'))
  if (!id) return
  const team: Team = readTeam(formData.get('team'))

  let blocks: unknown = []
  try {
    blocks = readBlocks(JSON.parse(str(formData.get('blocks')) || '[]'))
  } catch {
    // A page that can't be read back is a page nobody should overwrite.
    return
  }
  const layoutRaw = str(formData.get('layout'))

  await savePage(id, {
    title: str(formData.get('title')),
    blocks,
    layout: isLayout(layoutRaw) ? layoutRaw : 'split',
    notes: str(formData.get('notes')) || null,
  })
  revalidatePath('/admin/playbook')
  revalidatePath(`/admin/playbook/${id}`)
  redirect(withTeam('/admin/playbook', team))
}

export async function deletePlaybookPage(formData: FormData) {
  await requireOwner()
  const id = str(formData.get('id'))
  const team = readTeam(formData.get('team'))
  if (id) await deletePage(id)
  revalidatePath('/admin/playbook')
  redirect(withTeam('/admin/playbook', team))
}

export async function orderPlaybook(formData: FormData) {
  await requireOwner()
  const ids = str(formData.get('ids')).split(',').map((s) => s.trim()).filter(Boolean)
  if (ids.length) await orderPages(ids)
  revalidatePath('/admin/playbook')
}

/** The deck's name, and who may read it. */
export async function savePlaybookSettings(formData: FormData) {
  await requireOwner()
  const team = readTeam(formData.get('team'))
  const current = await getSettings(team)
  await writeSettings(team, {
    title: str(formData.get('title')) || current.title,
    publishPlayers: str(formData.get('publish_players')) === 'on',
    publishCoaches: str(formData.get('publish_coaches')) === 'on',
  })
  revalidatePath('/admin/playbook')
  revalidatePath('/team/playbook')
}
