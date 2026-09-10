import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireSection } from '@/lib/permissions'
import { getPlan } from '@/lib/plans'
import { listRosters, rosterMembers } from '@/lib/rosters'
import { deletePlan, duplicatePlan } from '@/lib/actions'
import { DeleteButton } from '@/components/admin/DeleteButton'
import { PlanEditor } from '@/components/planner/PlanEditor'
import { PLAN_KINDS } from '@/lib/planner'

export const dynamic = 'force-dynamic'

export default async function PlanPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSection('planner')
  const { id } = await params
  const plan = await getPlan(id)
  if (!plan) notFound()

  const rosters = await listRosters()
  // The roster on the plan is what fills the player strip under the field.
  const members = plan.roster_id ? await rosterMembers(plan.roster_id) : []
  const kind = PLAN_KINDS.find((k) => k.key === plan.kind)

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <Link href="/admin/planner" className="text-sm font-bold text-[var(--gh-green)]">← Planner</Link>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">{kind?.icon} {kind?.label}</span>
          <form action={duplicatePlan}>
            <input type="hidden" name="id" value={plan.id} />
            <button type="submit" className="text-xs font-bold text-gray-500 hover:text-gray-800">Duplicate</button>
          </form>
          <DeleteButton id={plan.id} action={deletePlan} label="Delete" />
        </div>
      </div>

      <PlanEditor
        plan={plan}
        rosters={rosters.map((r) => ({ id: r.id, name: r.name }))}
        players={members.map((p) => ({ id: p.id, name: p.name, number: p.number }))}
      />
    </div>
  )
}
