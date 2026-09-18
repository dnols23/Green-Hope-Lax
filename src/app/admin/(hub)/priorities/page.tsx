import { requireSection } from '@/lib/permissions'
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
export default async function PrioritiesPage() {
  await requireSection('priorities')
  const ready = await prioritiesReady()
  return <PrioritiesClient lists={ready ? await listPriorities() : []} ready={ready} />
}
