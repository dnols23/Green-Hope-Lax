'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient, createServiceClient } from './supabase-server'
import { sendEmail, postEmailHtml, emailShell, row } from './email'
import { notifyCoaches, notifyStatus, writeNotifySettings } from './notify'
import { NOTIFY_EVENTS, parseRecipients } from './notifyEvents'
import {
  EXPERIENCE_LABELS,
  type ExperienceLevel,
  type PlayerCollection,
  type InterestSubmission,
} from './types'
import { TEAM_COOKIE, hashTeamPassword, teamCookieToken } from './teamAuth'
import { encryptTeamCode } from './teamCode'
import { requireOwner, getViewer, requireTeamScope, requireSection, canTeam } from './permissions'
import { isStaffRole, isStaffTeam, type StaffRole, type StaffTeam, type Viewer } from './sections'
import { readSides } from './compete'
import { getPlan } from './plans'
import { readStaff, writeStaff, deleteStaff } from './staff'
import { parseRosterPaste, playersOnNoRoster } from './rosters'
import { normalizeAudience } from './schedule'
import { readBlocks, readStart, type PlanKind } from './planner'
import { gamePlanStarter, readGamePlan } from './gamePlan'
import { readNoteBlocks } from './noteBlocks'
import { HUB_MODES_KEY, HUB_MODE_KEYS } from './hubModes'
import {
  SIGNUPS,
  SIGNUP_KEYS,
  SIGNUP_STATUS_KEY,
  SIGNUP_STATUS_META,
  parseSignupStatus,
} from './signups'
import { parseDrillPaste } from './drills'
import { listDrills } from './drillsData'
import { signOut, markReturned, markOutAgain, deleteAssignment } from './equipment'
import { savePlay, deletePlay, clearPlayClip } from './plays'
import { saveShot, renameShot, deleteShot } from './library'
import { readTeam, withTeam } from './teams'
import {
  addList as addPriorityList,
  listTeamOf as priorityListTeam,
  itemTeamOf as priorityItemTeam,
  renameList as renamePriorityList,
  deleteList as deletePriorityList,
  addItem as addPriorityItem,
  setItem as setPriorityItem,
  reorderItems as reorderPriorityItems,
  deleteItem as deletePriorityItem,
} from './priorities'
import { saveContact } from './playerContacts'
import { readSigninSettings } from './joinLinks'
import { buildDrillSet, positionGroup } from './prescribe'
import { ensurePlayerToken, revokePlayerToken } from './playerAccess'
import type { Evaluation } from './evaluations'
import { getCurrentCoach } from './coach'
import { EVAL_CATEGORIES } from './evaluations'

// ─── validation helpers ────────────────────────────────────────────────────────
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const str = (v: FormDataEntryValue | null) => (typeof v === 'string' ? v.trim() : '')
const numOrNull = (v: FormDataEntryValue | null) =>
  v != null && v !== '' ? Number(v) : null

export type FormState = { ok: boolean; error?: string; message?: string }

// ═══ AUTH ═══════════════════════════════════════════════════════════════════════

// Coaches sign in with a username (e.g. "HCNolan"); we map it to a synthetic
// email behind the scenes. A real email (with "@") is also accepted.
// (Local, non-exported — a 'use server' file may only export async functions.)
const COACH_EMAIL_DOMAIN = 'ghfalcons.local'
function coachEmail(idRaw: string): string {
  const id = idRaw.trim()
  return id.includes('@') ? id.toLowerCase() : `${id.toLowerCase()}@${COACH_EMAIL_DOMAIN}`
}

export async function login(formData: FormData) {
  const supabase = await createClient()
  const idRaw = str(formData.get('username')) || str(formData.get('email'))
  const { error } = await supabase.auth.signInWithPassword({
    email: coachEmail(idRaw),
    password: str(formData.get('password')),
  })
  if (error) return { error: 'Incorrect username or password.' }
  redirect('/admin')
}

export async function logout() {
  // Send people back through the door they came in by.
  const viewer = await getViewer()
  const door = viewer?.isOwner ? '/admin/login' : '/staff'
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect(door)
}

// First-login forced reset: a coach with a `must_reset:<uid>` flag in app_settings
// is sent here by the admin layout until they choose their own password.
export async function resetCoachPassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const pw = str(formData.get('password'))
  const confirm = str(formData.get('confirm'))
  if (pw.length < 8) return { ok: false, error: 'Password must be at least 8 characters.' }
  if (pw !== confirm) return { ok: false, error: 'Passwords do not match.' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Your session expired — please sign in again.' }

  const { error } = await supabase.auth.updateUser({ password: pw })
  if (error) return { ok: false, error: error.message }

  const svc = createServiceClient()
  await svc.from('app_settings').delete().eq('key', `must_reset:${user.id}`)
  redirect('/admin')
}

// ═══ TEAM HUB ACCESS (shared password for parents/players) ═══════════════════════

// Registration = join the Team Hub. Collects parent/player contact info (for
// current + future contact / fundraising), checks the shared team password, then
// grants access. Re-registering with the same email updates the existing record.
export async function registerTeamMember(_prev: FormState, formData: FormData): Promise<FormState> {
  if (str(formData.get('company'))) return { ok: true } // honeypot

  const data = {
    parent_name: str(formData.get('parent_name')),
    parent_email: str(formData.get('parent_email')).toLowerCase(),
    parent_phone: str(formData.get('parent_phone')),
    player_name: str(formData.get('player_name')),
    player_grad_year: str(formData.get('player_grad_year')) || null,
    player_team: str(formData.get('player_team')) || null,
    email_opt_in: str(formData.get('email_opt_in')) === 'on' || str(formData.get('email_opt_in')) === 'true',
    updated_at: new Date().toISOString(),
  }
  const pw = str(formData.get('password'))

  if (!data.parent_name) return { ok: false, error: 'Please enter a parent/guardian name.' }
  if (!EMAIL_RE.test(data.parent_email)) return { ok: false, error: 'Please enter a valid email address.' }
  if (data.parent_phone.replace(/\D/g, '').length < 10) return { ok: false, error: 'Please enter a valid phone number.' }
  if (!data.player_name) return { ok: false, error: 'Please enter the player name(s).' }

  // The password is a door like any other, and it can be shut. When it is, the
  // links are the way in and the form says so rather than failing as "wrong".
  const { codeOn } = await readSigninSettings()
  if (!codeOn) {
    return {
      ok: false,
      error: 'The team password is switched off. Ask a coach for your sign-in link.',
    }
  }

  const supabase = createServiceClient()
  const { data: setting } = await supabase
    .from('app_settings').select('value').eq('key', 'team_password_hash').maybeSingle()
  const hash = await hashTeamPassword(pw)
  if (!setting?.value || hash !== setting.value) return { ok: false, error: 'Incorrect team password — ask a coach.' }

  const { error } = await supabase
    .from('team_members')
    .upsert(data, { onConflict: 'parent_email' })
  if (error) {
    console.error('[registerTeamMember]', error)
    return { ok: false, error: 'Something went wrong saving your info. Please try again.' }
  }

  const jar = await cookies()
  jar.set(TEAM_COOKIE, await teamCookieToken(), {
    httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 60, // 60 days
  })
  redirect('/team')
}

export async function teamLogout() {
  const jar = await cookies()
  jar.delete(TEAM_COOKIE)
  redirect('/team/login')
}

// Admin-only (reachable only from the auth-protected /admin area).
export async function setTeamPassword(formData: FormData) {
  const pw = str(formData.get('team_password'))
  if (pw.length < 4) return
  const supabase = createServiceClient()
  // The hash stays the source of truth for sign-in. The second row is the same
  // code encrypted (see lib/teamCode), so a coach can read it back when writing
  // join instructions for families — never stored in the clear.
  await supabase.from('app_settings').upsert(
    [
      { key: 'team_password_hash', value: await hashTeamPassword(pw) },
      { key: 'team_code_enc', value: await encryptTeamCode(pw) },
    ],
    { onConflict: 'key' }
  )
  revalidatePath('/admin/team')
}

// ── team posts (admin CRUD; team_posts is service-role only) ──
export async function upsertTeamPost(formData: FormData) {
  const supabase = createServiceClient()
  const id = str(formData.get('id'))
  const payload = {
    title: str(formData.get('title')),
    body: str(formData.get('body')),
    category: str(formData.get('category')) || 'announcement',
    pinned: str(formData.get('pinned')) === 'true',
    event_date: str(formData.get('event_date')) || null,
    attachments: str(formData.get('attachments')) || null,
    author: str(formData.get('author')) || 'Coach',
    published: str(formData.get('published')) !== 'false',
    updated_at: new Date().toISOString(),
  }
  if (id) {
    await supabase.from('team_posts').update(payload).eq('id', id)
  } else {
    await supabase.from('team_posts').insert(payload)
    // Email opted-in members about brand-new published posts (no-op if Resend
    // isn't configured yet). Edits don't re-notify.
    if (payload.published) {
      const { data: members } = await supabase
        .from('team_members').select('parent_email').eq('email_opt_in', true)
      const bcc = (members ?? []).map((m: { parent_email: string }) => m.parent_email)
      if (bcc.length) {
        await sendEmail({
          bcc,
          subject: `Falcons Team Hub: ${payload.title}`,
          html: postEmailHtml(payload.title, payload.body),
        })
      }
    }
  }
  revalidatePath('/team')
  revalidatePath('/admin/team')
}

export async function deleteTeamPost(id: string) {
  const supabase = createServiceClient()
  await supabase.from('team_posts').delete().eq('id', id)
  revalidatePath('/team')
  revalidatePath('/admin/team')
}

// ═══ PUBLIC FORMS ════════════════════════════════════════════════════════════════

// Interest form — used by /join. Validates, writes via the service client (so it
// works regardless of RLS edge cases), then emails the coach.
export async function submitInterest(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  // Which team: the Green Machine (middle school) vs the default high school program.
  const isMiddle = str(formData.get('level')) === 'middle'
  const teamLabel = isMiddle ? 'Green Machine (middle school)' : 'High School Team'
  const rawNotes = str(formData.get('notes'))

  const data = {
    player_first: str(formData.get('player_first')),
    player_last: str(formData.get('player_last')),
    grad_year: str(formData.get('grad_year')) || null,
    parent_name: str(formData.get('parent_name')),
    parent_email: str(formData.get('parent_email')),
    parent_phone: str(formData.get('parent_phone')),
    player_email: str(formData.get('player_email')) || null,
    experience: (str(formData.get('experience')) || 'new') as ExperienceLevel,
    program: str(formData.get('program')) === 'girls' ? 'girls' : 'boys',
    form_type: isMiddle ? 'green_machine' : 'high_school',
    notes: rawNotes || null,
  }

  // Honeypot — bots fill hidden fields; humans don't.
  if (str(formData.get('company'))) return { ok: true }

  if (!data.player_first || !data.player_last)
    return { ok: false, error: 'Please enter the player’s first and last name.' }
  if (!data.parent_name)
    return { ok: false, error: 'Please enter a parent/guardian name.' }
  if (!EMAIL_RE.test(data.parent_email))
    return { ok: false, error: 'Please enter a valid parent email address.' }
  if (data.parent_phone.replace(/\D/g, '').length < 10)
    return { ok: false, error: 'Please enter a valid phone number.' }
  if (data.player_email && !EMAIL_RE.test(data.player_email))
    return { ok: false, error: 'Player email looks invalid — leave it blank or fix it.' }

  const supabase = createServiceClient()
  const { error } = await supabase.from('interest_form_submissions').insert(data)
  if (error) {
    console.error('[submitInterest]', error)
    return { ok: false, error: 'Something went wrong saving your form. Please try again.' }
  }

  await notifyCoaches({
    event: 'interest',
    subject: `New ${isMiddle ? 'GREEN MACHINE ' : ''}lacrosse interest: ${data.player_first} ${data.player_last}`,
    replyTo: data.parent_email,
    html: emailShell(
      'New Player Interest Submission',
      row('Team', teamLabel) +
        row('Player', `${data.player_first} ${data.player_last}`) +
        row('Grad year', data.grad_year) +
        row('Experience', EXPERIENCE_LABELS[data.experience]) +
        row('Parent/Guardian', data.parent_name) +
        row('Parent email', data.parent_email) +
        row('Parent phone', data.parent_phone) +
        row('Player email', data.player_email) +
        row('Notes', rawNotes || null)
    ),
  })

  revalidatePath('/admin/submissions')
  return { ok: true }
}

