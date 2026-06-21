import type { Metadata } from 'next'
import { getGames } from '@/lib/queries'
import { ScheduleView } from '@/components/ScheduleView'

export const metadata: Metadata = { title: 'Schedule & Results' }

export default async function SchedulePage() {
  const games = await getGames()
  return (
    <div className="max-w-screen-xl mx-auto px-4 py-10">
      <div className="section-label">2026–2027 Season</div>
      <h1 className="page-title mb-6">Schedule &amp; Results</h1>
      <ScheduleView games={games} />
    </div>
  )
}
