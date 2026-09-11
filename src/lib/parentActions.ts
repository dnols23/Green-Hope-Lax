'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import {
  PARENT_COOKIE,
  currentParent,
  joinTokenValid,
  registerParent,
  rollJoinToken,
  setTeamParent,
  removeParent,
} from './parentAccess'
import {
  claimSlot,
  createSheet,
  deleteSheet,
  getSheet,
  releaseClaim,
  setSheetOpen,
} from './signupSheets'
import { notifyCoaches } from './notify'
import { sendEmail, emailShell, row } from './email'
import { requireSection } from './permissions'
import type { FormState } from './actions'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const str = (v: FormDataEntryValue | null) => (typeof v === 'string' ? v.trim() : '')
const YEAR = 60 * 60 * 24 * 365

/** Registering from the emailed link. Sets the cookie that is their way back. */
export async function joinParentHub(_prev: FormState, formData: FormData): Promise<FormState> {
  const token = str(formData.get('join_token'))
  if (!(await joinTokenValid(token))) {
    return { ok: false, error: 'That link has expired. Ask a coach for the current one.' }
  }

  const name = str(formData.get('name'))
  const email = str(formData.get('email'))
  if (!name) return { ok: false, error: 'Please enter your name.' }
  if (!EMAIL_RE.test(email)) return { ok: false, error: 'Please enter a valid email address.' }

  const { parent, created, error } = await registerParent({
    name,
    email,
    phone: str(formData.get('phone')) || null,
    playerName: str(formData.get('player_name')) || null,
  })
  if (!parent) {
    console.error('[joinParentHub]', error)
    return { ok: false, error: 'Something went wrong signing you in. Please try again.' }
  }

  ;(await cookies()).set(PARENT_COOKIE, parent.token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: YEAR,
    path: '/',
  })

  if (created) {
    await notifyCoaches({
      event: 'parent-join',
      subject: `New parent in the Parent Hub: ${parent.name}`,
      replyTo: parent.email,
      html: emailShell(
        'New Parent Hub Registration',
        row('Parent', parent.name) +
          row('Email', parent.email) +
          row('Phone', parent.phone) +
          row('Player', parent.player_name)
      ),
    })
  }

  redirect('/parents')
}

/** Taking a spot on a sheet. */
export async function takeSlot(_prev: FormState, formData: FormData): Promise<FormState> {
  const parent = await currentParent()
  if (!parent) return { ok: false, error: 'Please sign in to the Parent Hub first.' }

  const slotId = str(formData.get('slot_id'))
  const sheetId = str(formData.get('sheet_id'))
  const note = str(formData.get('note')) || null

  const { ok, error } = await claimSlot({
    slotId,
    parentId: parent.id,
    name: parent.name,
    email: parent.email,
    note,
  })
  if (!ok) return { ok: false, error }

  const sheet = await getSheet(sheetId)
  const slot = sheet?.slots.find((s) => s.id === slotId)

  if (sheet && slot) {
    await notifyCoaches({
      event: 'signup-claim',
      subject: `${parent.name} signed up: ${slot.label}`,
      replyTo: parent.email,
      html: emailShell(
        'Sign-up Sheet',
        row('Sheet', sheet.title) +
          row('Spot', slot.label) +
          row('Parent', parent.name) +
          row('Email', parent.email) +
          row('Phone', parent.phone) +
          row('Note', note)
      ),
    })

    // The parent gets their own copy — it is the only record they have of what
    // they said they would bring.
    await sendEmail({
      to: parent.email,
      subject: `You're signed up: ${slot.label}`,
      html: emailShell(
        'You’re signed up',
        row('Sheet', sheet.title) +
          row('Spot', slot.label) +
          row('When', sheet.event_date ? new Date(sheet.event_date).toLocaleString('en-US') : null) +
          row('Where', sheet.location) +
          row('Your note', note)
      ),
    })
  }

  revalidatePath(`/parents/s/${sheetId}`)
  revalidatePath('/parents')
  return { ok: true }
}

export async function dropSlot(formData: FormData) {
  const parent = await currentParent()
  if (!parent) return
  const claimId = str(formData.get('claim_id'))
  const sheetId = str(formData.get('sheet_id'))
  await releaseClaim(claimId, parent.id)
  revalidatePath(`/parents/s/${sheetId}`)
  revalidatePath('/parents')
}

/** Making a sheet — a coach from the admin, a team parent from the hub. */
export async function newSheet(_prev: FormState, formData: FormData): Promise<FormState> {
  const from = str(formData.get('from')) === 'admin' ? 'admin' : 'hub'
  let author = ''

  if (from === 'admin') {
    const viewer = await requireSection('parents')
    author = viewer.name || 'Coach'
  } else {
    const parent = await currentParent()
    if (!parent?.is_team_parent) {
      return { ok: false, error: 'Only team parents can create sign-ups.' }
    }
    author = parent.name
  }

  const title = str(formData.get('title'))
  if (!title) return { ok: false, error: 'Give the sign-up a title.' }

  const { id, error } = await createSheet({
    title,
    description: str(formData.get('description')) || null,
    eventDate: str(formData.get('event_date')) || null,
    location: str(formData.get('location')) || null,
    createdBy: author,
    slots: str(formData.get('slots')),
  })
  if (!id) {
    console.error('[newSheet]', error)
    return { ok: false, error: 'Could not create the sign-up. Has the parent hub SQL been run?' }
  }

  revalidatePath('/parents')
  revalidatePath('/admin/parents')
  redirect(from === 'admin' ? '/admin/parents' : `/parents/s/${id}`)
}

// ── Coach-only housekeeping ──
export async function toggleSheet(formData: FormData) {
  await requireSection('parents')
  await setSheetOpen(str(formData.get('id')), str(formData.get('open')) === 'true')
  revalidatePath('/admin/parents')
  revalidatePath('/parents')
}

export async function removeSheet(id: string) {
  await requireSection('parents')
  await deleteSheet(id)
  revalidatePath('/admin/parents')
  revalidatePath('/parents')
}

export async function toggleTeamParent(formData: FormData) {
  await requireSection('parents')
  await setTeamParent(str(formData.get('id')), str(formData.get('on')) === 'true')
  revalidatePath('/admin/parents')
}

export async function deleteParent(id: string) {
  await requireSection('parents')
  await removeParent(id)
  revalidatePath('/admin/parents')
}

export async function newJoinLink() {
  await requireSection('parents')
  await rollJoinToken()
  revalidatePath('/admin/parents')
}