// General contact form — used by /contact.
export async function submitContact(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const data = {
    name: str(formData.get('name')),
    email: str(formData.get('email')),
    message: str(formData.get('message')),
  }

  if (str(formData.get('company'))) return { ok: true } // honeypot
  if (!data.name) return { ok: false, error: 'Please enter your name.' }
  if (!EMAIL_RE.test(data.email)) return { ok: false, error: 'Please enter a valid email.' }
  if (data.message.length < 5) return { ok: false, error: 'Please enter a message.' }

  const supabase = createServiceClient()
  const { error } = await supabase.from('contact_submissions').insert(data)
  if (error) {
    console.error('[submitContact]', error)
    return { ok: false, error: 'Something went wrong. Please try again.' }
  }

  await notifyCoaches({
    event: 'contact',
    subject: `New contact message from ${data.name}`,
    replyTo: data.email,
    html: emailShell(
      'New Contact Message',
      row('From', data.name) + row('Email', data.email) + row('Message', data.message)
    ),
  })

  revalidatePath('/admin/submissions')
  return { ok: true }
}

// SWFL player signup — used by /swfl. Fall league is its own program with its
// own fee and roster, so signups get their own table rather than sharing the
// interest form's.
export async function submitSwfl(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const rawNotes = str(formData.get('notes'))
  const data = {
    player_first: str(formData.get('player_first')),
    player_last: str(formData.get('player_last')),
    grad_year: str(formData.get('grad_year')) || null,
    parent_name: str(formData.get('parent_name')),
    parent_email: str(formData.get('parent_email')),
    parent_phone: str(formData.get('parent_phone')),
    player_email: str(formData.get('player_email')) || null,
    experience: (str(formData.get('experience')) || 'new') as ExperienceLevel,
    notes: rawNotes || null,
  }

  if (str(formData.get('company'))) return { ok: true } // honeypot
  if (!data.player_first || !data.player_last)
    return { ok: false, error: 'Please enter the player\u2019s first and last name.' }
  if (!data.parent_name)
    return { ok: false, error: 'Please enter a parent/guardian name.' }
  if (!EMAIL_RE.test(data.parent_email))
    return { ok: false, error: 'Please enter a valid parent email address.' }
  if (data.parent_phone.replace(/\D/g, '').length < 10)
    return { ok: false, error: 'Please enter a valid phone number.' }
  if (data.player_email && !EMAIL_RE.test(data.player_email))
    return { ok: false, error: 'Player email looks invalid \u2014 leave it blank or fix it.' }

  const supabase = createServiceClient()
  const { error } = await supabase.from('swfl_signups').insert(data)
  if (error) {
    console.error('[submitSwfl]', error)
    return { ok: false, error: 'Something went wrong saving your signup. Please try again.' }
  }

  await notifyCoaches({
    event: 'swfl',
    subject: `New SWFL fall league signup: ${data.player_first} ${data.player_last}`,
    replyTo: data.parent_email,
    html: emailShell(
      'New SWFL Fall League Signup',
      row('Player', `${data.player_first} ${data.player_last}`) +
        row('Grad year', data.grad_year) +
        row('Experience', EXPERIENCE_LABELS[data.experience]) +
        row('Parent/Guardian', data.parent_name) +
        row('Parent email', data.parent_email) +
        row('Parent phone', data.parent_phone) +
        row('Player email', data.player_email) +
        row('Notes', rawNotes || null)
    ),
  })

  revalidatePath('/admin/submissions')
  return { ok: true }
}

// One-day event signup (playdays, clinics) — used by /barton-playday. Which
// event it is rides on the form, checked against the list rather than trusted.
export async function submitEventSignup(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const event = str(formData.get('event'))
  if (!SIGNUP_KEYS.includes(event)) {
    return { ok: false, error: 'That signup form is no longer available.' }
  }

  const rawNotes = str(formData.get('notes'))
  const data = {
    event,
    player_first: str(formData.get('player_first')),
    player_last: str(formData.get('player_last')),
    grad_year: str(formData.get('grad_year')) || null,
    position: str(formData.get('position')) || null,
    parent_name: str(formData.get('parent_name')),
    parent_email: str(formData.get('parent_email')),
    parent_phone: str(formData.get('parent_phone')),
    player_email: str(formData.get('player_email')) || null,
    notes: rawNotes || null,
  }

  if (str(formData.get('company'))) return { ok: true } // honeypot
  if (!data.player_first || !data.player_last)
    return { ok: false, error: 'Please enter the player\u2019s first and last name.' }
  if (!data.parent_name)
    return { ok: false, error: 'Please enter a parent/guardian name.' }
  if (!EMAIL_RE.test(data.parent_email))
    return { ok: false, error: 'Please enter a valid parent email address.' }
  if (data.parent_phone.replace(/\D/g, '').length < 10)
    return { ok: false, error: 'Please enter a valid phone number.' }
  if (data.player_email && !EMAIL_RE.test(data.player_email))
    return { ok: false, error: 'Player email looks invalid \u2014 leave it blank or fix it.' }

  const supabase = createServiceClient()
  const { error } = await supabase.from('event_signups').insert(data)
  if (error) {
    console.error('[submitEventSignup]', error)
    return { ok: false, error: 'Something went wrong saving your signup. Please try again.' }
  }

  const label = SIGNUPS.find((s) => s.key === event)?.label ?? event
  await notifyCoaches({
    event: 'event-signup',
    subject: `New ${label} signup: ${data.player_first} ${data.player_last}`,
    replyTo: data.parent_email,
    html: emailShell(
      `New ${label} Signup`,
      row('Player', `${data.player_first} ${data.player_last}`) +
        row('Grad year', data.grad_year) +
        row('Position', data.position) +
        row('Parent/Guardian', data.parent_name) +
        row('Parent email', data.parent_email) +
        row('Parent phone', data.parent_phone) +
        row('Player email', data.player_email) +
        row('Notes', rawNotes || null)
    ),
  })

  revalidatePath('/admin/submissions')
  return { ok: true }
}

export async function deleteEventSignup(id: string) {
  const supabase = createServiceClient()
  await supabase.from('event_signups').delete().eq('id', id)
  revalidatePath('/admin/submissions')
}

/**
 * Open, close, or mark a signup underway. Coach only.
 *
 * Stored as one settings row rather than a column per page, so next season's
 * playday needs a page and a list entry, not a migration.
 */
export async function setSignupStatus(formData: FormData) {
  await requireSection('submissions')
  const key = str(formData.get('key'))
  const status = str(formData.get('status'))
  if (!SIGNUP_KEYS.includes(key) || !(status in SIGNUP_STATUS_META)) return

  const supabase = createServiceClient()
  const { data } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', SIGNUP_STATUS_KEY)
    .maybeSingle()
  const next = { ...parseSignupStatus(data?.value as string | undefined), [key]: status }
  await supabase
    .from('app_settings')
    .upsert({ key: SIGNUP_STATUS_KEY, value: JSON.stringify(next) }, { onConflict: 'key' })

  // Every surface that shows the badge: the page itself, the home callout, and
  // the screen the coach just clicked on.
  const href = SIGNUPS.find((s) => s.key === key)?.href
  if (href) revalidatePath(href)
  revalidatePath('/')
  revalidatePath('/admin/submissions')
}

// Admin: delete a single submission (spam cleanup). Service client so RLS
// can't block the cleanup.
export async function deleteInterestSubmission(id: string) {
  const supabase = createServiceClient()
  await supabase.from('interest_form_submissions').delete().eq('id', id)
  revalidatePath('/admin/submissions')
}

export async function deleteContactSubmission(id: string) {
  const supabase = createServiceClient()
  await supabase.from('contact_submissions').delete().eq('id', id)
  revalidatePath('/admin/submissions')
}

export async function deleteSwflSignup(id: string) {
  const supabase = createServiceClient()
  await supabase.from('swfl_signups').delete().eq('id', id)
  revalidatePath('/admin/submissions')
}

// Admin: sweep in rows submitted while an older build was live, which recorded
// the form name as a "[…]" tag on the notes instead of setting form_type. Files
// each one by its tag and strips it. Same work migration 0010 does, exposed as a
// button so stragglers never need SQL. Safe to run any time — rows with no tag
// aren't touched.
export async function sweepLegacySubmissions() {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('interest_form_submissions')
    .select('*')
    .like('notes', '[%]%')
  const rows = (data ?? []) as InterestSubmission[]

  for (const r of rows) {
    const tag = r.notes ?? ''
    const notes = tag.replace(/^\[[^\]]*\]\s*/, '').trim() || null

    if (tag.startsWith('[SWFL Fall League]')) {
      const { error } = await supabase.from('swfl_signups').insert({
        player_first: r.player_first,
        player_last: r.player_last,
        grad_year: r.grad_year,
        parent_name: r.parent_name,
        parent_email: r.parent_email,
        parent_phone: r.parent_phone,
        player_email: r.player_email,
        experience: r.experience,
        notes,
        created_at: r.created_at,
      })
      if (error) {
        console.error('[sweepLegacySubmissions]', error)
        continue
      }
      await supabase.from('interest_form_submissions').delete().eq('id', r.id)
      continue
    }

    const form_type = tag.startsWith('[Green Machine') ? 'green_machine' : r.form_type
    await supabase.from('interest_form_submissions').update({ form_type, notes }).eq('id', r.id)
  }

  revalidatePath('/admin/submissions')
}

