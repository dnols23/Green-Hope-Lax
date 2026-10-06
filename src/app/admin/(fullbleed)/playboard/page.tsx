import { requireSection, teamsFor } from '@/lib/permissions'
import { listPlays, playsReady } from '@/lib/plays'
import { playbookSpots } from '@/lib/playbookData'
import { PlayboardClient } from './PlayboardClient'

export const metadata = { title: 'Playboard' }
export const dynamic = 'force-dynamic'

export default async function PlayboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const viewer = await requireSection('playboard')
  const asked = (await searchParams).play
  const ready = await playsReady()
  // His own plays. The playbook still draws on every play, but that is the
  // head coach's screen and his alone.
  const [mine, spots] = ready ? await Promise.all([listPlays(viewer.email), playbookSpots()]) : [[], {}]
  /* Opened from the Library on someone else's shelf (the head coach can look
     at anybody's): bring that one along so it opens. Saving makes it his own. */
  const extra =
    viewer.isOwner && typeof asked === 'string' && !mine.some((p) => p.id === asked)
      ? (await listPlays()).filter((p) => p.id === asked)
      : []
  const plays = [...extra, ...mine]
  /* Only the head coach writes the playbook, so only he gets the button — and
     only for the sides of the program he works on, which for him is both. */
  const playbookTeams = viewer.isOwner ? teamsFor(viewer) : []
  return (
    <PlayboardClient
      ready={ready}
      playbookTeams={playbookTeams}
      spots={spots}
      plays={plays.map((p) => ({
        id: p.id,
        name: p.name,
        board: p.board,
        clip: p.clip,
        steps: p.steps,
        createdBy: p.createdBy,
      }))}
    />
  )
}
