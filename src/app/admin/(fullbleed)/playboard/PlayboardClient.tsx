'use client'
import dynamic from 'next/dynamic'
import type { SavedPlay } from './QuickBoard'
import type { Team } from '@/lib/teams'

/**
 * The board is a browser-only thing.
 *
 * The scratch board it opens with lives in this device's storage, so rendering
 * it on the server would paint an empty field and then swap it — a flash, and a
 * hydration mismatch. The saved plays come from the database and are handed in.
 */
const QuickBoard = dynamic(() => import('./QuickBoard'), {
  ssr: false,
  loading: () => (
    <div className="flex-1 min-h-0 flex items-center justify-center text-sm text-gray-400">
      Opening the board…
    </div>
  ),
})

export function PlayboardClient({
  plays,
  ready,
  playbookTeams,
}: {
  plays: SavedPlay[]
  ready: boolean
  playbookTeams: Team[]
}) {
  return <QuickBoard plays={plays} ready={ready} playbookTeams={playbookTeams} />
}
