import { requireSection } from '@/lib/permissions'
import { listPriorities, prioritiesReady } from '@/lib/priorities'
import { readTeam } from '@/lib/teams'
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
  await requireSection('priorities')
  /* Whose list this is. Varsity and JV keep two, because a JV note in front of
     the varsity staff on Sunday is worse than no note at all. */
  const team = readTeam((await searchParams).team)
  const ready = await prioritiesReady()
  return (
    <PrioritiesClient lists={ready ? await listPriorities(team) : []} ready={ready} team={team} />
  )
}
