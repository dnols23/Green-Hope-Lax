import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { requireSection, canTeam, isSandboxed, mayReview } from '@/lib/permissions'
import { canSeePlan, getPlan, isAuthor } from '@/lib/plans'
import { deletePlan, duplicatePlan } from '@/lib/actions'
import { DeleteButton } from '@/components/admin/DeleteButton'
import { NoteDocEditor } from '@/components/notes/NoteDocEditor'
import { planPath } from '@/lib/planner'
import { teamLabel, withTeam } from '@/lib/teams'

export const metadata = { title: 'Note' }
export const dynamic = 'force-dynamic'

export default async function NotePage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireSection('planner')
  const { id } = await params
  const plan = await getPlan(id)
  if (!plan || !canSeePlan(viewer, plan)) notFound()
  // Anything that isn't a note lives in the planner.
  if (plan.kind !== 'note') redirect(withTeam(planPath(plan), plan.team))
  const mine = isAuthor(viewer, plan)
  const reviewer = !mine && plan.private && mayReview(viewer, plan.team)
  const canWrite =
    canTeam(viewer, plan.team) &&
    (isSandboxed(viewer) ? plan.private && mine : !plan.private || mine || reviewer)

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <Link href="/admin/notes" className="text-sm font-bold text-[var(--gh-green)]">
          ← Notes
        </Link>
        <div className="flex items-center gap-3">
          {plan.team !== 'varsity' && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: '#fde8ea', color: 'var(--gh-maroon)' }}>
              {teamLabel(plan.team)}
            </span>
          )}
          {canTeam(viewer, plan.team) && (
            <form action={duplicatePlan}>
              <input type="hidden" name="id" value={plan.id} />
              <button type="submit" className="text-xs font-bold text-gray-500 hover:text-gray-800">Duplicate</button>
            </form>
          )}
          {canWrite && <DeleteButton id={plan.id} action={deletePlan} label="Delete" />}
        </div>
      </div>
      <NoteDocEditor plan={plan} canWrite={canWrite} />
    </div>
  )
}
