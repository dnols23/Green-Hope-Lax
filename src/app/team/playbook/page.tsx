import Link from 'next/link'
import { listPlays } from '@/lib/plays'
import { getSettings, listPages } from '@/lib/playbookData'
import { TEAMS, readTeam, teamLabel, withTeam } from '@/lib/teams'
import { Study } from './Study'

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

  const [all, plays] = await Promise.all([listPages(team), listPlays()])
  // Built without `notes` (what the coach says is not a player's page) or who made each page.
  const pages = all.map((p) => ({ ...p, notes: null, createdBy: null }))
  // Only the plays the playbook shows, not every play on the staff's shelves.
  const used = new Set(pages.flatMap((p) => p.blocks.flatMap((b) => (b.kind === 'play' && b.playId ? [b.playId] : []))))
  const playMap = Object.fromEntries(
    plays.filter((p) => used.has(p.id)).map((p) => [p.id, { id: p.id, name: p.name, board: p.board }])
  )
  const title = `${teamLabel(team)} ${settings.title}`

  return (
    <div className="max-w-3xl mx-auto px-4 pt-8 pb-16">
      <Link href="/team" className="text-sm font-bold" style={{ color: 'var(--gh-green)' }}>← Team Hub</Link>
      <div className="flex items-center gap-2 mt-2 mb-1 flex-wrap">
        <h1 className="page-title">{title}</h1>
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
      <p className="text-gray-500 text-sm mb-5">What we run, in order. Tap a slide to see it full screen.</p>

      {pages.length === 0 ? (
        <div className="card p-6 text-sm text-gray-500">Nothing in it yet.</div>
      ) : (
        <Study pages={pages} plays={playMap} title={title} />
      )}
    </div>
  )
}
