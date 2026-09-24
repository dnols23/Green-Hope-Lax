'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { requireOwner } from './permissions'
import { readTeam, withTeam, type Team } from './teams'
import { readBlocks, isLayout, isPageKind, startingBlocks } from './playbook'
import { addPage, deletePage, getSettings, orderPages, savePage, writeSettings } from './playbookData'
import { findPlayByName, savePlay } from './plays'

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
 * we are running it. The play is saved first, because a page pointing at a play
 * that was never saved is a page with a hole in it, then a page is made with
 * the play already on it and opened for the words to go round it.
 */
export async function playToPlaybook(formData: FormData) {
  const owner = await requireOwner()
  const team = readTeam(formData.get('team'))
  const name = str(formData.get('name'))
  if (!name) return

  let board: unknown = {}
  try {
    board = JSON.parse(str(formData.get('board')) || '{}')
  } catch {
    return
  }
  let clip: unknown = null
  try {
    const raw = str(formData.get('clip'))
    clip = raw ? JSON.parse(raw) : null
  } catch {
    clip = null
  }

  const by = owner.name || owner.email
  await savePlay(name, board, by, clip)
  const playId = await findPlayByName(name)
  if (!playId) return

  const id = await addPage(team, name, by, startingBlocks('field', { playId }), 'field')
  revalidatePath('/admin/playboard')
  revalidatePath('/admin/library')
  revalidatePath('/admin/playbook')
  redirect(id ? withTeam(`/admin/playbook/${id}`, team) : withTeam('/admin/playbook', team))
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
