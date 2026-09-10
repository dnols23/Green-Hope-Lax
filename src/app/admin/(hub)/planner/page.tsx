import Link from 'next/link'
import { requireSection } from '@/lib/permissions'
import { listPlans, plannerReady } from '@/lib/plans'
import { listRosters } from '@/lib/rosters'
import { createPlan } from '@/lib/actions'
import { PLAN_KINDS, formatMinutes, totalMinutes, minutesByTag } from '@/lib/planner'
import { formatShortDate } from '@/lib/format'

export const metadata = { title: 'Planner' }
export const dynamic = 'force-dynamic'

export default async function PlannerPage() {
  await requireSection('planner')

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

  const [plans, rosters] = await Promise.all([listPlans(), listRosters()])

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-black mb-1">Planner</h1>
        <p className="text-gray-500 text-sm">
          Practices, game plans and notes. Blocks carry their own field diagrams, so what you drew on
          Tuesday is still on the plan in March.
        </p>
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        {PLAN_KINDS.map((k) => (
          <form key={k.key} action={createPlan} className="card p-4 flex flex-col">
            <input type="hidden" name="kind" value={k.key} />
            <input type="hidden" name="roster_id" value={rosters.find((r) => r.is_public)?.id ?? ''} />
            <div className="text-2xl mb-1" aria-hidden>{k.icon}</div>
            <div className="font-bold text-gray-700">{k.label}</div>
            <p className="text-xs text-gray-500 mt-0.5 mb-3 flex-1">{k.blurb}</p>
            <button type="submit" className="btn btn-primary !py-1.5 text-sm">New {k.label.toLowerCase()}</button>
          </form>
        ))}
      </div>

      {PLAN_KINDS.map(({ key, plural }) => {
        const group = plans.filter((p) => p.kind === key)
        if (group.length === 0) return null
        return (
          <section key={key}>
            <h2 className="font-bold text-gray-700 mb-2">{plural} ({group.length})</h2>
            <div className="space-y-2">
              {group.map((p) => {
                const mins = totalMinutes(p.blocks)
                const tags = minutesByTag(p.blocks)
                return (
                  <Link
                    key={p.id}
                    href={`/admin/planner/${p.id}`}
                    className="card p-4 flex items-center justify-between gap-3 hover:shadow-md transition-shadow"
                  >
                    <div className="min-w-0">
                      <div className="font-bold truncate">{p.title}</div>
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
                    <div className="text-right shrink-0">
                      <div className="text-lg font-black" style={{ color: 'var(--gh-green)' }}>
                        {formatMinutes(mins)}
                      </div>
                      <div className="text-xs text-gray-400">
                        {p.blocks.length} {p.blocks.length === 1 ? 'block' : 'blocks'}
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </section>
        )
      })}

      {plans.length === 0 && (
        <div className="card p-6 text-sm text-gray-500">
          Nothing planned yet. Start a practice above — you can lay out a standard session in one
          click and edit from there.
        </div>
      )}
    </div>
  )
}
