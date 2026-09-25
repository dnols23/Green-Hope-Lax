'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createServiceClient } from './supabase-server'
import { ensurePlayerToken } from './playerAccess'
import { PLAYER_COOKIE } from './playerAccess.edge'
import { PARENT_COOKIE } from './parentAccess.edge'
import { registerParent } from './parentAccess'
import { TEAM_COOKIE, hashTeamPassword, teamCookieToken } from './teamAuth'
import { encryptTeamCode } from './teamCode'
import { getContact, saveContact } from './playerContacts'
import { requireOwner } from './permissions'
import { notifyCoaches } from './notify'
import { emailShell, row } from './email'
import {
  PARENT_QUESTIONS,
  PLAYER_FAVORITES,
  PLAYER_GOALS,
  cleanAnswers,
  missingRequired,
} from './hubQuestions'
import {
  checkPassword,
  codeValid,
  findAccount,
  hashPassword,
  playerHasAccount,
  readHubRegistration,
  writeHubRegistration,
  type HubKind,
} from './hubAccounts'

/**
 * Signing up for, and back into, the Team Hub and the Parent Hub.
 *
 * The code is checked again on the final submit — the screens ask for it first
 * only so nobody fills in four pages before finding out it was wrong.
 */

export type HubResult = { ok: true } | { ok: false; error: string }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const YEAR = 60 * 60 * 24 * 365
const text = (v: unknown, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const COOKIE = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  maxAge: YEAR,
  path: '/',
}

export async function checkHubCode(kind: HubKind, code: string): Promise<HubResult> {
  return codeValid(kind, String(code ?? ''))
}

async function signInPlayer(playerId: string): Promise<boolean> {
  const token = await ensurePlayerToken(playerId)
  if (!token) return false
  const jar = await cookies()
  jar.set(PLAYER_COOKIE, token, COOKIE)
  jar.set(TEAM_COOKIE, await teamCookieToken(), COOKIE)
  return true
}

async function signInParent(parentId: string): Promise<boolean> {
  const { data } = await createServiceClient().from('parents').select('token').eq('id', parentId).maybeSingle()
  const token = (data as { token?: string } | null)?.token
  if (!token) return false
  ;(await cookies()).set(PARENT_COOKIE, token, COOKIE)
  return true
}

// ── Players ──────────────────────────────────────────────────────────────────

export interface PlayerSignup {
  code: string
  playerId: string
  email: string
  phone: string
  password: string
  answers: Record<string, unknown>
  conductRead: boolean
  ackSubmitted: boolean
  signedName: string
  company?: string
}

export async function registerPlayerAccount(input: PlayerSignup): Promise<HubResult> {
  if (text(input.company)) return { ok: true }
  const code = await codeValid('player', text(input.code, 100))
  if (!code.ok) return code

  const email = text(input.email).toLowerCase()
  const password = String(input.password ?? '')
  const playerId = text(input.playerId, 64)
  if (!playerId) return { ok: false, error: 'Pick your name from the roster.' }
  if (!EMAIL_RE.test(email)) return { ok: false, error: 'Enter a real email address.' }
  if (password.length < 8) return { ok: false, error: 'Your password needs at least 8 characters.' }

  const questions = [...PLAYER_FAVORITES, ...PLAYER_GOALS]
  const answers = cleanAnswers(input.answers, questions)
  const missing = missingRequired(answers, questions)
  if (missing) return { ok: false, error: `Answer “${missing.label}”.` }

  // The code of conduct is the last step, and it is not optional.
  const signedName = text(input.signedName, 120)
  if (!input.conductRead || !input.ackSubmitted || !signedName) {
    return { ok: false, error: 'Read the code of conduct, submit the acknowledgement form, and sign with your full name.' }
  }

  const svc = createServiceClient()
  const { data: player } = await svc.from('players').select('id, name').eq('id', playerId).maybeSingle()
  if (!player) return { ok: false, error: 'That name isn’t on the roster. Ask a coach.' }
  if (await playerHasAccount(playerId)) {
    return { ok: false, error: 'That player already has an account. Sign in instead, or ask a coach.' }
  }
  if (await findAccount('player', email)) {
    return { ok: false, error: 'There’s already an account with that email. Sign in instead.' }
  }

  const phone = text(input.phone, 40) || null
  const now = new Date().toISOString()
  const { error } = await svc.from('hub_accounts').insert({
    kind: 'player',
    email,
    password_hash: await hashPassword(password),
    name: (player as { name: string }).name,
    phone,
    player_id: playerId,
    answers,
    conduct_signed_name: signedName,
    conduct_agreed_at: now,
    last_seen_at: now,
  })
  if (error) {
    console.error('[registerPlayerAccount]', error)
    return {
      ok: false,
      error: /hub_accounts/.test(error.message) ? 'Sign-ups aren’t switched on yet. Tell a coach.' : 'Something went wrong. Try again.',
    }
  }

  // His own email and phone onto the coaches' contact card, if it has none yet.
  const card = await getContact(playerId).catch(() => null)
  const fill: Record<string, string> = {}
  if (!card?.player_email) fill.player_email = email
  if (phone && !card?.player_phone) fill.player_phone = phone
  if (Object.keys(fill).length) await saveContact(playerId, fill, email).catch(() => null)

  await notifyCoaches({
    event: 'parent-join',
    subject: `${(player as { name: string }).name} joined the Team Hub`,
    html: emailShell(
      'New Team Hub account',
      row('Player', (player as { name: string }).name) +
        row('Email', email) +
        row('Code of conduct', `Signed “${signedName}”`) +
        row('#1 goal', String(answers.goal_season ?? '')),
    ),
  }).catch(() => null)

  if (!(await signInPlayer(playerId))) return { ok: false, error: 'Your account is made — sign in to get in.' }
  redirect('/team')
}

