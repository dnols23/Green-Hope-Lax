import type { Metadata } from 'next'
import { getAwards } from '@/lib/queries'
import { assertPageVisible } from '@/lib/pages'
import type { TeamAward } from '@/lib/types'

export const metadata: Metadata = {
  title: 'Team Awards',
  description: 'Season awards and honors earned by Green Hope Falcons lacrosse players.',
}

export default async function AwardsPage() {
  await assertPageVisible('awards')
  const awards = await getAwards()

  // group by season, newest first (query already ordered)
  const bySeason = new Map<string, TeamAward[]>()
  for (const a of awards) {
    if (!bySeason.has(a.season)) bySeason.set(a.season, [])
    bySeason.get(a.season)!.push(a)
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="section-label">Falcons Lacrosse</div>
      <h1 className="page-title mb-8">Team Awards</h1>

      {bySeason.size === 0 ? (
        <p className="text-gray-500">Team awards will be posted here after the season.</p>
      ) : (
        <div className="space-y-10">
          {[...bySeason.entries()].map(([season, list]) => (
            <section key={season}>
              <h2 className="text-xl font-black mb-4" style={{ color: 'var(--gh-green)' }}>{season} Season</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {list.map((a) => (
                  <div key={a.id} className="card p-5 flex gap-4 items-center">
                    <div className="shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-2xl" style={{ background: 'linear-gradient(160deg,#fef9c3,#fde68a)' }}>
                      🏆
                    </div>
                    <div className="min-w-0">
                      <div className="text-[0.7rem] font-black tracking-wide uppercase" style={{ color: 'var(--gh-maroon)' }}>
                        {a.award}
                      </div>
                      <div className="font-bold text-lg leading-tight">{a.recipient}</div>
                      {a.description && <div className="text-sm text-gray-500">{a.description}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