// Admin: re-file a player submission into a different collection, for when a
// parent fills out the wrong form (e.g. uses /join to sign up for fall league).
// Between the two interest types it's just a column flip; moving in or out of
// fall league copies the row across tables, keeping its original submitted date.
export async function moveSubmission(
  id: string,
  from: PlayerCollection,
  to: PlayerCollection
) {
  if (from === to) return
  const supabase = createServiceClient()

  if (from !== 'swfl' && to !== 'swfl') {
    await supabase.from('interest_form_submissions').update({ form_type: to }).eq('id', id)
    revalidatePath('/admin/submissions')
    return
  }

  const fromTable = from === 'swfl' ? 'swfl_signups' : 'interest_form_submissions'
  const toTable = to === 'swfl' ? 'swfl_signups' : 'interest_form_submissions'

  const { data: found } = await supabase.from(fromTable).select('*').eq('id', id).maybeSingle()
  if (!found) return
  const r = found as Record<string, unknown>

  const shared = {
    player_first: r.player_first,
    player_last: r.player_last,
    grad_year: r.grad_year,
    parent_name: r.parent_name,
    parent_email: r.parent_email,
    parent_phone: r.parent_phone,
    player_email: r.player_email,
    experience: r.experience,
    notes: r.notes,
    created_at: r.created_at,
  }
  // swfl_signups has no program column (fall league is boys), so a row that
  // round-trips through it comes back as boys.
  const payload =
    to === 'swfl' ? shared : { ...shared, program: r.program ?? 'boys', form_type: to }

  const { error } = await supabase.from(toTable).insert(payload)
  if (error) {
    console.error('[moveSubmission]', error)
    return
  }
  await supabase.from(fromTable).delete().eq('id', id)
  revalidatePath('/admin/submissions')
}

// ═══ ADMIN CRUD ══════════════════════════════════════════════════════════════════
// All of these run as the logged-in admin (anon client + their auth cookie), so
// RLS "admin all" policies authorize the writes.

// ── one-click live/hidden toggle (shared by every content admin page) ──
// Maps each toggleable content type to its table, visibility column, and the
// pages to revalidate. Whitelisted so the client can only ever flip these flags.
const VISIBILITY = {
  stat:     { table: 'program_stats', column: 'is_published', paths: ['/record-books', '/admin/record-books'] },
  news:     { table: 'news_posts',    column: 'published',    paths: ['/news', '/admin/news'] },
  award:    { table: 'team_awards',   column: 'is_published', paths: ['/awards', '/admin/awards'] },
  coach:    { table: 'coaches',       column: 'is_published', paths: ['/coaches', '/admin/coaches'] },
  player:   { table: 'players',       column: 'is_active',    paths: ['/roster', '/admin/roster'] },
  product:  { table: 'products',       column: 'is_published', paths: ['/shop', '/admin/shop'] },
  teampost: { table: 'team_posts',    column: 'published',    paths: ['/team', '/admin/team'], service: true },
  // Not a visibility flag at all — the same one-click switch, pointed at
  // "has this player paid", which is the other thing a coach flips in a list.
  eventpaid: { table: 'event_signups', column: 'paid',        paths: ['/admin/submissions'], service: true },
  // Whole-page on/off. Revalidates the site layout so the nav updates everywhere.
  page:     { table: 'page_settings', column: 'is_published', paths: ['/admin/pages'], layout: true },
} as const

export async function setVisibility(entity: keyof typeof VISIBILITY, id: string, next: boolean) {
  const cfg = VISIBILITY[entity]
  if (!cfg) return
  // team_posts is locked down (no anon policies) so it must be written service-side.
  const supabase = 'service' in cfg && cfg.service ? createServiceClient() : await createClient()
  await supabase.from(cfg.table).update({ [cfg.column]: next }).eq('id', id)
  cfg.paths.forEach((p) => revalidatePath(p))
  if ('layout' in cfg && cfg.layout) revalidatePath('/', 'layout')
}

// ── players ──
export async function upsertPlayer(formData: FormData) {
  // A JV-only coach may only touch JV players, whatever the form says.
  const { scope } = await requireTeamScope('roster', 'roster-jv')
  const supabase = await createClient()
  const id = str(formData.get('id'))

  if (scope === 'jv' && id) {
    const { data: existing } = await supabase.from('players').select('team').eq('id', id).maybeSingle()
    if (existing && (existing as { team: string }).team !== 'boys_jv') return
  }

  const payload = {
    team: scope === 'jv' ? 'boys_jv' : str(formData.get('team')) || 'boys_varsity',
    name: str(formData.get('name')),
    number: str(formData.get('number')) || null,
    position: str(formData.get('position')) || null,
    class_year: str(formData.get('class_year')) || null,
    height: str(formData.get('height')) || null,
    hometown: str(formData.get('hometown')) || null,
    bio: str(formData.get('bio')) || null,
    photo_url: str(formData.get('photo_url')) || null,
    sort_order: Number(formData.get('sort_order') ?? 0) || 0,
    is_active: str(formData.get('is_active')) !== 'false',
  }
  if (id) await supabase.from('players').update(payload).eq('id', id)
  else await supabase.from('players').insert(payload)
  revalidatePath('/roster')
  revalidatePath('/admin/roster')
}

export async function deletePlayer(id: string) {
  const { scope } = await requireTeamScope('roster', 'roster-jv')
  if (scope === 'jv') {
    const check = await createClient()
    const { data: existing } = await check.from('players').select('team').eq('id', id).maybeSingle()
    if (!existing || (existing as { team: string }).team !== 'boys_jv') return
  }

  const supabase = await createClient()
  await supabase.from('players').delete().eq('id', id)
  revalidatePath('/roster')
  revalidatePath('/admin/roster')
}

// ── games ──
export async function upsertGame(formData: FormData) {
  const viewer = await requireSection('schedule')
  // Which team's game, and whether this coach works on that team at all.
  const level = str(formData.get('level')) === 'jv' ? 'jv' : 'varsity'
  if (!canTeam(viewer, level)) return
  if (id0(formData)) {
    const { data: existing } = await createServiceClient()
      .from('games').select('level').eq('id', id0(formData)).maybeSingle()
    const was = (existing as { level?: string } | null)?.level
    // Editing somebody else's game, or dragging one across to your own side,
    // are the same refusal.
    if (was && !canTeam(viewer, was === 'jv' ? 'jv' : 'varsity')) return
  }

  const supabase = await createClient()
  const id = str(formData.get('id'))
  const payload = {
    gender: str(formData.get('gender')) === 'girls' ? 'girls' : 'boys',
    game_date: str(formData.get('game_date')),
    opponent: str(formData.get('opponent')),
    home_away: str(formData.get('home_away')) || 'home',
    location: str(formData.get('location')) || null,
    status: str(formData.get('status')) || 'scheduled',
    team_score: numOrNull(formData.get('team_score')),
    opp_score: numOrNull(formData.get('opp_score')),
    is_conference: str(formData.get('is_conference')) !== 'false',
    notes: str(formData.get('notes')) || null,
  }
  /* Audience (0016) and level (0035) are both newer columns. Write everything
     when it is all there, then shed one column at a time, so editing a game
     never breaks on a database that is a step or two behind the code. */
  const audience = normalizeAudience(str(formData.get('audience')))
  const attempts: Record<string, unknown>[] = [
    { ...payload, audience, level },
    { ...payload, audience },
    { ...payload, level },
    payload,
  ]

  const save = async (row: Record<string, unknown>) =>
    id
      ? await supabase.from('games').update(row).eq('id', id)
      : await supabase.from('games').insert(row)

  for (const row of attempts) {
    const { error } = await save(row)
    if (!error) break
  }
  revalidatePath('/schedule')
  revalidatePath('/team')
  revalidatePath('/admin/schedule')
}

/** The id on a game form, read before the rest of it. */
function id0(formData: FormData): string {
  return str(formData.get('id'))
}

export async function deleteGame(id: string) {
  const viewer = await requireSection('schedule')
  const { data: existing } = await createServiceClient()
    .from('games').select('level').eq('id', id).maybeSingle()
  const level = (existing as { level?: string } | null)?.level === 'jv' ? 'jv' : 'varsity'
  if (!canTeam(viewer, level)) return

  const supabase = await createClient()
  await supabase.from('games').delete().eq('id', id)
  revalidatePath('/schedule')
  revalidatePath('/admin/schedule')
}

// ── program stats (all-time records / leaders / milestones / honors) ──
export async function upsertProgramStat(formData: FormData) {
  const supabase = await createClient()
  const id = str(formData.get('id'))
  const payload = {
    section: str(formData.get('section')) || 'records',
    gender: str(formData.get('gender')) || null,
    label: str(formData.get('label')),
    value: str(formData.get('value')) || null,
    detail: str(formData.get('detail')) || null,
    season: str(formData.get('season')) || null,
    sort_order: Number(formData.get('sort_order') ?? 0) || 0,
    is_published: str(formData.get('is_published')) !== 'false',
  }
  if (id) await supabase.from('program_stats').update(payload).eq('id', id)
  else await supabase.from('program_stats').insert(payload)
  revalidatePath('/record-books')
  revalidatePath('/admin/record-books')
}

export async function deleteProgramStat(id: string) {
  const supabase = await createClient()
  await supabase.from('program_stats').delete().eq('id', id)
  revalidatePath('/record-books')
  revalidatePath('/admin/record-books')
}

// ── coaches ──
export async function upsertCoach(formData: FormData) {
  const supabase = await createClient()
  const id = str(formData.get('id'))
  const payload = {
    name: str(formData.get('name')),
    role: str(formData.get('role')) || 'Assistant Coach',
    program: str(formData.get('program')) || null,
    email: str(formData.get('email')) || null,
    phone: str(formData.get('phone')) || null,
    bio: str(formData.get('bio')) || null,
    photo_url: str(formData.get('photo_url')) || null,
    sort_order: Number(formData.get('sort_order') ?? 0) || 0,
  }
  if (id) await supabase.from('coaches').update(payload).eq('id', id)
  else await supabase.from('coaches').insert(payload)
  revalidatePath('/coaches')
  revalidatePath('/admin/coaches')
}

export async function deleteCoach(id: string) {
  const supabase = await createClient()
  await supabase.from('coaches').delete().eq('id', id)
  revalidatePath('/coaches')
  revalidatePath('/admin/coaches')
}

// ── awards ──
export async function upsertAward(formData: FormData) {
  const supabase = await createClient()
  const id = str(formData.get('id'))
  const payload = {
    season: str(formData.get('season')) || '2026',
    award: str(formData.get('award')),
    recipient: str(formData.get('recipient')),
    description: str(formData.get('description')) || null,
    sort_order: Number(formData.get('sort_order') ?? 0) || 0,
  }
  if (id) await supabase.from('team_awards').update(payload).eq('id', id)
  else await supabase.from('team_awards').insert(payload)
  revalidatePath('/awards')
  revalidatePath('/roster')
  revalidatePath('/admin/awards')
}

export async function deleteAward(id: string) {
  const supabase = await createClient()
  await supabase.from('team_awards').delete().eq('id', id)
  revalidatePath('/awards')
  revalidatePath('/roster')
  revalidatePath('/admin/awards')
}

// ── news ──
const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80)

