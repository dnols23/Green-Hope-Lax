import Link from 'next/link'
import { requireOwner } from '@/lib/permissions'
import { listStaff } from '@/lib/staff'
import { coachReviewsReady, listCoachReviews } from '@/lib/coachReviewActions'
import {
  coachTierFor,
  currentSeason,
  reviewScore,
  seasonChoices,
  standingIsGood,
  type CoachReview,
} from '@/lib/coachReviews'

export const metadata = { title: 'Coach Reviews' }
export const dynamic = 'force-dynamic'

/**
 * The head coach's list of his own staff, one line each, at season end.
 *
 * Nobody else reaches this page — not the assistants, and not the coach being
 * reviewed. It sits in the Coaches Hub rather than the admin panel because it
 * is coaching work, done in the same sitting as everything else.
 */
export default async function CoachReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string }>
}) {
  await requireOwner()
  const { season: asked } = await searchParams

  const now = new Date()
  const seasons = seasonChoices(now)

  const ready = await coachReviewsReady()
  const staff = await listStaff()
  const all: CoachReview[] = ready ? await listCoachReviews() : []

  /* Land where the work is. A lacrosse season is named for the spring it ends
     in, so from July onward "this season" is one nobody has reviewed yet — and
     opening on an empty year, with last year's reviews one unmarked click away,
     is the wrong first screen. */
  const withWork = seasons.filter((s) => all.some((r) => r.season === s))
  const season = asked && seasons.includes(asked) ? asked : (withWork[0] ?? currentSeason(now))

  const reviews = all.filter((r) => r.season === season)
  const byEmail = new Map(reviews.map((r) => [r.coach_email.toLowerCase(), r]))

  // You don't review yourself. Everyone else on staff gets a line.
  const coaches = staff.filter((s) => !s.isOwner)
  const done = coaches.filter((c) => byEmail.get(c.email.toLowerCase())?.status === 'final').length

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-black mb-1">Coach Reviews</h1>
      <p className="text-gray-500 text-sm mb-5">
        Your end-of-season review of each coach on staff. Only you can open this — not the other
        coaches, and not the coach being reviewed. Player evaluations are the other way round: the
        whole staff writes those and the whole staff reads them.
      </p>

      {!ready && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 mb-4">
          <p className="text-sm text-amber-900 font-bold mb-1">Coach reviews aren&rsquo;t switched on yet.</p>
          <p className="text-sm text-amber-900">
            Run <code>supabase/migrations/0033_coach_reviews.sql</code> in the Supabase SQL editor.
            Nothing else on the site is affected.
          </p>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
        <form className="flex items-end gap-2">
          <div>
            <label className="field-label">Season</label>
            <select name="season" defaultValue={season} className="field">
              {seasons.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn btn-ghost text-sm">Show</button>
        </form>
        {ready && coaches.length > 0 && (
          <span className="text-xs font-bold text-gray-500">
            {done} of {coaches.length} signed off
          </span>
        )}
      </div>

      {coaches.length === 0 ? (
        <div className="card p-6 text-sm text-gray-500">
          No coaches on staff yet. Add them in{' '}
          <Link href="/admin/access" className="font-bold text-[var(--gh-green)]">Coach Access</Link>{' '}
          and they&rsquo;ll appear here.
        </div>
      ) : (
        <div className="space-y-2">
          {coaches.map((c) => {
            const r = byEmail.get(c.email.toLowerCase())
            const score = r ? reviewScore(r) : 0
            const tier = coachTierFor(score)
            return (
              <Link
                key={c.email}
                href={`/admin/coach-reviews/${encodeURIComponent(c.email)}?season=${season}`}
                className="card p-4 flex items-center justify-between gap-3 flex-wrap hover:border-[var(--gh-green)] transition-colors"
              >
                <div>
                  <div className="font-bold">{c.name}</div>
                  <div className="text-xs text-gray-500">{c.email}</div>
                  {r?.standing && (
                    <div
                      className="text-xs font-bold mt-1"
                      style={{ color: standingIsGood(r.standing) ? 'var(--gh-green)' : 'var(--gh-maroon)' }}
                    >
                      {r.standing}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {!r ? (
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-gray-100 text-gray-500">
                      Not started
                    </span>
                  ) : (
                    <>
                      {score > 0 && (
                        <span
                          className="text-xs font-bold px-2.5 py-1 rounded-full tabular-nums whitespace-nowrap"
                          style={{ background: tier.soft, color: tier.ink }}
                        >
                          {Math.round(score)} · {tier.label}
                        </span>
                      )}
                      <span
                        className="text-xs font-bold px-2.5 py-1 rounded-full"
                        style={
                          r.status === 'final'
                            ? { background: '#dcfce7', color: '#166534' }
                            : { background: '#fef3c7', color: '#92400e' }
                        }
                      >
                        {r.status === 'final' ? 'Signed off' : 'Draft'}
                      </span>
                    </>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