// ── Parents ──────────────────────────────────────────────────────────────────

export interface ParentSignup {
  code: string
  name: string
  relationship: string
  email: string
  phone: string
  preferred: string
  password: string
  playerIds: string[]
  address: string
  guardian2: { name: string; email: string; phone: string; relationship: string }
  emergency: { name: string; phone: string; relation: string }
  answers: Record<string, unknown>
  company?: string
}

export async function registerParentAccount(input: ParentSignup): Promise<HubResult> {
  if (text(input.company)) return { ok: true }
  const code = await codeValid('parent', text(input.code, 100))
  if (!code.ok) return code

  const name = text(input.name, 120)
  const email = text(input.email).toLowerCase()
  const phone = text(input.phone, 40)
  const password = String(input.password ?? '')
  if (!name) return { ok: false, error: 'Enter your name.' }
  if (!EMAIL_RE.test(email)) return { ok: false, error: 'Enter a real email address.' }
  if (phone.replace(/\D/g, '').length < 10) return { ok: false, error: 'Enter a cell number.' }
  if (password.length < 8) return { ok: false, error: 'Your password needs at least 8 characters.' }

  const svc = createServiceClient()
  const wanted = (Array.isArray(input.playerIds) ? input.playerIds : []).map((id) => text(id, 64)).filter(Boolean)
  const { data: players } = wanted.length
    ? await svc.from('players').select('id, name').in('id', wanted)
    : { data: [] as { id: string; name: string }[] }
  const kids = (players ?? []) as { id: string; name: string }[]
  if (!kids.length) return { ok: false, error: 'Pick your player from the roster.' }
  if (await findAccount('parent', email)) {
    return { ok: false, error: 'There’s already an account with that email. Sign in instead.' }
  }

  const g2 = {
    name: text(input.guardian2?.name, 120),
    email: text(input.guardian2?.email).toLowerCase(),
    phone: text(input.guardian2?.phone, 40),
    relationship: text(input.guardian2?.relationship, 40),
  }
  const em = {
    name: text(input.emergency?.name, 120),
    phone: text(input.emergency?.phone, 40),
    relation: text(input.emergency?.relation, 40),
  }
  if (!em.name || em.phone.replace(/\D/g, '').length < 10) {
    return { ok: false, error: 'Add an emergency contact who isn’t you, with their phone.' }
  }
  const contacts: Record<string, string> = {
    relationship: text(input.relationship, 40),
    preferred: text(input.preferred, 20),
    address: text(input.address, 300),
    guardian2_name: g2.name,
    guardian2_email: g2.email,
    guardian2_phone: g2.phone,
    guardian2_relationship: g2.relationship,
    emergency_name: em.name,
    emergency_phone: em.phone,
    emergency_relation: em.relation,
  }
  const answers = cleanAnswers(input.answers, PARENT_QUESTIONS)

  // The Parent Hub row is what the rest of the hub already knows a parent by.
  const { parent, error: parentError } = await registerParent({
    name,
    email,
    phone,
    playerName: kids.map((k) => k.name).join(', '),
  })
  if (!parent) {
    console.error('[registerParentAccount]', parentError)
    return { ok: false, error: 'Something went wrong. Try again.' }
  }

  const now = new Date().toISOString()
  const { error } = await svc.from('hub_accounts').insert({
    kind: 'parent',
    email,
    password_hash: await hashPassword(password),
    name,
    phone,
    player_ids: kids.map((k) => k.id),
    parent_id: parent.id,
    contacts,
    answers,
    last_seen_at: now,
  })
  if (error) {
    console.error('[registerParentAccount]', error)
    return {
      ok: false,
      error: /hub_accounts/.test(error.message) ? 'Sign-ups aren’t switched on yet. Tell a coach.' : 'Something went wrong. Try again.',
    }
  }

  /* Onto each player's contact card, filling what is empty and never writing
     over what a coach already has. */
  for (const kid of kids) {
    const card = await getContact(kid.id).catch(() => null)
    const fill: Record<string, string> = {}
    const put = (k: string, v: string) => {
      if (v && !(card as Record<string, unknown> | null)?.[k]) fill[k] = v
    }
    if (!card?.guardian_name) {
      put('guardian_name', name)
      put('guardian_email', email)
      put('guardian_phone', phone)
    } else if (!card?.guardian2_name) {
      put('guardian2_name', name)
      put('guardian2_email', email)
      put('guardian2_phone', phone)
    }
    if (g2.name && !fill.guardian2_name && !card?.guardian2_name) {
      put('guardian2_name', g2.name)
      put('guardian2_email', g2.email)
      put('guardian2_phone', g2.phone)
    }
    put('emergency_name', em.name)
    put('emergency_phone', em.phone)
    put('emergency_relation', em.relation)
    if (Object.keys(fill).length) await saveContact(kid.id, fill, email).catch(() => null)
  }

  await notifyCoaches({
    event: 'parent-join',
    subject: `New parent in the Parent Hub: ${name}`,
    replyTo: email,
    html: emailShell(
      'New Parent Hub account',
      row('Parent', name) + row('Email', email) + row('Phone', phone) + row('Player', kids.map((k) => k.name).join(', ')),
    ),
  }).catch(() => null)

  if (!(await signInParent(parent.id))) return { ok: false, error: 'Your account is made — sign in to get in.' }
  redirect('/parents')
}

