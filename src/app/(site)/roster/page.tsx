import type { Metadata } from 'next'
import { getPlayers, getAwards } from '@/lib/queries'
import { assertPageVisible } from '@/lib/pages'
import { RosterView } from '@/components/RosterView'

export const metadata: Metadata = { title: 'Roster' }

export default async function RosterPage() {
  await assertPageVisible('roster')
  const [players, awards] = await Promise.all([getPlayers(), getAwards()])

  // Map lowercased recipient name → award label(s), so the roster can flag winners.
  const awardMap: Record<string, string> = {}
  for (const a of awards) {
    const key = a.recipient.toLowerCase()
    awardMap[key] = awardMap[key] ? `${awardMap[key]}, ${a.award}` : a.award
  }

  return (
    <div className="max-w-screen-xl mx-auto px-4 py-10">
      <div className="section-label">Falcons Lacrosse</div>
      <h1 className="page-title mb-6">Roster</h1>
      <RosterView players={players} awards={awardMap} />
    </div>
  )
}
