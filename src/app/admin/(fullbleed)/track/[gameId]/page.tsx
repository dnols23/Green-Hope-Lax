import { notFound } from 'next/navigation'
import { canTeam, requireSection } from '@/lib/permissions'
import { getStatGame, listStatEvents, listStatPlayers, savedClientKeys, withFormerPlayers } from '@/lib/statsData'
import { withTeam } from '@/lib/teams'
import { TrackerClient } from '../TrackerClient'

export const metadata = { title: 'Track game' }
export const dynamic = 'force-dynamic'

/**
 * Live stat tracking for one game, full width under the menu bar so the pad
 * gets the whole phone. The game's own level is its team: a JV coach tracks
 * JV games, and anyone else with Stats can watch the log fill in.
 */
export default async function TrackGamePage({ params }: { params: Promise<{ gameId: string }> }) {
  const viewer = await requireSection('stats')
  const { gameId } = await params
  const game = await getStatGame(gameId)
  if (!game) notFound()
  const [events, roster, savedKeys] = await Promise.all([
    listStatEvents([game.id]),
    listStatPlayers(game.level),
    savedClientKeys(game.id),
  ])
  // Anyone in this game's log who is off the roster now still shows by name.
  const players = await withFormerPlayers(roster, events)
  return (
    <TrackerClient
      game={game}
      events={events}
      savedKeys={savedKeys}
      players={players}
      canWrite={canTeam(viewer, game.level)}
      backHref={withTeam('/admin/stats', game.level)}
    />
  )
}