export async function upsertNews(formData: FormData) {
  const supabase = await createClient()
  const id = str(formData.get('id'))
  const title = str(formData.get('title'))
  const payload = {
    title,
    slug: str(formData.get('slug')) || slugify(title) || `post-${Date.now()}`,
    body: str(formData.get('body')),
    image_url: str(formData.get('image_url')) || null,
    published: str(formData.get('published')) !== 'false',
    published_at: str(formData.get('published_at')) || new Date().toISOString(),
  }
  if (id) await supabase.from('news_posts').update(payload).eq('id', id)
  else await supabase.from('news_posts').insert(payload)
  revalidatePath('/news')
  revalidatePath('/admin/news')
}

export async function deleteNews(id: string) {
  const supabase = await createClient()
  await supabase.from('news_posts').delete().eq('id', id)
  revalidatePath('/news')
  revalidatePath('/admin/news')
}

// ── team store / products ──
export async function upsertProduct(formData: FormData) {
  const supabase = await createClient()
  const id = str(formData.get('id'))
  const payload = {
    name: str(formData.get('name')),
    description: str(formData.get('description')) || null,
    category: str(formData.get('category')) || 'Apparel',
    price: numOrNull(formData.get('price')),
    price_note: str(formData.get('price_note')) || null,
    sizes: str(formData.get('sizes')) || null,
    image_url: str(formData.get('image_url')) || null,
    buy_url: str(formData.get('buy_url')) || null,
    badge: str(formData.get('badge')) || null,
    sort_order: Number(formData.get('sort_order') ?? 0) || 0,
    is_published: str(formData.get('is_published')) !== 'false',
  }
  if (id) await supabase.from('products').update(payload).eq('id', id)
  else await supabase.from('products').insert(payload)
  revalidatePath('/shop')
  revalidatePath('/admin/shop')
}

export async function deleteProduct(id: string) {
  const supabase = await createClient()
  await supabase.from('products').delete().eq('id', id)
  revalidatePath('/shop')
  revalidatePath('/admin/shop')
}

// Store-wide settings (the "Shop the full store" link + page intro), kept in the
// service-role app_settings key/value store like the team password.
export async function saveShopSettings(formData: FormData) {
  const supabase = createServiceClient()
  const store_url = str(formData.get('store_url'))
  const intro = str(formData.get('intro'))
  await supabase.from('app_settings').upsert(
    [
      { key: 'shop_store_url', value: store_url },
      { key: 'shop_intro', value: intro },
    ],
    { onConflict: 'key' }
  )
  revalidatePath('/shop')
  revalidatePath('/admin/shop')
}

// ── Coaches Hub: player evaluations ──
// A signed-in coach submits/updates their OWN evaluation for a player. One eval
// per (player, coach, season); saved via the service client (evaluations are
// coach-only). The evaluator is taken from the session, never the form.
export async function upsertEvaluation(formData: FormData) {
  const coach = await getCurrentCoach()
  if (!coach) redirect('/admin/login')

  const playerId = str(formData.get('player_id'))
  if (!playerId) return
  const season = str(formData.get('season')) || '2026'

  // 0–100 slider score plus the optional note beside it. Both live in the
  // existing `ratings` jsonb, so per-skill notes needed no schema change.
  const ratings: Record<string, { score: number; note?: string }> = {}
  for (const c of EVAL_CATEGORIES) {
    const raw = formData.get(`cat_${c.key}`)
    if (raw == null) continue
    const score = Number(raw)
    if (!Number.isFinite(score) || score < 0 || score > 100) continue
    const note = str(formData.get(`note_${c.key}`))
    ratings[c.key] = note ? { score, note } : { score }
  }

  const payload = {
    player_id: playerId,
    evaluator_email: coach.email,
    evaluator_name: coach.name,
    season,
    position: str(formData.get('position')) || null,
    ratings,
    overall: numOrNull(formData.get('overall')),
    strengths: str(formData.get('strengths')) || null,
    areas_to_improve: str(formData.get('areas_to_improve')) || null,
    playing_time: str(formData.get('playing_time')) || null,
    notes: str(formData.get('notes')) || null,
    updated_at: new Date().toISOString(),
  }

  const supabase = createServiceClient()
  await supabase.from('evaluations').upsert(payload, { onConflict: 'player_id,evaluator_email,season' })

  revalidatePath('/admin/hub/mine')
  revalidatePath('/admin/hub/board')
  revalidatePath(`/admin/hub/evaluate/${playerId}`)
  redirect(`/admin/hub/evaluate/${playerId}?saved=1`)
}

// Delete an evaluation. A coach may delete their own; the head coach may delete any.
export async function deleteEvaluation(id: string) {
  const coach = await getCurrentCoach()
  if (!coach) return
  const supabase = createServiceClient()
  if (coach.role === 'head' || coach.role === 'jv-head') {
    await supabase.from('evaluations').delete().eq('id', id)
  } else {
    await supabase.from('evaluations').delete().eq('id', id).eq('evaluator_email', coach.email)
  }
  revalidatePath('/admin/hub/mine')
  revalidatePath('/admin/hub/board')
}

// ── Coach access: create logins and set what each coach may open (owner only) ──
// Staff records live in app_settings (see lib/staff), so switching coach
// sign-ins on needs no database migration.

// Readable temp password: no ambiguous characters, so it survives being read
// aloud or copied out of an email.
function tempPassword(): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(14))
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('')
}

export type CoachResult = FormState & {
  email?: string
  password?: string
  /** generated = we made one up; chosen = the owner typed it; linked = login already existed */
  outcome?: 'generated' | 'chosen' | 'linked'
}

// Finds the Supabase login behind a coach's username.
async function findAuthUser(email: string) {
  const svc = createServiceClient()
  const { data } = await svc.auth.admin.listUsers({ page: 1, perPage: 200 })
  return data?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase()) ?? null
}

// Creates the Supabase login AND the staff record, so the owner never has to open
// the Supabase dashboard. The owner may type the password; leaving it blank makes
// one up and forces the coach to replace it on first sign-in.
export async function createCoachAccount(
  _prev: FormState,
  formData: FormData
): Promise<CoachResult> {
  await requireOwner()

  const raw = str(formData.get('email')).toLowerCase().trim()
  if (!raw) return { ok: false, error: 'Enter a login username for the coach.' }
  // Bare usernames get the program's synthetic domain, matching existing logins.
  const email = raw.includes('@') ? raw : `${raw.replace(/\s+/g, '')}@ghfalcons.local`
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    return { ok: false, error: 'That login doesn\u2019t look valid.' }

  const display_name = str(formData.get('display_name')) || email.split('@')[0]
  const roleRaw = str(formData.get('role'))
  const role: StaffRole = isStaffRole(roleRaw) ? roleRaw : 'assistant'
  const permissions = formData.getAll('permissions').map(String).filter(Boolean)
  const rawTeam = str(formData.get('staff_team'))
  const team: StaffTeam = isStaffTeam(rawTeam) ? rawTeam : 'all'

  const typed = str(formData.get('password'))
  if (typed && typed.length < 8)
    return { ok: false, error: 'A password you choose needs to be at least 8 characters.' }
  const chosen = typed.length > 0
  const pw = chosen ? typed : tempPassword()

  const svc = createServiceClient()
  const { data: created, error } = await svc.auth.admin.createUser({
    email,
    password: pw,
    email_confirm: true,
  })

  // A login may already exist \u2014 coaches set up by hand before this page existed.
  // Record them so their access can be set; only touch the password if the owner
  // deliberately typed a new one.
  if (error && /already|registered|exists/i.test(error.message ?? '')) {
    await writeStaff({ email, name: display_name, role, isOwner: false, permissions, team })
    const existing = await findAuthUser(email)
    if (existing) {
      if (chosen) await svc.auth.admin.updateUserById(existing.id, { password: pw })
      // Whatever password they have, it's one you handed them — so they pick
      // their own the next time they sign in.
      await svc.from('app_settings').upsert(
        { key: `must_reset:${existing.id}`, value: '1' },
        { onConflict: 'key' }
      )
    }
    revalidatePath('/admin/access')
    return { ok: true, outcome: chosen ? 'chosen' : 'linked', email, password: chosen ? pw : undefined }
  }

  if (error || !created?.user) {
    return { ok: false, error: error?.message ?? 'Could not create that login.' }
  }

  await writeStaff({ email, name: display_name, role, isOwner: false, permissions, team })

  // The first password is one you handed them, so it's yours as much as theirs.
  // They're prompted to replace it with their own the first time they sign in.
  await svc.from('app_settings').upsert(
    { key: `must_reset:${created.user.id}`, value: '1' },
    { onConflict: 'key' }
  )

  revalidatePath('/admin/access')
  return { ok: true, outcome: chosen ? 'chosen' : 'generated', email, password: pw }
}

// Set a coach's password from the Coach Access page.
export async function setCoachPassword(formData: FormData) {
  await requireOwner()
  const email = str(formData.get('email')).toLowerCase()
  const pw = str(formData.get('password'))
  if (!email || pw.length < 8) return

  const user = await findAuthUser(email)
  if (!user) return

  const svc = createServiceClient()
  await svc.auth.admin.updateUserById(user.id, { password: pw })
  // You know this password, so it's a hand-over, not their own: they're prompted
  // to choose a new one next time they sign in.
  await svc.from('app_settings').upsert(
    { key: `must_reset:${user.id}`, value: '1' },
    { onConflict: 'key' }
  )
  revalidatePath('/admin/access')
}

// Tick/untick which sections a coach may open.
export async function setCoachAccess(formData: FormData) {
  await requireOwner()
  const email = str(formData.get('email')).toLowerCase()
  if (!email) return
  const existing = await readStaff(email)
  if (!existing) return

  await writeStaff({
    ...existing,
    role: isStaffRole(str(formData.get('role'))) ? (str(formData.get('role')) as StaffRole) : 'assistant',
    permissions: formData.getAll('permissions').map(String).filter(Boolean),
    team: isStaffTeam(str(formData.get('staff_team'))) ? (str(formData.get('staff_team')) as StaffTeam) : 'all',
  })
  revalidatePath('/admin/access')
}

// Claim ownership, so the first-run stand-in ends and everyone else is a coach.
export async function claimOwnership() {
  const me = await requireOwner()
  const existing = await readStaff(me.email)
  await writeStaff({
    email: me.email,
    name: existing?.name ?? me.name,
    role: existing?.role ?? 'head',
    isOwner: true,
    permissions: existing?.permissions ?? [],
    team: 'all',
  })
  revalidatePath('/admin/access')
}

// Removes the staff record and the Supabase login behind it.
export async function removeCoachAccount(formData: FormData) {
  const me = await requireOwner()
  const email = str(formData.get('email')).toLowerCase()
  if (!email || email === me.email) return // never remove yourself

  await deleteStaff(email)

  const svc = createServiceClient()
  const { data: list } = await svc.auth.admin.listUsers()
  const match = list?.users?.find((u) => u.email?.toLowerCase() === email)
  if (match) await svc.auth.admin.deleteUser(match.id)

  revalidatePath('/admin/access')
}


// ── A player's own details ───────────────────────────────────────────────────

