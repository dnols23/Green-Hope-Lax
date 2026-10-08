'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getViewer, requireOwner } from './permissions'
import { readTeam, withTeam, type Team } from './teams'
import { readBlocks, isLayout, isPageKind, startingBlocks, type PlayBlock, type PlaybookPage } from './playbook'
import { addPage, deletePage, getSettings, listPages, orderPages, playbookSpots, savePage, writeSettings } from './playbookData'
import { readSteps, type PlayStep } from './planner'
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
 * Put a play in a team's playbook, or bring what is there up to date.
 *
 * An ordinary play is one page that borrows the play, so fixing the play fixes
 * the page. A progression is a run of pages, one per step, each holding its own
 * copy of that step: adding it again rewrites those copies, adds pages for new
 * steps and keeps the run together in the deck. Pages for steps that no longer
 * exist are left for the coach to delete (counted in `extra`).
 */
async function placeInPlaybook(
  team: Team,
  play: { id: string; name: string; steps: PlayStep[] | null },
  by: string,
): Promise<{ pageId: string; extra: number } | null> {
  const all = await listPages(team)
  const blockOf = (pg: PlaybookPage) =>
    pg.blocks.find((b): b is PlayBlock => b.kind === 'play' && b.playId === play.id) ?? null
  const mine = all.filter((pg) => blockOf(pg))

  if (!play.steps) {
    if (mine[0]) return { pageId: mine[0].id, extra: 0 }
    const id = await addPage(team, play.name, by, startingBlocks('field', { playId: play.id }), 'field')
    return id ? { pageId: id, extra: 0 } : null
  }

  const steps = play.steps
  const byStep = new Map<number, PlaybookPage>()
  for (const pg of mine) {
    const step = blockOf(pg)?.step
    if (step !== undefined && !byStep.has(step)) byStep.set(step, pg)
  }
  // The play's own page from before it was a progression becomes step 1.
  const plain = mine.find((pg) => blockOf(pg)?.step === undefined)
  if (plain && !byStep.has(0)) byStep.set(0, plain)

  const run: string[] = []
  for (let i = 0; i < steps.length; i++) {
    const title = `${play.name} · ${i + 1} of ${steps.length}`
    const caption = steps[i].note || undefined
    const block: PlayBlock = { kind: 'play', id: 'b1', playId: play.id, board: steps[i].board, caption, step: i }
    const pg = byStep.get(i)
    if (pg) {
      const old = blockOf(pg)!
      await savePage(pg.id, { title, blocks: pg.blocks.map((b) => (b === old ? { ...block, id: old.id, frame: old.frame, z: old.z } : b)) })
      run.push(pg.id)
    } else {
      const id = await addPage(team, title, by, [block], 'field')
      if (id) run.push(id)
    }
  }
  if (!run.length) return null

  // Keep the run together, in step order, where its first page already sat.
  const inRun = new Set(run)
  const firstAt = all.findIndex((pg) => inRun.has(pg.id))
  const rest = all.map((pg) => pg.id).filter((id) => !inRun.has(id))
  const at = firstAt < 0 ? rest.length : all.slice(0, firstAt).filter((pg) => !inRun.has(pg.id)).length
  await orderPages([...rest.slice(0, at), ...run, ...rest.slice(at)])

  const extra = [...byStep.keys()].filter((k) => k >= steps.length).length
  return { pageId: run[0], extra }
}

function revalidateAll() {
  revalidatePath('/admin/playboard')
  revalidatePath('/admin/library')
  revalidatePath('/admin/playbook')
}

const extraNote = (extra: number) =>
  extra ? ` ${extra} page${extra === 1 ? '' : 's'} for steps you removed ${extra === 1 ? 'is' : 'are'} still there — delete ${extra === 1 ? 'it' : 'them'} in the playbook.` : ''

/**
 * Straight off the board into the deck.
 *
 * The Library keeps everything; this is the other button — the one that says
 * we are running it. The play is saved first (to the head coach's own shelf,
 * the same one Save uses), then placed in that team's playbook. The coach stays
 * on the board; the button turns into a link to the page.
 */
export async function addPlayToPlaybook(input: {
  team: string
  name: string
  board: string
  clip: string | null
  /** The progression's steps (JSON), or null for an ordinary play. */
  steps?: string | null
}): Promise<{ ok: true; playId: string; pageId: string; team: Team; note: string } | { ok: false; error: string }> {
  const owner = await requireOwner()
  const team = readTeam(input.team)
  const name = String(input.name ?? '').trim().slice(0, 200)
  if (!name) return { ok: false, error: 'Name the play first.' }

  let board: unknown = {}
  let clip: unknown = null
  let rawSteps: unknown = null
  try {
    board = JSON.parse(input.board || '{}')
    clip = input.clip ? JSON.parse(input.clip) : null
    rawSteps = input.steps ? JSON.parse(input.steps) : null
  } catch {
    return { ok: false, error: 'That board could not be read. Try again.' }
  }

  const by = owner.name || owner.email
  const playId = await savePlay(name, board, by, clip, owner.email, rawSteps)
  if (!playId) return { ok: false, error: 'The play would not save. Try again.' }

  const placed = await placeInPlaybook(team, { id: playId, name, steps: readSteps(rawSteps) }, by)
  if (!placed) return { ok: false, error: 'Saved the play, but the playbook page would not make. Try again.' }
  revalidateAll()
  return { ok: true, playId, pageId: placed.pageId, team, note: extraNote(placed.extra) }
}

/** A play already on a shelf (the Library), into a team's playbook. */
export async function addSavedPlayToPlaybook(input: {
  playId: string
  team: string
}): Promise<{ ok: true; pageId: string; team: Team; note: string } | { ok: false; error: string }> {
  const owner = await requireOwner()
  const team = readTeam(input.team)
  const play = await getPlay(String(input.playId ?? ''))
  if (!play) return { ok: false, error: 'That play is gone.' }
  const placed = await placeInPlaybook(team, play, owner.name || owner.email)
  if (!placed) return { ok: false, error: 'The playbook page would not make. Try again.' }
  revalidateAll()
  return { ok: true, pageId: placed.pageId, team, note: extraNote(placed.extra) }
}

/**
 * After a play is saved: bring every playbook it is already in up to date —
 * a progression's step pages rewritten, new steps given pages. Only the head
 * coach writes the playbook, so for anyone else this does nothing. Returns
 * the teams whose pages were brought up to date.
 */
export async function refreshPlaybooksFor(playId: string): Promise<Team[]> {
  const viewer = await getViewer()
  if (!viewer?.isOwner) return []
  const play = await getPlay(playId)
  if (!play) return []
  const spots = (await playbookSpots())[play.id] ?? []
  const teams = [...new Set(spots.map((s) => s.team))]
  for (const team of teams) await placeInPlaybook(team, play, viewer.name || viewer.email)
  if (teams.length) revalidatePath('/admin/playbook')
  return teams
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
