import Link from 'next/link'
import { requireOwner } from '@/lib/permissions'
import { listStaff } from '@/lib/staff'
import { coachReviewsReady, getCoachReview, saveCoachReview, deleteCoachReview } from '@/lib/coachReviewActions'
import { RatingSlider } from '@/components/admin/RatingSlider'
import {
  COACH_TIERS,
  REVIEW_CATEGORIES,
  REVIEW_SECTIONS,
  STANDING_OPTIONS,
  currentSeason,
  readRating,
  seasonChoices,
} from '@/lib/coachReviews'

export const metadata = { title: 'Coach review' }
export const dynamic = 'force-dynamic'

export default async function CoachReviewForm({
  params,
  searchParams,
}: {
  params: Promise<{ coach: string }>
  searchParams: Promise<{ season?: string; saved?: string }>
}) {
  await requireOwner()

  const { coach: raw } = await params
  const { season: asked, saved } = await searchParams
  const email = decodeURIComponent(raw).toLowerCase()

  const now = new Date()
  const seasons = seasonChoices(now)
  const season = asked && seasons.includes(asked) ? asked : currentSeason(now)

  const staff = await listStaff()
  const record = staff.find((s) => s.email.toLowerCase() === email)
  const ready = await coachReviewsReady()
  const review = ready ? await getCoachReview(email, season) : null
  const name = record?.name ?? review?.coach_name ?? email.split('@')[0]

  const back = `/admin/coach-reviews?season=${season}`

  return (
    <div className="max-w-2xl">
      <Link href={back} className="text-sm font-bold text-[var(--gh-green)]">← All coaches</Link>

      <h1 className="text-xl font-black mt-2 mb-1">{name}</h1>
      <p className="text-gray-500 text-sm mb-1">{email}</p>
      <p className="text-gray-500 text-sm mb-5">
        Season {season} review. Yours alone — {name} cannot see this, and neither can the rest of
        the staff.
        {!record && ' This coach is no longer in Coach Access; the review is kept anyway.'}
      </p>

      {saved && (
        <div className="bg-green-50 border border-green-200 text-green-800 text-sm rounded-lg px-3 py-2 mb-4 font-semibold">
          Review saved ✓
        </div>
      )}

      {!ready ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm text-amber-900 font-bold mb-1">Coach reviews aren&rsquo;t switched on yet.</p>
          <p className="text-sm text-amber-900">
            Run <code>supabase/migrations/0033_coach_reviews.sql</code> in the Supabase SQL editor.
          </p>
        </div>
      ) : (
        <form action={saveCoachReview} className="card p-5 space-y-5">
          <input type="hidden" name="coach_email" value={email} />
          <input type="hidden" name="coach_name" value={name} />
          <input type="hidden" name="season" value={season} />

          {REVIEW_SECTIONS.map((section) => (
            <details key={section} open className="border-t first:border-t-0 pt-4 first:pt-0">
              <summary className="cursor-pointer list-none section-label mb-2 flex items-center gap-2">
                <span className="caret text-sm">▸</span> {section}
              </summary>
              <div className="space-y-3">
                {REVIEW_CATEGORIES.filter((c) => c.section === section).map((c) => {
                  const r = readRating(review?.ratings?.[c.key])
                  return (
                    <RatingSlider
                      key={c.key}
                      name={`cat_${c.key}`}
                      label={c.label}
                      hint={c.hint}
                      tiers={COACH_TIERS}
                      defaultScore={r?.score}
                      defaultNote={r?.note}
                    />
                  )
                })}
              </div>
            </details>
          ))}

          <div className="border-t pt-4">
            <div className="section-label mb-2">Overall</div>
            <RatingSlider
              name="overall"
              label="Overall"
              hint="The season in one number."
              tiers={COACH_TIERS}
              defaultScore={review?.overall ?? undefined}
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="field-label">What he did well</label>
              <textarea name="strengths" rows={4} defaultValue={review?.strengths ?? ''} className="field"
                placeholder="What you want more of…" />
            </div>
            <div>
              <label className="field-label">What has to get better</label>
              <textarea name="areas_to_improve" rows={4} defaultValue={review?.areas_to_improve ?? ''} className="field"
                placeholder="Said plainly, so it can be worked on…" />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="field-label">Next season</label>
              <select name="standing" defaultValue={review?.standing ?? ''} className="field">
                <option value="">— not decided —</option>
                {STANDING_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label">Private notes</label>
              <textarea name="notes" rows={4} defaultValue={review?.notes ?? ''} className="field"
                placeholder="Anything you wouldn't say in the meeting…" />
            </div>
          </div>

          {/* Two buttons rather than a status box: saving and signing off are
              different decisions, and one of them is the end of the season. */}
          <div className="sticky bottom-0 -mx-5 -mb-5 px-5 py-3 bg-white border-t rounded-b-xl flex gap-2 flex-wrap items-center">
            <button type="submit" name="status" value="draft" className="btn btn-outline">
              Save draft
            </button>
            <button type="submit" name="status" value="final" className="btn btn-primary">
              {review?.status === 'final' ? 'Save — signed off' : 'Save & sign off'}
            </button>
            {review?.status === 'final' && (
              <span className="text-xs font-bold text-green-700">Signed off</span>
            )}
          </div>
        </form>
      )}

      {review && (
        <form action={deleteCoachReview} className="mt-4 flex justify-end">
          <input type="hidden" name="coach_email" value={email} />
          <input type="hidden" name="season" value={season} />
          <button type="submit" className="text-xs font-bold text-red-600 hover:text-red-800">
            Delete this review
          </button>
        </form>
      )}
    </div>
  )
}
