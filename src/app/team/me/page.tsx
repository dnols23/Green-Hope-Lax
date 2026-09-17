import { redirect } from 'next/navigation'
import { currentPlayer } from '@/lib/playerAccess'
import { PlayerWork } from '@/components/team/PlayerWork'

export const metadata = { title: 'My work', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

/**
 * A player's own page, reached by following his invite link — which is also how
 * it knows who is looking. Anyone who got in with the shared team password sees
 * the team feed instead: this page is nobody in particular without a link.
 */
export default async function MyWorkPage() {
  const player = await currentPlayer()
  if (!player) redirect('/team')
  return <PlayerWork player={player} />
}
