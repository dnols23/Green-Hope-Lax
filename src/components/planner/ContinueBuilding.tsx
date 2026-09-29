import Link from 'next/link'
import { readBuilding } from '@/lib/building'
import { canSeePlan, getPlan } from '@/lib/plans'
import { PLAN_KINDS, type Plan } from '@/lib/planner'
import { doneBuilding } from '@/lib/actions'
import { withTeam, teamLabel } from '@/lib/teams'
import { ymdOf } from '@/lib/zoned'
import type { Viewer } from '@/lib/sections'

function ago(iso: string, now: number): string {
  const mins = Math.max(0, Math.round((now - Date.parse(iso)) / 60000))
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs} hr ago`
  const days = Math.round(hrs / 24)
  return days === 1 ? 'yesterday' : `${days} days ago`
}

/**
 * The plans this coach is in the middle of, newest first, so an interrupted
 * plan is one tap away. A practice or game whose day has passed drops off by
 * itself; anything else stays until he says it's done.
 */
export async function ContinueBuilding({ viewer, limit, compact = false }: { viewer: Viewer | null; limit?: number; compact?: boolean }) {
  if (!viewer) return null
  const list = await readBuilding(viewer.email)
  if (!list.length) return null
  // Dynamic server render — today decides what has already happened.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now()
  const today = ymdOf(now)
  const plans = await Promise.all(list.map((b) => getPlan(b.id).then((p) => (p ? { plan: p, at: b.at } : null))))
  const live = plans
    .filter((x): x is { plan: Plan; at: string } => !!x && canSeePlan(viewer, x.plan))
    .filter(({ plan }) => plan.kind === 'note' || !plan.plan_date || plan.plan_date >= today)
    .slice(0, limit ?? 12)
  if (!live.length) return null

  return (
    <section className={compact ? 'card p-4 mb-4' : ''}>
      <h2 className={`font-bold text-gray-700 mb-2 ${compact ? 'text-sm' : ''}`}>
        <span aria-hidden className="mr-1">🛠</span>Continue building
      </h2>
      <ul className="space-y-2">
        {live.map(({ plan, at }) => {
          const kind = PLAN_KINDS.find((k) => k.key === plan.kind)
          return (
            <li key={plan.id} className={`flex items-center gap-2 ${compact ? '' : 'card p-3'}`}>
              <Link
                href={withTeam(`/admin/planner/${plan.id}`, plan.team)}
                className="flex-1 min-w-0 flex items-center gap-3 rounded-lg hover:bg-gray-50 -m-1 p-1"
              >
                <span aria-hidden className="text-xl shrink-0">{kind?.icon ?? '📋'}</span>
                <span className="min-w-0">
                  <span className="block font-semibold truncate">{plan.title || 'Untitled'}</span>
                  <span className="block text-xs text-gray-500">
                    {[kind?.label, plan.team === 'jv' ? teamLabel('jv') : null, `worked on ${ago(at, now)}`].filter(Boolean).join(' · ')}
                  </span>
                </span>
              </Link>
              <form action={doneBuilding}>
                <input type="hidden" name="id" value={plan.id} />
                <button
                  type="submit"
                  className="min-h-9 px-3 rounded-full border text-xs font-bold text-gray-500 hover:text-[var(--gh-green)] hover:border-[var(--gh-green)]"
                  style={{ borderColor: 'var(--border)' }}
                  title="Take it off this list"
                >
                  ✓ Done
                </button>
              </form>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
