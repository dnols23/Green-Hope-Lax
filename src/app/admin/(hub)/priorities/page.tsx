import { getViewer, isSandboxed, requireTeam } from '@/lib/permissions'
import { teamLabel } from '@/lib/teams'
import { PrioritiesPanel } from '../hub/PriorityRow'
import { listPriorities, prioritiesReady } from '@/lib/priorities'
import { PrioritiesClient } from './PrioritiesClient'

export const metadata = { title: 'Priorities' }
export const dynamic = 'force-dynamic'

/**
 * What the staff noticed and has not dealt with yet.
 *
 * Written down in thirty seconds on the sideline, and in front of you on Sunday
 * when the practice plan is being written — which is the only reason to write
 * it down at all.
 */
export default async function PrioritiesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  /* Whose list this is. Varsity and JV keep two, because a JV note in front of
     the varsity staff on Sunday is worse than no note at all — and a coach kept
     to one side only ever gets that one. */
  const { team, locked } = await requireTeam('priorities', (await searchParams).team)
  const ready = await prioritiesReady()
  // A sandboxed coach reads the staff's list to plan against; he doesn't change it.
  if (isSandboxed(await getViewer())) {
    const lists = ready ? await listPriorities(team) : []
    return (
      <div className="max-w-2xl">
        <h1 className="text-xl font-black mb-4">{teamLabel(team)} priorities</h1>
        <div className="card p-4">
          <PrioritiesPanel
            lists={lists.map((l) => ({ id: l.id, name: l.name, items: l.items }))}
            canWrite={false}
          />
        </div>
      </div>
    )
  }
  return (
    <PrioritiesClient
      lists={ready ? await listPriorities(team) : []}
      ready={ready}
      team={team}
      locked={locked}
    />
  )
}