/** The roster half: what the public roster page shows. */
export async function savePlayerBasics(formData: FormData) {
  const viewer = await requireSection('hub')
  const id = str(formData.get('id'))
  if (!id) return

  await createServiceClient()
    .from('players')
    .update({
      number: str(formData.get('number')) || null,
      position: str(formData.get('position')) || null,
      class_year: str(formData.get('class_year')) || null,
      height: str(formData.get('height')) || null,
      hometown: str(formData.get('hometown')) || null,
      photo_url: str(formData.get('photo_url')) || null,
    })
    .eq('id', id)

  void viewer
  revalidatePath(`/admin/hub/players/${id}`)
  revalidatePath('/admin/hub/players')
  revalidatePath('/roster')
}

/** The private half: never on the players table, never on the public site. */
export async function savePlayerContact(formData: FormData) {
  const viewer = await requireSection('hub')
  const id = str(formData.get('id'))
  if (!id) return

  await saveContact(
    id,
    {
      player_email: str(formData.get('player_email')) || null,
      player_phone: str(formData.get('player_phone')) || null,
      guardian_name: str(formData.get('guardian_name')) || null,
      guardian_email: str(formData.get('guardian_email')) || null,
      guardian_phone: str(formData.get('guardian_phone')) || null,
      guardian2_name: str(formData.get('guardian2_name')) || null,
      guardian2_email: str(formData.get('guardian2_email')) || null,
      guardian2_phone: str(formData.get('guardian2_phone')) || null,
      emergency_name: str(formData.get('emergency_name')) || null,
      emergency_phone: str(formData.get('emergency_phone')) || null,
      emergency_relation: str(formData.get('emergency_relation')) || null,
      preferred: str(formData.get('preferred')) || null,
      notes: str(formData.get('notes')) || null,
    },
    viewer.name || viewer.email
  )

  revalidatePath(`/admin/hub/players/${id}`)
}

// ── Saved plays ──────────────────────────────────────────────────────────────

export async function savePlayAction(formData: FormData) {
  const viewer = await requireSection('playboard')
  const name = str(formData.get('name'))
  if (!name) return
  let board: unknown = {}
  try {
    board = JSON.parse(str(formData.get('board')) || '{}')
  } catch {
    return
  }
  // The take, if the coach recorded himself drawing it. A play saved without
  // one is just a still, which is most of them.
  let clip: unknown = null
  try {
    const raw = str(formData.get('clip'))
    clip = raw ? JSON.parse(raw) : null
  } catch {
    clip = null
  }
  await savePlay(name, board, viewer.name || viewer.email, clip, viewer.email)
  revalidatePath('/admin/playboard')
  revalidatePath('/admin/library')
}

export async function deletePlayAction(formData: FormData) {
  await requireSection('playboard')
  const id = str(formData.get('id'))
  if (id) await deletePlay(id)
  revalidatePath('/admin/playboard')
  revalidatePath('/admin/library')
}

// ── The Library ──────────────────────────────────────────────────────────────
// Screenshots taken off the board. The picture itself is already in the media
// bucket by the time this runs — the browser uploaded it through /api/upload —
// so all this keeps is what it is called and where it lives.

export async function saveShotAction(formData: FormData) {
  const viewer = await requireSection('library')
  const url = str(formData.get('url'))
  if (!url) return
  const title = str(formData.get('title')) || 'Board screenshot'
  await saveShot(title, url, viewer.name || viewer.email, viewer.email)
  revalidatePath('/admin/library')
}

export async function renameShotAction(formData: FormData) {
  await requireSection('library')
  const id = str(formData.get('id'))
  const title = str(formData.get('title'))
  if (id) await renameShot(id, title)
  revalidatePath('/admin/library')
}

/** Everything that was ticked, in one go. */
export async function deleteLibraryAction(formData: FormData) {
  await requireSection('library')
  const shots = str(formData.get('shots')).split(',').filter(Boolean)
  const plays = str(formData.get('plays')).split(',').filter(Boolean)
  for (const id of shots) await deleteShot(id)
  for (const id of plays) await deletePlay(id)
  revalidatePath('/admin/library')
  revalidatePath('/admin/playboard')
}

export async function deleteShotAction(formData: FormData) {
  await requireSection('library')
  const id = str(formData.get('id'))
  if (id) await deleteShot(id)
  revalidatePath('/admin/library')
}

/** Keep the play, throw away the take. */
export async function clearPlayClipAction(formData: FormData) {
  await requireSection('playboard')
  const id = str(formData.get('id'))
  if (id) await clearPlayClip(id)
  revalidatePath('/admin/playboard')
  revalidatePath('/admin/library')
}

// ── Priorities ───────────────────────────────────────────────────────────────
// What the staff noticed on the sideline, kept where practice planning starts.

/* The team behind a list or an item, checked against the coach reaching for it.
   A list nobody can find is still a list somebody can post to. */
async function mayTouchList(viewer: Viewer | null, listId: string): Promise<boolean> {
  const team = await priorityListTeam(listId)
  return team === null ? true : canTeam(viewer, team)
}

async function mayTouchItem(viewer: Viewer | null, itemId: string): Promise<boolean> {
  const team = await priorityItemTeam(itemId)
  return team === null ? true : canTeam(viewer, team)
}

export async function addPriorityListAction(formData: FormData) {
  const viewer = await requireSection('priorities')
  const name = str(formData.get('name'))
  const team = readTeam(formData.get('team'))
  if (!name || !canTeam(viewer, team)) return
  await addPriorityList(name, viewer.name || viewer.email, team)
  revalidatePath('/admin/priorities')
}

export async function renamePriorityListAction(formData: FormData) {
  const viewer = await requireSection('priorities')
  const id = str(formData.get('id'))
  const name = str(formData.get('name'))
  if (!id || !name || !(await mayTouchList(viewer, id))) return
  await renamePriorityList(id, name)
  revalidatePath('/admin/priorities')
}

export async function deletePriorityListAction(formData: FormData) {
  const viewer = await requireSection('priorities')
  const id = str(formData.get('id'))
  if (!id || !(await mayTouchList(viewer, id))) return
  await deletePriorityList(id)
  revalidatePath('/admin/priorities')
}

export async function addPriorityAction(formData: FormData) {
  const viewer = await requireSection('priorities')
  const listId = str(formData.get('listId'))
  const body = str(formData.get('body'))
  const level = Number(str(formData.get('level'))) || 2
  if (!listId || !body || !(await mayTouchList(viewer, listId))) return
  await addPriorityItem(listId, body, level, viewer.name || viewer.email)
  revalidatePath('/admin/priorities')
  revalidatePath('/admin/hub')
}

export async function setPriorityAction(formData: FormData) {
  const viewer = await requireSection('priorities')
  const id = str(formData.get('id'))
  if (!id || !(await mayTouchItem(viewer, id))) return
  const next: { body?: string; level?: number; done?: boolean; listId?: string } = {}
  if (formData.has('body')) {
    // A blank name is a slip of the thumb, not a wish to empty the item.
    const body = str(formData.get('body'))
    if (body) next.body = body
  }
  if (formData.has('level')) next.level = Number(str(formData.get('level')))
  if (formData.has('done')) next.done = str(formData.get('done')) === 'true'
  if (formData.has('listId')) {
    // Moving it to another list needs the right to write to that list too —
    // a varsity item can't be walked onto the JV board by a varsity-only coach.
    const listId = str(formData.get('listId'))
    if (listId && (await mayTouchList(viewer, listId))) next.listId = listId
  }
  await setPriorityItem(id, next)
  revalidatePath('/admin/priorities')
  revalidatePath('/admin/hub')
}

/**
 * The staff's own order for one list, after a drag. Called with plain values
 * from the list itself; the list is checked against who is asking.
 */
export async function reorderPrioritiesAction(listId: string, ids: string[]): Promise<{ ok: boolean; error?: string }> {
  const viewer = await requireSection('priorities')
  if (!listId || !(await mayTouchList(viewer, listId))) return { ok: false, error: 'That list isn’t yours to change.' }
  const clean = [...new Set(ids.map(String))].slice(0, 500)
  const ok = await reorderPriorityItems(listId, clean)
  revalidatePath('/admin/priorities')
  revalidatePath('/admin/hub')
  return ok ? { ok } : { ok, error: 'Couldn’t save the order — has supabase/migrations/0041_priority_groups.sql been run?' }
}

export async function deletePriorityAction(formData: FormData) {
  const viewer = await requireSection('priorities')
  const id = str(formData.get('id'))
  if (!id || !(await mayTouchItem(viewer, id))) return
  await deletePriorityItem(id)
  revalidatePath('/admin/priorities')
  revalidatePath('/admin/hub')
}

// ── Equipment sign-out ───────────────────────────────────────────────────────
// Who has what. Kept beside the inventory because it is the same screen and the
// same job: a coach with a bag of helmets and a line of players.

export async function signOutEquipment(formData: FormData) {
  const viewer = await requireTeamScope('inventory', 'inventory-jv')
  const svc = createServiceClient()

  const itemId = str(formData.get('item_id'))
  const playerId = str(formData.get('player_id'))
  if (!itemId || !playerId) return

  const [{ data: item }, { data: player }] = await Promise.all([
    svc.from('team_inventory').select('item, size, team').eq('id', itemId).maybeSingle(),
    svc.from('players').select('name, team').eq('id', playerId).maybeSingle(),
  ])
  if (!item || !player) return

  // A JV coach signs out JV kit to JV players, the same rule the rest of the
  // inventory screen already follows.
  if (viewer.scope === 'jv') {
    const itemTeam = (item as { team: string }).team
    if (itemTeam !== 'jv' && itemTeam !== 'program') return
    if ((player as { team: string | null }).team !== 'jv') return
  }

  const quantity = Math.max(1, Number(str(formData.get('quantity'))) || 1)
  await signOut({
    itemId,
    itemName: (item as { item: string }).item,
    size: (item as { size: string | null }).size,
    playerId,
    playerName: (player as { name: string }).name,
    quantity,
    dueAt: str(formData.get('due_at')) || null,
    condition: str(formData.get('condition')) || null,
    notes: str(formData.get('notes')) || null,
    signedBy: viewer.viewer.name || viewer.viewer.email,
  })

  revalidatePath('/admin/inventory')
  revalidatePath(`/admin/hub/players/${playerId}`)
}

export async function returnEquipment(formData: FormData) {
  await requireTeamScope('inventory', 'inventory-jv')
  const id = str(formData.get('id'))
  const playerId = str(formData.get('player_id'))
  if (str(formData.get('undo')) === 'true') await markOutAgain(id)
  else await markReturned(id)
  revalidatePath('/admin/inventory')
  if (playerId) revalidatePath(`/admin/hub/players/${playerId}`)
}

export async function removeAssignment(id: string) {
  await requireTeamScope('inventory', 'inventory-jv')
  await deleteAssignment(id)
  revalidatePath('/admin/inventory')
}

// ── Equipment inventory ──────────────────────────────────────────────────────
// A coach granted only "JV Inventory" can read and change JV rows and nothing
// else, enforced here rather than only in the page, so a crafted form can't
// reach varsity or program-wide gear.

