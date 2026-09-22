'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createServiceClient } from './supabase-server'
import { requireOwner } from './permissions'
import { REVIEW_CATEGORIES, type CoachReview } from './coachReviews'

const str = (v: FormDataEntryValue | null) => (typeof v === 'string' ? v.trim() : '')

function numOrNull(v: FormDataEntryValue | null): number | null {
  const n = Number(str(v))
  return Number.isFinite(n) && n > 0 ? n : null
}

/** Has the coach-review SQL been run? Every page checks before it draws. */
export async function coachReviewsReady(): Promise<boolean> {
  const svc = createServiceClient()
  const { error } = await svc.from('coach_reviews').select('id').limit(1)
  return !error
}

/**
 * Every review on file, newest first. Head coach only.
 *
 * All seasons, not one: the list page needs to know which season actually has
 * work in it so it can open there, and a staff's worth of reviews is a handful
 * of rows however many years the program runs.
 */
export async function listCoachReviews(): Promise<CoachReview[]> {
  await requireOwner()
  const svc = createServiceClient()
  const { data } = await svc.from('coach_reviews').select('*').order('updated_at', { ascending: false })
  return (data as CoachReview[]) ?? []
}

export async function getCoachReview(email: string, season: string): Promise<CoachReview | null> {
  await requireOwner()
  const svc = createServiceClient()
  const { data } = await svc
    .from('coach_reviews')
    .select('*')
    .eq('coach_email', email.toLowerCase())
    .eq('season', season)
    .maybeSingle()
  return (data as CoachReview | null) ?? null
}

/**
 * Write one coach's review. Head coach only, twice over: requireOwner() here,
 * and the table itself is service-role-only.
 *
 * Draft and final are the same row — marking it final doesn't lock it, it just
 * says the season is closed and this is what it came to. Being able to reopen
 * one matters more than being stopped from it.
 */
export async function saveCoachReview(formData: FormData) {
  const owner = await requireOwner()

  const email = str(formData.get('coach_email')).toLowerCase()
  const name = str(formData.get('coach_name'))
  const season = str(formData.get('season'))
  if (!email || !season) return

  const ratings: Record<string, { score: number; note?: string }> = {}
  for (const c of REVIEW_CATEGORIES) {
    const raw = formData.get(`cat_${c.key}`)
    if (raw == null) continue
    const score = Number(raw)
    if (!Number.isFinite(score) || score < 0 || score > 100) continue
    const note = str(formData.get(`note_${c.key}`))
    ratings[c.key] = note ? { score, note } : { score }
  }

  const status = str(formData.get('status')) === 'final' ? 'final' : 'draft'

  const svc = createServiceClient()
  await svc.from('coach_reviews').upsert(
    {
      coach_email: email,
      coach_name: name || email.split('@')[0],
      season,
      ratings,
      overall: numOrNull(formData.get('overall')),
      strengths: str(formData.get('strengths')) || null,
      areas_to_improve: str(formData.get('areas_to_improve')) || null,
      standing: str(formData.get('standing')) || null,
      notes: str(formData.get('notes')) || null,
      status,
      reviewer_email: owner.email,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'coach_email,season' }
  )

  revalidatePath('/admin/coach-reviews')
  redirect(`/admin/coach-reviews/${encodeURIComponent(email)}?season=${season}&saved=1`)
}

/** Throw a review away — a wrong season, or one started on the wrong coach. */
export async function deleteCoachReview(formData: FormData) {
  await requireOwner()
  const email = str(formData.get('coach_email')).toLowerCase()
  const season = str(formData.get('season'))
  if (!email || !season) return

  const svc = createServiceClient()
  await svc.from('coach_reviews').delete().eq('coach_email', email).eq('season', season)

  revalidatePath('/admin/coach-reviews')
  redirect(`/admin/coach-reviews?season=${season}`)
}
