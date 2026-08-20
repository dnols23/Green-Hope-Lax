'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient, createServiceClient } from './supabase-server'
import { sendCoachEmail, sendEmail, postEmailHtml, emailShell, row } from './email'
import {
  EXPERIENCE_LABELS,
  type ExperienceLevel,
  type PlayerCollection,
  type InterestSubmission,
} from './types'
import { TEAM_COOKIE, hashTeamPassword, teamCookieToken } from './teamAuth'
import { encryptTeamCode } from './teamCode'
import { requireOwner, getViewer, requireTeamScope, requireSection } from './permissions'
import { readStaff, writeStaff, deleteStaff } from './staff'
import { parseRosterPaste } from './rosters'
import { getCurrentCoach } from './coach'
import { EVAL_CATEGORIES } from './evaluations'

// ─── validation helpers ────────────────────────────────────────────────────────
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const str = (v: FormDataEntryValue | null) => (typeof v === 'string' ? v.trim() : '')
const numOrNull = (v: FormDataEntryValue | null) =>
  v != null && v !== '' ? Number(v) : null

export type FormState = { ok: boolean; error?: string }

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

  await sendCoachEmail({
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

  await sendCoachEmail({
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

  await sendCoachEmail({
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
  if (id) await supabase.from('games').update(payload).eq('id', id)
  else await supabase.from('games').insert(payload)
  revalidatePath('/schedule')
  revalidatePath('/admin/schedule')
}

export async function deleteGame(id: string) {
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
  if (coach.role === 'head') {
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
  const role = str(formData.get('role')) === 'head' ? 'head' : 'assistant'
  const permissions = formData.getAll('permissions').map(String).filter(Boolean)

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
    await writeStaff({ email, name: display_name, role, isOwner: false, permissions })
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

  await writeStaff({ email, name: display_name, role, isOwner: false, permissions })

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
    role: str(formData.get('role')) === 'head' ? 'head' : 'assistant',
    permissions: formData.getAll('permissions').map(String).filter(Boolean),
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

// ── Coaches Hub: manage coach roles (Head Coach only) ──
// Add or update a coach account. Upserts by email, so it handles both the
// per-coach role/name form and the "add a coach" form. Their LOGIN is created
// separately in Supabase Auth; this row just labels them + sets their role.
export async function setCoachRole(formData: FormData) {
  const me = await getCurrentCoach()
  if (me?.role !== 'head') return
  const email = str(formData.get('email')).toLowerCase()
  if (!email) return
  const display_name = str(formData.get('display_name')) || email.split('@')[0]
  const role = str(formData.get('role')) === 'head' ? 'head' : 'assistant'
  const supabase = createServiceClient()
  await supabase.from('coach_accounts').upsert({ email, display_name, role }, { onConflict: 'email' })
  revalidatePath('/admin/hub/coaches')
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
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
  revalidatePath('/admin/rosters')
  revalidatePath(`/admin/rosters/${id}`)
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
  const { data: existingRows } = await svc.from('players').select('id, name')
  const byName = new Map(
    ((existingRows ?? []) as { id: string; name: string }[]).map((p) => [p.name.trim().toLowerCase(), p.id])
  )

  const { data: memberRows } = await svc
    .from('player_list_members')
    .select('player_id')
    .eq('list_id', listId)
  const already = new Set(((memberRows ?? []) as { player_id: string }[]).map((m) => m.player_id))

  let added = 0
  let matched = 0
  let order = already.size

  for (const p of parsed) {
    let playerId = byName.get(p.name.trim().toLowerCase())

    if (playerId) {
      matched++
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
  return { ok: true, added, matched }
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
