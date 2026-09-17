import { requireSection } from '@/lib/permissions'
import { listPlays, playsReady } from '@/lib/plays'
import { PlayboardClient } from './PlayboardClient'

export const metadata = { title: 'Playboard' }
export const dynamic = 'force-dynamic'

export default async function PlayboardPage() {
  await requireSection('playboard')
  const ready = await playsReady()
  const plays = ready ? await listPlays() : []
  return (
    <PlayboardClient
      ready={ready}
      plays={plays.map((p) => ({ id: p.id, name: p.name, board: p.board, createdBy: p.createdBy }))}
    />
  )
}