export async function upsertInventoryItem(formData: FormData) {
  const { scope } = await requireTeamScope('inventory', 'inventory-jv')
  const svc = createServiceClient()
  const id = str(formData.get('id'))

  if (scope === 'jv' && id) {
    const { data: existing } = await svc.from('team_inventory').select('team').eq('id', id).maybeSingle()
    if (!existing || (existing as { team: string }).team !== 'jv') return
  }

  const requested = str(formData.get('team'))
  const team = scope === 'jv'
    ? 'jv'
    : (['program', 'varsity', 'jv'].includes(requested) ? requested : 'program')

  const item = str(formData.get('item'))
  if (!item) return

  const payload = {
    team,
    category: str(formData.get('category')) || 'Other',
    item,
    size: str(formData.get('size')) || null,
    quantity: Math.max(0, Number(formData.get('quantity') ?? 0) || 0),
    condition: ['new', 'good', 'worn', 'retire'].includes(str(formData.get('condition')))
      ? str(formData.get('condition'))
      : 'good',
    location: str(formData.get('location')) || null,
    notes: str(formData.get('notes')) || null,
    updated_at: new Date().toISOString(),
  }

  if (id) await svc.from('team_inventory').update(payload).eq('id', id)
  else await svc.from('team_inventory').insert(payload)
  revalidatePath('/admin/inventory')
}

export async function deleteInventoryItem(id: string) {
  const { scope } = await requireTeamScope('inventory', 'inventory-jv')
  const svc = createServiceClient()
  if (scope === 'jv') {
    const { data: existing } = await svc.from('team_inventory').select('team').eq('id', id).maybeSingle()
    if (!existing || (existing as { team: string }).team !== 'jv') return
  }
  await svc.from('team_inventory').delete().eq('id', id)
  revalidatePath('/admin/inventory')
}

// ── Named rosters ────────────────────────────────────────────────────────────
// Coaches' own lists, separate from the public roster page. Anyone imported is
// created inactive, so a tryout player is evaluable all season without ever
// appearing publicly until the owner marks them active on the Roster page.

export async function createRoster(formData: FormData) {
  await requireSection('rosters')
  const name = str(formData.get('name'))
  if (!name) return
  const svc = createServiceClient()
  await svc.from('player_lists').insert({
    name,
    season: str(formData.get('season')) || null,
    notes: str(formData.get('notes')) || null,
  })
  revalidatePath('/admin/rosters')
}

