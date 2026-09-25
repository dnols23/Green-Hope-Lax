import Link from 'next/link'
import { getViewer, requireTeam } from '@/lib/permissions'
import { canSeePlan, isAuthor, listPlans, plannerReady } from '@/lib/plans'
import { listRosters } from '@/lib/rosters'
import { createPlan } from '@/lib/actions'
import { PLAN_KINDS, formatMinutes, totalMinutes, minutesByTag, type Plan } from '@/lib/planner'
import { describeNote, readNoteBlocks } from '@/lib/noteBlocks'
import { describeGamePlan, readGamePlan } from '@/lib/gamePlan'
import { formatShortDate } from '@/lib/format'
import { teamLabel, withTeam } from '@/lib/teams'

export const metadata = { title: 'Planner' }
export const dynamic = 'force-dynamic'

export default async function PlannerPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const { team, locked } = await requireTeam('planner', sp.team)
  // Set when a plan could not be made (see createPlan).
  const failed = typeof sp.error === 'string' ? sp.error : null
  const failedKind = typeof sp.kind === 'string' ? sp.kind : null

  if (!(await plannerReady())) {
    return (
      <div className="max-w-2xl">
        <h1 className="text-xl font-black mb-1">Planner</h1>
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 mt-4">
          <p className="text-sm text-amber-900 font-bold mb-1">The planner isn&rsquo;t switched on yet.</p>
          <p className="text-sm text-amber-900">
            Run <code>supabase/migrations/0017_planner.sql</code> in the Supabase SQL editor and this
            page starts working. Nothing else on the site is affected.
          </p>
        </div>
      </div>
    )
  }

  const [all, rosters, viewer] = await Promise.all([listPlans(team), listRosters(), getViewer()])
  /* Drafts are their author's, and the head coaches' once sent in. They sit in
     their own lists up top; the staff's plans are everything else. */
  const visible = all.filter((p) => canSeePlan(viewer, p))
  const plans = visible.filter((p) => !p.private)
  const myDrafts = visible.filter((p) => p.private && isAuthor(viewer, p))
  const forReview = visible.filter((p) => p.private && !isAuthor(viewer, p))

  const renderPlan = (p: Plan, badge?: string) => {
    const mins = totalMinutes(p.blocks)
    // A game plan has no running clock; what shows is how much of it is decided.
    const tags = p.kind === 'game' ? [] : minutesByTag(p.blocks)
    const gameLine = p.kind === 'game' ? describeGamePlan(readGamePlan(p.details)) : ''
    return (
      <Link
        key={p.id}
        href={withTeam(`/admin/planner/${p.id}`, team)}
        className="card p-4 flex items-center justify-between gap-3 hover:shadow-md transition-shadow"
      >
        <div className="min-w-0">
          <div className="font-bold truncate">
            {p.title}
            {badge && (
              <span className="ml-2 align-middle text-[0.65rem] font-black uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">
                {badge}
              </span>
            )}
          </div>
          <div className="text-xs text-gray-500">
            {[p.plan_date ? formatShortDate(p.plan_date) : null, p.summary]
              .filter(Boolean)
              .join(' · ') || 'No date set'}
          </div>
          {tags.length > 0 && (
            <div className="flex h-1.5 rounded-full overflow-hidden mt-2 max-w-[220px]">
              {tags.map(({ tag, minutes }) => (
                <div key={tag.key} style={{ background: tag.color, width: `${(minutes / mins) * 100}%` }} />
              ))}
            </div>
          )}
        </div>
        {/* A note has no length and no blocks; "0m · 0 blocks" beside
            one is just noise. */}
        {p.kind === 'note' && describeNote(readNoteBlocks(p.content)) && (
          <div className="text-xs text-gray-400 shrink-0">
            {describeNote(readNoteBlocks(p.content))}
          </div>
        )}
        {p.kind === 'game' && gameLine && (
          <div className="text-xs text-gray-400 shrink-0 text-right max-w-[45%]">{gameLine}</div>
        )}
        {p.kind !== 'note' && p.kind !== 'game' && (
          <div className="text-right shrink-0">
            <div className="text-lg font-black" style={{ color: 'var(--gh-green)' }}>
              {formatMinutes(mins)}
            </div>
            <div className="text-xs text-gray-400">
              {p.blocks.length} {p.blocks.length === 1 ? 'block' : 'blocks'}
            </div>
          </div>
        )}
      </Link>
    )
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <h1 className="text-xl font-black">
            {team === 'varsity' ? 'Planner' : `${teamLabel(team)} planner`}
          </h1>
          {!locked && (
            <Link
              href={withTeam('/admin/planner', team === 'varsity' ? 'jv' : 'varsity')}
              className="text-xs font-bold px-2 py-0.5 rounded-full border border-gray-200 text-gray-500 hover:border-[var(--gh-green)] hover:text-[var(--gh-green)]"
            >
              {team === 'varsity' ? 'JV' : 'Varsity'} →
            </Link>
          )}
        </div>
        <p className="text-gray-500 text-sm">
          Practices, game plans and notes for the {teamLabel(team).toLowerCase()}. Blocks carry their
          own field diagrams, so what you drew on Tuesday is still on the plan in March.
        </p>
      </div>

      {failed && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3" role="alert">
          {failed === 'kind' ? (
            <>
              <p className="text-sm text-amber-900 font-bold mb-1">
                The database won&rsquo;t take a {failedKind === 'scout' ? 'scout' : 'plan of that kind'} yet.
              </p>
              <p className="text-sm text-amber-900">
                Run <code>supabase/migrations/0042_game_plans.sql</code> in the Supabase SQL editor, then try again.
              </p>
            </>
          ) : failed === 'drafts' ? (
            <p className="text-sm text-amber-900">
              <span className="font-bold">Drafts aren&rsquo;t switched on yet.</span> Run{' '}
              <code>supabase/migrations/0043_plan_drafts.sql</code> in the Supabase SQL editor, then try again.
            </p>
          ) : (
            <p className="text-sm text-amber-900 font-bold">That plan couldn&rsquo;t be made. Try again in a moment.</p>
          )}
        </div>
      )}

      <div className="grid sm:grid-cols-3 gap-3">
        {PLAN_KINDS.map((k) => (
          <form key={k.key} action={createPlan} className="card p-4 flex flex-col">
            <input type="hidden" name="kind" value={k.key} />
            <input type="hidden" name="team" value={team} />
            <input type="hidden" name="roster_id" value={rosters.find((r) => r.is_public)?.id ?? ''} />
            <div className="text-2xl mb-1" aria-hidden>{k.icon}</div>
            <div className="font-bold text-gray-700">{k.label}</div>
            <p className="text-xs text-gray-500 mt-0.5 mb-3 flex-1">{k.blurb}</p>
            <button type="submit" className="btn btn-primary !py-1.5 text-sm">New {k.label.toLowerCase()}</button>
          </form>
        ))}
      </div>

      {forReview.length > 0 && (
        <section>
          <h2 className="font-bold text-gray-700 mb-2">Sent to you for review ({forReview.length})</h2>
          <div className="space-y-2">{forReview.map((p) => renderPlan(p, 'Review'))}</div>
        </section>
      )}
      {myDrafts.length > 0 && (
        <section>
          <h2 className="font-bold text-gray-700 mb-2">My drafts ({myDrafts.length})</h2>
          <div className="space-y-2">
            {myDrafts.map((p) => renderPlan(p, p.review_requested_at ? 'Sent for review' : 'Only you'))}
          </div>
        </section>
      )}

      {PLAN_KINDS.map(({ key, plural }) => {
        const group = plans.filter((p) => p.kind === key)
        if (group.length === 0) return null
        return (
          <section key={key}>
            <h2 className="font-bold text-gray-700 mb-2">{plural} ({group.length})</h2>
            <div className="space-y-2">
              {group.map((p) => renderPlan(p))}
            </div>
          </section>
        )
      })}

      {plans.length === 0 && myDrafts.length === 0 && (
        <div className="card p-6 text-sm text-gray-500">
          Nothing planned yet. Start a practice above — you can lay out a standard session in one
          click and edit from there.
        </div>
      )}
    </div>
  )
}