// ── Signing back in and out ──────────────────────────────────────────────────

export async function signInHub(kind: HubKind, email: string, password: string): Promise<HubResult> {
  const account = await findAccount(kind, String(email ?? ''))
  if (!account || !(await checkPassword(String(password ?? ''), account.passwordHash))) {
    return { ok: false, error: 'That email and password don’t match.' }
  }
  await createServiceClient().from('hub_accounts').update({ last_seen_at: new Date().toISOString() }).eq('id', account.id)
  if (kind === 'player') {
    if (!account.playerId || !(await signInPlayer(account.playerId))) {
      return { ok: false, error: 'Your account isn’t linked to the roster any more. Ask a coach.' }
    }
    redirect('/team')
  }
  if (!account.parentId || !(await signInParent(account.parentId))) {
    return { ok: false, error: 'Something went wrong. Ask a coach.' }
  }
  redirect('/parents')
}

export async function signOutParent() {
  ;(await cookies()).delete(PARENT_COOKIE)
  redirect('/parents/welcome')
}

// ── The owner's settings ─────────────────────────────────────────────────────

export async function setParentCode(formData: FormData) {
  await requireOwner()
  const code = String(formData.get('parent_code') ?? '').trim()
  if (code.length < 4) return
  await createServiceClient()
    .from('app_settings')
    .upsert(
      [
        { key: 'parent_code_hash', value: await hashTeamPassword(`parent:${code}`) },
        { key: 'parent_code_enc', value: await encryptTeamCode(code) },
      ],
      { onConflict: 'key' },
    )
  revalidatePath('/admin/signin')
}

export async function setHubRegistration(formData: FormData) {
  await requireOwner()
  const current = await readHubRegistration()
  const url = (k: string) => {
    const v = String(formData.get(k) ?? '').trim()
    return v && !/^https?:\/\//i.test(v) ? `https://${v}` : v
  }
  await writeHubRegistration({
    parentCodeOn: formData.has('parentCodeOn') ? formData.get('parentCodeOn') === 'true' : current.parentCodeOn,
    conductUrl: formData.has('conductUrl') ? url('conductUrl') : current.conductUrl,
    ackUrl: formData.has('ackUrl') ? url('ackUrl') || current.ackUrl : current.ackUrl,
  })
  revalidatePath('/admin/signin')
}
