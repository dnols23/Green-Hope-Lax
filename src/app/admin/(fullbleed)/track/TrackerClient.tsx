'use client'
import dynamic from 'next/dynamic'
import type { StatEvent, StatGame, StatPlayer } from '@/lib/stats'

/**
 * The tracker runs in the browser only.
 *
 * Stats that hadn't reached the server when the page closed are kept on the
 * phone, and the screen opens with them laid back over the server's log.
 * Rendering it on the server first would paint the log without them and then
 * swap — a flash, and a hydration mismatch.
 */
const Tracker = dynamic(() => import('./Tracker'), {
  ssr: false,
  loading: () => (
    <div className="flex-1 min-h-0 flex items-center justify-center text-sm text-gray-400">Opening the tracker…</div>
  ),
})

export function TrackerClient(props: {
  game: StatGame
  events: StatEvent[]
  savedKeys: string[]
  players: StatPlayer[]
  canWrite: boolean
  backHref: string
}) {
  return <Tracker {...props} />
}
