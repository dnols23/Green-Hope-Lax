import type { Metadata } from 'next'
import { getPlayers } from '@/lib/queries'
import { RosterView } from '@/components/RosterView'

export const metadata: Metadata = { title: 'Roster' }

export default async function RosterPage() {
  const players = await getPlayers()
  return (
    <div className="max-w-screen-xl mx-auto px-4 py-10">
      <div className="section-label">Falcons Lacrosse</div>
      <h1 className="page-title mb-6">Roster</h1>
      <RosterView players={players} />
    </div>
  )
}
