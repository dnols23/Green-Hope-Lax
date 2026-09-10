import type { Metadata } from 'next'
import { getPlayers, getPublishedRosters, getAwards } from '@/lib/queries'
import { assertPageVisible } from '@/lib/pages'
import { RosterView } from '@/components/RosterView'
import { RosterTabs } from '@/components/RosterTabs'

export const metadata: Metadata = {
  title: 'Roster',
  description: 'Player rosters for the Green Hope Falcons boys and girls lacrosse teams.',
}

export default async function RosterPage() {
  await assertPageVisible('roster')
  const [rosters, awards] = await Promise.all([getPublishedRosters(), getAwards()])
  // null means the rosters tables aren't installed; the active flag is then the
  // only list there is.
  const legacy = rosters === null ? await getPlayers() : []
  const published = (rosters ?? []).filter((r) => r.players.length > 0)

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
      {legacy.length > 0 ? (
        <RosterView players={legacy} awards={awardMap} />
      ) : published.length === 0 ? (
        <p className="text-gray-500">This season&rsquo;s roster hasn&rsquo;t been posted yet. Check back soon.</p>
      ) : published.length === 1 ? (
        <RosterView players={published[0].players} awards={awardMap} />
      ) : (
        <RosterTabs rosters={published} awards={awardMap} />
      )}
    </div>
  )
}
