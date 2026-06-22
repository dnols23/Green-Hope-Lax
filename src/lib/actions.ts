'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient, createServiceClient } from './supabase-server'
import { sendCoachEmail, sendEmail, postEmailHtml, emailShell, row } from './email'
import { EXPERIENCE_LABELS, type ExperienceLevel } from './types'
import { TEAM_COOKIE, hashTeamPassword, teamCookieToken } from './teamAuth'

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
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/admin/login')
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
  await supabase
    .from('app_settings')
    .upsert({ key: 'team_password_hash', value: await hashTeamPassword(pw) }, { onConflict: 'key' })
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
    notes: str(formData.get('notes')) || null,
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
    subject: `New lacrosse interest: ${data.player_first} ${data.player_last}`,
    replyTo: data.parent_email,
    html: emailShell(
      'New Player Interest Submission',
      row('Player', `${data.player_first} ${data.player_last}`) +
        row('Grad year', data.grad_year) +
        row('Experience', EXPERIENCE_LABELS[data.experience]) +
        row('Parent/Guardian', data.parent_name) +
        row('Parent email', data.parent_email) +
        row('Parent phone', data.parent_phone) +
        row('Player email', data.player_email) +
        row('Notes', data.notes)
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

// ═══ ADMIN CRUD ══════════════════════════════════════════════════════════════════
// All of these run as the logged-in admin (anon client + their auth cookie), so
// RLS "admin all" policies authorize the writes.

// ── players ──
export async function upsertPlayer(formData: FormData) {
  const supabase = await createClient()
  const id = str(formData.get('id'))
  const payload = {
    team: str(formData.get('team')) || 'boys_varsity',
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
