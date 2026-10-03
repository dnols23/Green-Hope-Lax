import { redirect } from 'next/navigation'
import { currentPlayer } from '@/lib/playerAccess'
import { PlayerPrintSheet } from '@/components/team/PlayerPrintSheet'

export const metadata = { title: 'Print — my work', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

/** The page a player prints and takes to the wall. */
export default async function PrintMyWork() {
  const player = await currentPlayer()
  if (!player) redirect('/team')
  return <PlayerPrintSheet player={player} />
}
