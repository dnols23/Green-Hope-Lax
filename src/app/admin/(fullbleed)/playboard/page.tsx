import { requireSection, teamsFor } from '@/lib/permissions'
import { listPlays, playsReady } from '@/lib/plays'
import { PlayboardClient } from './PlayboardClient'

export const metadata = { title: 'Playboard' }
export const dynamic = 'force-dynamic'

export default async function PlayboardPage() {
  const viewer = await requireSection('playboard')
  const ready = await playsReady()
  // His own plays. The playbook still draws on every play, but that is the
  // head coach's screen and his alone.
  const plays = ready ? await listPlays(viewer.email) : []
  /* Only the head coach writes the playbook, so only he gets the button — and
     only for the sides of the program he works on, which for him is both. */
  const playbookTeams = viewer.isOwner ? teamsFor(viewer) : []
  return (
    <PlayboardClient
      ready={ready}
      playbookTeams={playbookTeams}
      plays={plays.map((p) => ({
        id: p.id,
        name: p.name,
        board: p.board,
        clip: p.clip,
        createdBy: p.createdBy,
      }))}
    />
  )
}
