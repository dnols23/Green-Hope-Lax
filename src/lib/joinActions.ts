'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createServiceClient } from './supabase-server'
import { ensurePlayerToken } from './playerAccess'
import { PLAYER_COOKIE } from './playerAccess.edge'
import { TEAM_COOKIE, teamCookieToken } from './teamAuth'
import {
  ensureJoinLink,
  joinLinkValid,
  readSigninSettings,
  rollJoinLink,
  writeSigninSettings,
  type JoinKind,
} from './joinLinks'
import { readStaff, writeStaff } from './staff'
import { requireOwner } from './permissions'
import { notifyCoaches } from './notify'
import { emailShell, row } from './email'
import type { FormState } from './actions'

const str = (v: FormDataEntryValue | null) => (typeof v === 'string' ? v.trim() : '')
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const YEAR = 60 * 60 * 24 * 365

/**
 * A player signing himself in from the one team link.
 *
 * He picks himself off the roster rather than typing a name: a free-text name
 * on a shared link is a stranger's way in, and it also spells "Cayden" four
 * different ways by Thursday.
 */
export async function joinAsPlayer(_prev: FormState, formData: FormData): Promise<FormState> {
  const token = str(formData.get('join_token'))
  if (!(await joinLinkValid('player', token))) {
    return { ok: false, error: 'That link is closed. Ask a coach for the current one.' }
  }

  const playerId = str(formData.get('player_id'))
  if (!playerId) return { ok: false, error: 'Pick your name from the list.' }

  const svc = createServiceClient()
  const { data: player } = await svc.from('players').select('id, name').eq('id', playerId).maybeSingle()
  if (!player) return { ok: false, error: 'That name is no longer on the roster.' }

  const personal = await ensurePlayerToken(playerId)
  if (!personal) return { ok: false, error: 'Something went wrong signing you in. Tell a coach.' }

  const jar = await cookies()
  const opts = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    maxAge: YEAR,
    path: '/',
  }
  jar.set(PLAYER_COOKIE, personal, opts)
  jar.set(TEAM_COOKIE, await teamCookieToken(), opts)

  await notifyCoaches({
    event: 'parent-join',
    subject: `${(player as { name: string }).name} signed in to the Team Hub`,
    html: emailShell('Player signed in', row('Player', (player as { name: string }).name)),
  })

  redirect('/team/me')
}

/**
 * A coach signing themselves in from the coaches' link.
 *
 * This makes a real admin account with assistant access — no sections ticked
 * until the head coach ticks them. The link is off until somebody deliberately
 * turns it on, because anybody holding it becomes a coach.
 *
 * The link is for staff who have no account yet. If the head coach already made
 * one for them in Coach Access, this says so and stops, rather than quietly
 * making a second account under a different address — or, worse, writing a
 * blank set of permissions over the ones already ticked.
 */
export async function joinAsCoach(_prev: FormState, formData: FormData): Promise<FormState> {
  const token = str(formData.get('join_token'))
  if (!(await joinLinkValid('coach', token))) {
    return { ok: false, error: 'That link is closed. Ask the head coach for the current one.' }
  }

  const name = str(formData.get('name'))
  const email = str(formData.get('email')).toLowerCase()
  const password = str(formData.get('password'))
  if (!name) return { ok: false, error: 'Please give your name.' }
  if (!EMAIL_RE.test(email)) return { ok: false, error: 'Please give a valid email address.' }
  if (password.length < 8) return { ok: false, error: 'Pick a password of at least 8 characters.' }

  const svc = createServiceClient()
  // What the head coach may already have ticked for this person. Keep it — the
  // coach picking a password is not a reason to take their sections away.
  const already = await readStaff(email)

  const { error } = await svc.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
  })
  if (error) {
    if (/already|exists|registered|duplicate/i.test(error.message)) {
      return {
        ok: false,
        error:
          'That email already has a coach account. Sign in with it instead — and if you have ' +
          'forgotten the password, ask the head coach to set you a new one in Coach Access.',
      }
    }
    console.error('[joinAsCoach]', error)
    return { ok: false, error: 'Could not make that account. Tell the head coach.' }
  }

  await writeStaff({
    email,
    name,
    role: already?.role ?? 'assistant',
    isOwner: already?.isOwner ?? false,
    permissions: already?.permissions ?? [],
  })

  await notifyCoaches({
    event: 'parent-join',
    subject: `${name} signed in as a coach`,
    replyTo: email,
    html: emailShell(
      'New coach account',
      row('Name', name) +
        row('Email', email) +
        row(
          'Access',
          already?.permissions.length
            ? 'Kept the sections you had already ticked'
            : 'Assistant — no sections until you grant them'
        )
    ),
  })

  // Back to the coaches' own door, not the owner's.
  redirect('/staff?joined=1')
}

// ── Settings, head coach only ──

export async function setSigninSwitch(formData: FormData) {
  await requireOwner()
  const settings = await readSigninSettings()
  const what = str(formData.get('what'))
  const on = str(formData.get('on')) === 'true'

  if (what === 'code') settings.codeOn = on
  else if (what === 'player' || what === 'parent' || what === 'coach') settings.links[what] = on
  else return

  await writeSigninSettings(settings)
  revalidatePath('/admin/signin')
}

export async function newJoinLink(formData: FormData) {
  await requireOwner()
  const kind = str(formData.get('kind')) as JoinKind
  if (kind !== 'player' && kind !== 'parent' && kind !== 'coach') return
  await rollJoinLink(kind)
  revalidatePath('/admin/signin')
}

export async function currentJoinLink(kind: JoinKind): Promise<string | null> {
  return ensureJoinLink(kind)
}
