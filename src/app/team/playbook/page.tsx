import Link from 'next/link'
import { listPlays } from '@/lib/plays'
import { getSettings, listPages } from '@/lib/playbookData'
import { TEAMS, readTeam, teamLabel, withTeam } from '@/lib/teams'
import { SlideView } from '@/components/playbook/SlideView'

export const metadata = { title: 'Playbook' }
export const dynamic = 'force-dynamic'

/**
 * The playbook, for a player.
 *
 * Read-only, and only what the head coach has published — an unpublished deck
 * simply isn't here. His notes are never sent: the page a player gets is built
 * without them.
 */
export default async function TeamPlaybook({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const team = readTeam((await searchParams).team)
  const settings = await getSettings(team)

  // Which decks are open at all, so the other team's tab only shows when it is.
  const open = await Promise.all(
    TEAMS.map(async (t) => ({ key: t.key, on: (await getSettings(t.key)).publishPlayers }))
  )
  const others = open.filter((o) => o.on && o.key !== team)

  if (!settings.publishPlayers) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10">
        <Link href="/team" className="text-sm font-bold" style={{ color: 'var(--gh-green)' }}>← Team Hub</Link>
        <h1 className="page-title mt-2 mb-3">Playbook</h1>
        <div className="card p-6 text-sm text-gray-500">
          Nothing published yet. Your coach will put it here when it&rsquo;s ready.
        </div>
      </div>
    )
  }

  const [pages, plays] = await Promise.all([listPages(team), listPlays()])
  const playMap = Object.fromEntries(plays.map((p) => [p.id, { id: p.id, name: p.name, board: p.board }]))

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <Link href="/team" className="text-sm font-bold" style={{ color: 'var(--gh-green)' }}>← Team Hub</Link>
      <div className="flex items-center gap-2 mt-2 mb-1 flex-wrap">
        <h1 className="page-title">{teamLabel(team)} {settings.title}</h1>
        {others.map((o) => (
          <Link
            key={o.key}
            href={withTeam('/team/playbook', o.key)}
            className="text-xs font-bold px-2 py-0.5 rounded-full border border-gray-200 text-gray-500"
          >
            {teamLabel(o.key)} &rarr;
          </Link>
        ))}
      </div>
      <p className="text-gray-500 text-sm mb-6">
        What we run, in the order we install it. {pages.length} page{pages.length === 1 ? '' : 's'}.
      </p>

      {pages.length === 0 ? (
        <div className="card p-6 text-sm text-gray-500">Nothing in it yet.</div>
      ) : (
        <div className="space-y-5">
          {pages.map((page, i) => (
            <section key={page.id} className="card p-5">
              <div className="text-xs font-black text-gray-300 tabular-nums mb-2">{i + 1}</div>
              {/* Built without `notes` — what the coach says is not a player's page. */}
              <SlideView page={{ ...page, notes: null }} plays={playMap} />
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