export async function renameRoster(formData: FormData) {
  await requireSection('rosters')
  const id = str(formData.get('id'))
  const name = str(formData.get('name'))
  if (!id || !name) return
  const svc = createServiceClient()
  await svc
    .from('player_lists')
    .update({
      name,
      season: str(formData.get('season')) || null,
      notes: str(formData.get('notes')) || null,
      is_archived: str(formData.get('is_archived')) === 'true',
      is_public: str(formData.get('is_public')) === 'true',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
  revalidatePath('/admin/rosters')
  revalidatePath(`/admin/rosters/${id}`)
  revalidatePath('/roster') // the public page reads from published rosters
}

export async function deleteRoster(id: string) {
  await requireSection('rosters')
  const svc = createServiceClient()
  // Members go with it; the player rows themselves stay put.
  await svc.from('player_lists').delete().eq('id', id)
  revalidatePath('/admin/rosters')
}

// Paste from a spreadsheet or a CSV file. Each new name becomes an inactive
// player row, then joins the roster.
export async function importRosterPlayers(
  _prev: FormState,
  formData: FormData
): Promise<FormState & { added?: number; matched?: number }> {
  await requireSection('rosters')
  const listId = str(formData.get('list_id'))
  const raw = str(formData.get('paste'))
  if (!listId) return { ok: false, error: 'Pick a roster first.' }
  if (!raw) return { ok: false, error: 'Paste some names, or choose a file.' }

  const parsed = parseRosterPaste(raw)
  if (parsed.length === 0)
    return { ok: false, error: 'Couldn’t find any names in that. One player per line.' }

  const svc = createServiceClient()
  const team = str(formData.get('team')) || 'boys_varsity'

  // Match on name so re-importing an updated sheet doesn't duplicate anyone.
  const { data: existingRows } = await svc
    .from('players')
    .select('id, name, number, position, class_year')
  type ExistingPlayer = {
    id: string
    name: string
    number: string | null
    position: string | null
    class_year: string | null
  }
  const existing = (existingRows ?? []) as ExistingPlayer[]
  const byName = new Map(existing.map((p) => [p.name.trim().toLowerCase(), p.id]))
  const detailsById = new Map(existing.map((p) => [p.id, p]))

  const { data: memberRows } = await svc
    .from('player_list_members')
    .select('player_id')
    .eq('list_id', listId)
  const already = new Set(((memberRows ?? []) as { player_id: string }[]).map((m) => m.player_id))

  let added = 0
  let matched = 0
  let filled = 0
  let order = already.size

  for (const p of parsed) {
    let playerId = byName.get(p.name.trim().toLowerCase())

    if (playerId) {
      matched++
      /* Re-pasting a fuller sheet fills in what was missing — grad years and
         numbers that weren't in the first paste — without touching anything
         already set by hand. */
      const current = detailsById.get(playerId)
      if (current) {
        const fill: Record<string, string> = {}
        if (!current.number && p.number) fill.number = p.number
        if (!current.position && p.position) fill.position = p.position
        if (!current.class_year && p.class_year) fill.class_year = p.class_year
        if (Object.keys(fill).length) {
          await svc.from('players').update(fill).eq('id', playerId)
          filled++
        }
      }
    } else {
      const { data: created, error } = await svc
        .from('players')
        .insert({
          name: p.name,
          number: p.number,
          position: p.position,
          class_year: p.class_year,
          team,
          is_active: false, // never public until the owner says so
          sort_order: 0,
        })
        .select('id')
        .single()
      if (error || !created) continue
      playerId = (created as { id: string }).id
      byName.set(p.name.trim().toLowerCase(), playerId)
      added++
    }

    if (!already.has(playerId)) {
      await svc.from('player_list_members').insert({
        list_id: listId,
        player_id: playerId,
        sort_order: order++,
      })
      already.add(playerId)
    }
  }

  revalidatePath('/admin/rosters')
  revalidatePath(`/admin/rosters/${listId}`)
  revalidatePath('/admin/roster')
  return {
    ok: true,
    added,
    matched,
    message: filled
      ? `Filled in details for ${filled} ${filled === 1 ? 'player' : 'players'} already on file.`
      : undefined,
  }
}

export async function addPlayerToRoster(formData: FormData) {
  await requireSection('rosters')
  const listId = str(formData.get('list_id'))
  const playerId = str(formData.get('player_id'))
  if (!listId || !playerId) return
  const svc = createServiceClient()
  const { count } = await svc
    .from('player_list_members')
    .select('id', { count: 'exact', head: true })
    .eq('list_id', listId)
  await svc
    .from('player_list_members')
    .upsert({ list_id: listId, player_id: playerId, sort_order: count ?? 0 }, { onConflict: 'list_id,player_id' })
  revalidatePath(`/admin/rosters/${listId}`)
}

export async function removePlayerFromRoster(formData: FormData) {
  await requireSection('rosters')
  const listId = str(formData.get('list_id'))
  const playerId = str(formData.get('player_id'))
  if (!listId || !playerId) return
  const svc = createServiceClient()
  // Only their place on this roster — the player row and any evaluations stay.
  await svc.from('player_list_members').delete().eq('list_id', listId).eq('player_id', playerId)
  revalidatePath(`/admin/rosters/${listId}`)
}

// ── Notification settings ──
// Who gets emailed when a form comes in, and which forms count. Owner only:
// this decides where parent contact details land.

export async function saveNotifySettings(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireOwner()
  const { valid, invalid } = parseRecipients(str(formData.get('recipients')))
  const off = NOTIFY_EVENTS.filter((e) => !formData.get(`on:${e.key}`)).map((e) => e.key)

  // Save what parsed rather than throwing the whole list away, then say which
  // entry didn't look like an address.
  await writeNotifySettings({ recipients: valid, off })
  revalidatePath('/admin/notifications')

  if (invalid.length)
    return {
      ok: false,
      error: `Saved, but these didn\u2019t look like email addresses: ${invalid.join(', ')}`,
    }
  if (!valid.length)
    return { ok: true, message: 'Saved. With no addresses listed, nothing will be emailed.' }
  return { ok: true, message: `Saved. Notifications go to ${valid.join(', ')}.` }
}

export async function sendTestNotification(
  _prev: FormState,
  _formData: FormData
): Promise<FormState> {
  await requireOwner()
  const status = await notifyStatus()
  if (!status.connected)
    return { ok: false, error: 'Resend isn\u2019t connected yet — add RESEND_API_KEY and EMAIL_FROM in Vercel, then redeploy.' }
  if (!status.recipients.length)
    return { ok: false, error: 'Add at least one email address above and save first.' }

  const sent = await sendEmail({
    to: status.recipients,
    subject: 'Test — Green Hope Lacrosse notifications',
    html: emailShell(
      'Notifications are working',
      row('Sent to', status.recipients.join(', ')) +
        row('From', status.from ?? '') +
        row('Meaning', 'Interest forms, fall league signups and contact messages will arrive here.')
    ),
  })
  return sent
    ? { ok: true, message: `Test sent to ${status.recipients.join(', ')}. Check your inbox (and spam).` }
    : { ok: false, error: 'Resend rejected the send. Check the API key and that the from address uses a domain verified in Resend.' }
}

/**
 * Turn the players already on the public site into a roster.
 *
 * The public list predates named rosters, so a coach with a live roster still
 * saw an empty Rosters screen. This adopts it: one list holding exactly those
 * players, marked as the published one, so nothing changes for visitors.
 */
export async function adoptPublicRoster(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireSection('rosters')
  const players = await playersOnNoRoster()
  if (players.length === 0)
    return { ok: false, error: 'Every player is already on a roster — nothing left to gather.' }

  const svc = createServiceClient()
  const name = str(formData.get('name')) || 'Current Roster'
  const season = str(formData.get('season')) || null

  // Publish it only when nothing else is published — this is usually the season
  // that's already on the public site, but it must never quietly replace a
  // roster the coach deliberately published.
  const { data: alreadyPublic } = await svc
    .from('player_lists')
    .select('id')
    .eq('is_public', true)
    .limit(1)
  const isPublic = !alreadyPublic || alreadyPublic.length === 0

  const { data: list, error } = await svc
    .from('player_lists')
    .insert({ name, season, notes: 'Built from players who were not on a roster', is_public: isPublic })
    .select('id')
    .single()
  if (error || !list) {
    console.error('[adoptPublicRoster] creating the roster', error)
    return { ok: false, error: `Couldn’t create the roster: ${error?.message ?? 'unknown error'}` }
  }

  const listId = (list as { id: string }).id
  const { error: memberError } = await svc.from('player_list_members').insert(
    players.map((p, i) => ({ list_id: listId, player_id: p.id, sort_order: i }))
  )
  if (memberError) {
    // The roster exists but is empty, which is worse than not having made it.
    console.error('[adoptPublicRoster] adding players', memberError)
    await svc.from('player_lists').delete().eq('id', listId)
    return { ok: false, error: `Couldn’t add the players: ${memberError.message}` }
  }

  revalidatePath('/admin/rosters')
  revalidatePath('/roster')
  redirect(`/admin/rosters/${listId}`)
}

/**
 * Repair players whose surname landed in the jersey-number column.
 *
 * A spreadsheet with first and last names in separate columns used to import as
 * name "Cayden", number "Staley". The importer handles that now; this fixes the
 * rows that came in before it did. Only rows whose number isn't a number are
 * touched, so a real jersey is never disturbed.
 */
export async function mergeSplitNames() {
  await requireTeamScope('roster', 'roster-jv')
  const svc = createServiceClient()
  const { data } = await svc.from('players').select('id, name, number')
  const rows = ((data ?? []) as { id: string; name: string; number: string | null }[]).filter(
    (p) => p.number && !/^#?\d{1,3}$/.test(p.number.trim())
  )
  for (const p of rows) {
    await svc
      .from('players')
      .update({ name: `${p.name} ${(p.number ?? '').trim()}`.trim(), number: null })
      .eq('id', p.id)
  }
  revalidatePath('/admin/roster')
  revalidatePath('/roster')
}

/**
 * Publish a roster to the public site, or take it off, from the Rosters list.
 *
 * Any number can be published: the public page lists them side by side under
 * their own names, so a season squad and an off-season group stay distinct
 * rather than reading as one merged list.
 */
export async function setRosterPublic(formData: FormData) {
  await requireSection('rosters')
  const id = str(formData.get('id'))
  const makePublic = str(formData.get('public')) === 'true'
  if (!id) return

  const svc = createServiceClient()
  await svc
    .from('player_lists')
    .update({ is_public: makePublic, updated_at: new Date().toISOString() })
    .eq('id', id)

  revalidatePath('/admin/rosters')
  revalidatePath(`/admin/rosters/${id}`)
  revalidatePath('/roster')
}

/**
 * Put a season away, or get it back out.
 *
 * Archiving takes a roster out of every dropdown a coach meets — the planner's
 * especially — without deleting a thing: last year's squad, who was on it and
 * every evaluation written against it all stay exactly where they are.
 *
 * A season that is over comes off the public site at the same time. Leaving
 * last year's squad on the roster page is worse than any surprise in taking it
 * down, and the Publish button is right there to put a new one up.
 */
export async function setRosterArchived(formData: FormData) {
  await requireSection('rosters')
  const id = str(formData.get('id'))
  const archived = str(formData.get('archived')) === 'true'
  if (!id) return

  const svc = createServiceClient()
  await svc
    .from('player_lists')
    .update({
      is_archived: archived,
      ...(archived ? { is_public: false } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  revalidatePath('/admin/rosters')
  revalidatePath(`/admin/rosters/${id}`)
  revalidatePath('/roster')
}

// ── Planner ──
// Practice plans, game plans and coaching notes. Every coach may write them;
// they never reach the public site.

/** The questions a scout has to answer, as a page waiting to be filled in. */
function scoutStarter(): unknown[] {
  const n = (i: number) => `sc${i}`
  const heading = (i: number, text: string) => ({ id: n(i), kind: 'heading', text })
  const list = (i: number, items: string[]) => ({
    id: n(i),
    kind: 'list',
    items: items.map((text) => ({ text, done: false })),
  })
  return [
    heading(1, 'Who they are'),
    list(2, ['Record and who they have beaten', 'Their two or three best players, by number', 'Anybody we have to know by name']),
    heading(3, 'Their offense'),
    list(4, ['The set they start in', 'Who initiates, and from where', 'What they go to when it breaks down', 'Man-up look']),
    heading(5, 'Their defense'),
    list(6, ['Man or zone, and when they switch', 'How they slide — adjacent, crease, hot', 'Who their best cover is', 'Man-down look']),
    heading(7, 'Ride and clear'),
    list(8, ['How they ride', 'How they clear, and who carries it', 'Where they are beatable']),
    heading(9, 'Face-off and the goalie'),
    list(10, ['Their FOGO — hands, counters, wing play', 'Their goalie — where he is beatable, how he clears']),
    heading(11, 'Keys to the game'),
    list(12, ['', '', '']),
  ]
}

export async function createPlan(formData: FormData) {
  const viewer = await requireSection('planner')
  const kindRaw = str(formData.get('kind'))
  const kind: PlanKind =
    kindRaw === 'game' || kindRaw === 'note' || kindRaw === 'scout' ? kindRaw : 'practice'
  const fallbackTitle =
    kind === 'game' ? 'New game plan' : kind === 'note' ? 'New note' : kind === 'scout' ? 'New scout' : 'New practice'
  const title = str(formData.get('title')) || fallbackTitle

  const team = readTeam(str(formData.get('team')))
  // Nothing gets written on a side of the program this coach doesn't work on.
  if (!canTeam(viewer, team)) return
  const svc = createServiceClient()
  const row: Record<string, unknown> = {
    kind,
    title,
    plan_date: str(formData.get('plan_date')) || null,
    season: str(formData.get('season')) || null,
    roster_id: str(formData.get('roster_id')) || null,
    created_by: viewer?.email ?? null,
    blocks: [],
  }
  /* A scout opens with the headings rather than a blank page — the point is
     that a coach sitting down to scout an opponent already knows what he is
     being asked, and fills it in. */
  if (kind === 'scout') row.content = scoutStarter()
  /* A game plan opens with every decision to make laid out — the systems, the
     lineup, each coach's job and a standard game day — against the game it is
     for, when it was made from one. */
  if (kind === 'game') {
    row.details = gamePlanStarter({
      opponent: str(formData.get('opponent')),
      gameId: str(formData.get('game_id')) || null,
    })
  }
  const faceoff = readStart(str(formData.get('start_time')))
  if (faceoff) row.start_time = faceoff

  let { data, error } = await svc.from('plans').insert({ ...row, team }).select('id').single()

  // The team column arrives with its own SQL. Until it is run there is one
  // staff's worth of plans, which is how it was — better than refusing to make
  // a plan at all.
  if (error && /team/i.test(error.message ?? '')) {
    const retry = await svc.from('plans').insert(row).select('id').single()
    data = retry.data
    error = retry.error
  }
  // Nor is the game plan's own column there before 0042, or the start time
  // before 0032: make the plan without them rather than not at all.
  for (const col of ['details', 'start_time'] as const) {
    if (error && new RegExp(col).test(error.message ?? '') && col in row) {
      delete row[col]
      const retry = await svc.from('plans').insert({ ...row, team }).select('id').single()
      data = retry.data
      error = retry.error
    }
  }

  if (error || !data) {
    console.error('[createPlan]', error)
    /* Said out loud rather than a button that does nothing. The usual cause is
       a scout on a database from before 0042, which only allowed practices,
       game plans and notes. */
    const why = /kind_check|violates check/i.test(error?.message ?? '') ? 'kind' : 'save'
    redirect(withTeam(`/admin/planner?error=${why}&kind=${kind}`, team))
  }
  revalidatePath('/admin/planner')
  redirect(withTeam(`/admin/planner/${(data as { id: string }).id}`, team))
}

/**
 * Save a plan — heading and every block in one go.
 *
 * The editor holds the whole plan in the browser and sends it back whole, so a
 * coach dragging blocks around isn't racing a save per keystroke.
 */
export async function savePlan(_prev: FormState, formData: FormData): Promise<FormState> {
  const viewer = await requireSection('planner')
  const id = str(formData.get('id'))
  if (!id) return { ok: false, error: 'Missing plan.' }

  // Whose plan this is, read from the plan rather than the form: a JV coach
  // cannot save over a varsity practice by posting to it.
  const existing = await getPlan(id)
  if (existing && !canTeam(viewer, existing.team)) {
    return { ok: false, error: 'That plan belongs to the other team.' }
  }

  let blocks: unknown = []
  let content: unknown = []
  try {
    blocks = JSON.parse(str(formData.get('blocks')) || '[]')
    content = JSON.parse(str(formData.get('content')) || '[]')
  } catch {
    return { ok: false, error: 'That plan could not be read back — nothing was saved.' }
  }

  const svc = createServiceClient()
  const blocksOut = readBlocks(blocks)
  const contentOut = readNoteBlocks(content)
  // The squads practice splits into, for the scoreboard. Arrives with 0037.
  let sides: string[] = []
  try {
    sides = readSides(JSON.parse(str(formData.get('sides')) || '[]'))
  } catch {
    sides = readSides(null)
  }
  let common: Record<string, unknown> = {
    title: str(formData.get('title')) || 'Untitled',
    plan_date: str(formData.get('plan_date')) || null,
    start_time: readStart(str(formData.get('start_time'))),
    season: str(formData.get('season')) || null,
    summary: str(formData.get('summary')) || null,
    roster_id: str(formData.get('roster_id')) || null,
    blocks: blocksOut,
    sides,
    publish_players: str(formData.get('publish_players')) === 'true',
    publish_coaches: str(formData.get('publish_coaches')) === 'true',
    updated_at: new Date().toISOString(),
  }

  let { error } = await svc
    .from('plans')
    .update({ ...common, content: contentOut })
    .eq('id', id)

  /* The squads column arrives with 0037. Drop it and carry on — a plan saves
     either way, it just cannot keep who is winning practice. Done first, so
     the retries below are working with a payload the database will accept. */
  if (error && /sides/i.test(error.message) && /column|schema cache/i.test(error.message)) {
    const { sides: _noSides, ...rest } = common
    common = rest
    const retry = await svc.from('plans').update({ ...common, content: contentOut }).eq('id', id)
    error = retry.error
  }

  /* A note is made of blocks that live in their own column, and that column
     arrives with its own SQL. Without it the whole save was failing — so a
     practice plan, which has no note blocks at all, could not be saved over a
     column it does not use. Save everything else, and only complain if there
     were blocks that had nowhere to go. */
  const missingContent = error && /content/i.test(error.message) && /column|schema cache/i.test(error.message)
  if (missingContent) {
    const retry = await svc.from('plans').update(common).eq('id', id)
    error = retry.error
    if (!error && contentOut.length > 0) {
      return {
        ok: false,
        error:
          'Saved everything but the note itself — notes need supabase/migrations/0026_note_content.sql run in the Supabase SQL editor.',
      }
    }
  }

  let warning = ''
  // The start-time column arrives with its own SQL as well. Without it the
  // plan still saves; it just opens back at four o'clock.
  if (error && /start_time/i.test(error.message) && /column|schema cache/i.test(error.message)) {
    const { start_time: _dropped, ...withoutStart } = common
    const retry = await svc
      .from('plans')
      .update(contentOut.length || !missingContent ? { ...withoutStart, content: contentOut } : withoutStart)
      .eq('id', id)
    error = retry.error
    if (!error) {
      // Carry on: a game plan's own contents still go in below.
      warning = 'Saved, but not the start time — run supabase/migrations/0032_plan_start_time.sql in the Supabase SQL editor.'
    }
  }

  if (error) {
    console.error('[savePlan]', error)
    return { ok: false, error: `Couldn\u2019t save: ${error.message}` }
  }

  /* A game plan's decisions and game-day schedule live in their own column,
     which arrives with 0042. Written on their own, after everything else has
     saved, so a missing column costs only this part and says so. */
  if (formData.has('details')) {
    let raw: unknown = {}
    try {
      raw = JSON.parse(str(formData.get('details')) || '{}')
    } catch {
      return { ok: false, error: 'Saved, but the game plan could not be read back — try again.' }
    }
    const { error: detailsError } = await svc.from('plans').update({ details: readGamePlan(raw) }).eq('id', id)
    if (detailsError) {
      return {
        ok: false,
        error: /details/i.test(detailsError.message)
          ? 'Saved everything but the game plan itself — run supabase/migrations/0042_game_plans.sql in the Supabase SQL editor.'
          : `Couldn\u2019t save the game plan: ${detailsError.message}`,
      }
    }
  }

  revalidatePath('/admin/planner')
  revalidatePath(`/admin/planner/${id}`)
  revalidatePath('/admin/hub')
  revalidatePath('/team/me')
  if (warning) return { ok: false, error: warning }
  return { ok: true, message: 'Saved.' }
}

export async function deletePlan(id: string) {
  const viewer = await requireSection('planner')
  const svc = createServiceClient()
  const { data: plan } = await svc.from('plans').select('team').eq('id', id).maybeSingle()
  if (!plan) redirect('/admin/planner')
  // Reading the other side's plans is fine; deleting them is not.
  const team = readTeam((plan as { team?: unknown }).team)
  if (!canTeam(viewer, team)) redirect(withTeam('/admin/planner', team))
  await svc.from('plans').delete().eq('id', id)
  revalidatePath('/admin/planner')
  revalidatePath('/admin/hub')
  redirect(withTeam('/admin/planner', team))
}

/** Copy a plan, blocks and all — last Tuesday's practice as today's starting point. */
export async function duplicatePlan(formData: FormData) {
  await requireSection('planner')
  const id = str(formData.get('id'))
  if (!id) return
  const viewer = await getViewer()
  const svc = createServiceClient()
  const { data: original } = await svc.from('plans').select('*').eq('id', id).maybeSingle()
  if (!original) return
  const o = original as Record<string, unknown>
  /* The copy stays on the same team's side — a JV plan's copy is a JV plan —
     and only a coach who may write to that side can make one. */
  const team = readTeam(o.team)
  if (!canTeam(viewer, team)) return
  /* Everything that makes the plan what it is comes with it: a note's or
     scout's page, a game plan's decisions and game day, the start time, the
     squads, the blocks with their "how it went" notes. Columns a database has
     not been given yet are left off rather than failing the copy. */
  const row: Record<string, unknown> = {
    kind: o.kind,
    title: `${String(o.title)} (copy)`,
    season: o.season,
    summary: o.summary,
    roster_id: o.roster_id,
    blocks: o.blocks,
    created_by: viewer?.email ?? null,
    team,
  }
  for (const col of ['content', 'details', 'start_time', 'sides'] as const) {
    if (col in o && o[col] !== null && o[col] !== undefined) row[col] = o[col]
  }
  // A copied game plan is a starting point for another game, not a second plan for this one.
  if (o.kind === 'game' && row.details) row.details = { ...readGamePlan(row.details), gameId: null }
  let { data: copy, error } = await svc.from('plans').insert(row).select('id').single()
  for (let tries = 0; error && tries < 5; tries++) {
    const missing = ['details', 'sides', 'start_time', 'content', 'team'].find(
      (col) => col in row && new RegExp(col).test(error?.message ?? ''),
    )
    if (!missing) break
    delete row[missing]
    ;({ data: copy, error } = await svc.from('plans').insert(row).select('id').single())
  }
  revalidatePath('/admin/planner')
  if (copy) redirect(withTeam(`/admin/planner/${(copy as { id: string }).id}`, team))
}

// ── Which modes a coach sees in the hub ──
// The head coach decides what the sidebar carries; a JV coach doesn't need the
// game planner in their way. Stored with the other settings, no migration.

export async function saveHubModes(formData: FormData) {
  await requireOwner()
  const off = HUB_MODE_KEYS.filter((k) => !formData.get(`mode:${k}`))
  const svc = createServiceClient()
  await svc
    .from('app_settings')
    .upsert({ key: HUB_MODES_KEY, value: JSON.stringify(off) }, { onConflict: 'key' })
  revalidatePath('/admin/hub')
  revalidatePath('/admin/planner')
}

// ── Drill bank ──
// Kept once, dropped into any practice. Every coach may add one.

export async function upsertDrill(formData: FormData) {
  await requireSection('drills')
  const viewer = await getViewer()
  const id = str(formData.get('id'))
  const payload = {
    name: str(formData.get('name')),
    category: str(formData.get('category')) || 'stickwork',
    minutes: Math.max(0, Math.min(240, Number(formData.get('minutes')) || 10)),
    setting: ['wall', 'solo', 'partner', 'team', 'film'].includes(str(formData.get('setting')))
      ? str(formData.get('setting'))
      : 'team',
    description: str(formData.get('description')) || null,
    link: str(formData.get('link')) || null,
    link_label: str(formData.get('link_label')) || null,
    equipment: str(formData.get('equipment')) || null,
    is_favorite: str(formData.get('is_favorite')) === 'true',
    updated_at: new Date().toISOString(),
  }
  if (!payload.name) return

  /* Setup and context arrive with 0037. Write them when the columns are there,
     and fall back to saving the rest when they aren't, so a site a migration
     behind can still edit its drill bank. */
  const detail = {
    setup: str(formData.get('setup')) || null,
    context: str(formData.get('context')) || null,
  }

  const svc = createServiceClient()
  const write = async (row: Record<string, unknown>) =>
    id
      ? await svc.from('drills').update(row).eq('id', id)
      : await svc.from('drills').insert({ ...row, created_by: viewer?.email ?? null })

  const { error } = await write({ ...payload, ...detail })
  if (error) await write(payload)
  revalidatePath('/admin/drills')
  revalidatePath('/admin/planner')
}

export async function deleteDrill(id: string) {
  await requireSection('drills')
  const svc = createServiceClient()
  await svc.from('drills').delete().eq('id', id)
  revalidatePath('/admin/drills')
}

export async function toggleDrillFavorite(formData: FormData) {
  await requireSection('drills')
  const id = str(formData.get('id'))
  if (!id) return
  const svc = createServiceClient()
  await svc
    .from('drills')
    .update({ is_favorite: str(formData.get('favorite')) === 'true' })
    .eq('id', id)
  revalidatePath('/admin/drills')
}

/** Paste a whole bank in at once: one drill a line, name first. */
export async function importDrills(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireSection('drills')
  const viewer = await getViewer()
  const rows = parseDrillPaste(str(formData.get('paste')), str(formData.get('category')) || 'stickwork')
  if (rows.length === 0) return { ok: false, error: 'Nothing to import — one drill per line.' }

  const svc = createServiceClient()
  const { error } = await svc.from('drills').insert(
    rows.map((r) => ({
      name: r.name,
      category: r.category,
      minutes: r.minutes,
      link: r.link,
      created_by: viewer?.email ?? null,
    }))
  )
  if (error) {
    console.error('[importDrills]', error)
    return { ok: false, error: `Couldn\u2019t import: ${error.message}` }
  }
  revalidatePath('/admin/drills')
  revalidatePath('/admin/planner')
  return { ok: true, message: `Added ${rows.length} ${rows.length === 1 ? 'drill' : 'drills'}.` }
}

// ── Player drill sets ──
// A coach generates a set from a player's most recent evaluation; what was
// prescribed is stored, so the player's page doesn't move under them.

async function prescribeFor(playerId: string, drills: Awaited<ReturnType<typeof listDrills>>, by: string | null) {
  const svc = createServiceClient()
  const { data: player } = await svc
    .from('players')
    .select('id, position')
    .eq('id', playerId)
    .maybeSingle()
  if (!player) return { ok: false as const, reason: 'no player' }

  const { data: evals } = await svc
    .from('evaluations')
    .select('*')
    .eq('player_id', playerId)
    .order('updated_at', { ascending: false })
    .limit(1)
  const evaluation = (evals ?? [])[0] as Evaluation | undefined
  if (!evaluation) return { ok: false as const, reason: 'no evaluation' }

  // The position the coach evaluated him at wins over the one on the roster: if
  // a coach sat down and scored him as a goalie, his homework is goalie work,
  // whatever the roster still says.
  const set = buildDrillSet(
    evaluation,
    drills,
    positionGroup(evaluation.position ?? (player as { position: string | null }).position)
  )
  if (set.items.length === 0) return { ok: false as const, reason: 'nothing to prescribe' }

  const { error } = await svc.from('player_drill_sets').insert({
    player_id: playerId,
    items: set.items,
    focus: set.focus,
    source_eval_id: evaluation.id,
    season: evaluation.season,
    created_by: by,
  })
  if (error) return { ok: false as const, reason: error.message }
  return { ok: true as const, count: set.items.length }
}

export async function generateDrillSet(formData: FormData) {
  await requireSection('hub')
  const viewer = await getViewer()
  const playerId = str(formData.get('player_id'))
  if (!playerId) return
  const drills = await listDrills()
  await prescribeFor(playerId, drills, viewer?.email ?? null)
  revalidatePath('/admin/hub/players')
  revalidatePath('/team/me')
}

/** Everyone on a roster at once — the start-of-week job, not forty clicks. */
export async function generateDrillSetsForRoster(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireSection('hub')
  const viewer = await getViewer()
  const listId = str(formData.get('list_id'))
  if (!listId) return { ok: false, error: 'Pick a roster first.' }

  const svc = createServiceClient()
  const { data: members } = await svc
    .from('player_list_members')
    .select('player_id')
    .eq('list_id', listId)
  const ids = ((members ?? []) as { player_id: string }[]).map((m) => m.player_id)
  if (ids.length === 0) return { ok: false, error: 'Nobody on that roster.' }

  const drills = await listDrills()
  let made = 0
  let skipped = 0
  for (const id of ids) {
    const result = await prescribeFor(id, drills, viewer?.email ?? null)
    if (result.ok) made++
    else skipped++
  }

  revalidatePath('/admin/hub/players')
  revalidatePath('/team/me')
  return {
    ok: true,
    message:
      `Made ${made} drill ${made === 1 ? 'set' : 'sets'}.` +
      (skipped ? ` ${skipped} skipped — no evaluation to work from yet.` : ''),
  }
}

// ── Player invite links ──

export async function createPlayerInvite(formData: FormData) {
  await requireSection('hub')
  const playerId = str(formData.get('player_id'))
  if (!playerId) return
  await ensurePlayerToken(playerId)
  revalidatePath('/admin/hub/players')
}

export async function revokePlayerInvite(formData: FormData) {
  await requireSection('hub')
  const playerId = str(formData.get('player_id'))
  if (!playerId) return
  await revokePlayerToken(playerId)
  revalidatePath('/admin/hub/players')
}
