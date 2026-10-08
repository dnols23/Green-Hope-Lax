import { requireTeam } from '@/lib/permissions'
import { teamLabel } from '@/lib/teams'
import { listPlays } from '@/lib/plays'
import { listPages, getSettings, playbookReady } from '@/lib/playbookData'
import { DeckGrid } from './DeckGrid'

export const metadata = { title: 'Playbook' }
export const dynamic = 'force-dynamic'

/**
 * The deck.
 *
 * The Library is a shelf — everything anybody kept, in case. This is what the
 * team actually runs, section by section, in the order it gets installed, with
 * the words round each play. Plays are made on the Playboard, kept in the
 * Library, and brought in here. The head coach writes it; everyone else reads
 * it once he says so.
 */
export default async function PlaybookPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { viewer, team } = await requireTeam('playbook', (await searchParams).team)
  const owner = viewer.isOwner

  const ready = await playbookReady()
  const [pages, settings, plays] = await Promise.all([
    ready ? listPages(team) : Promise.resolve([]),
    getSettings(team),
    listPlays(),
  ])

  // Only the coaches the head coach has let in, and only once he has.
  if (!owner && !settings.publishCoaches) {
    return (
      <div className="max-w-2xl">
        <h1 className="text-xl font-black mb-1">{teamLabel(team)} {settings.title}</h1>
        <div className="card p-6 text-sm text-gray-500 mt-4">
          The head coach hasn&rsquo;t published this yet. It&rsquo;ll appear here when he does.
        </div>
      </div>
    )
  }

  /* The grid is a client component, so whatever is handed to it travels to the
     browser whether or not it is drawn. So: no notes (what the head coach says
     while a page is up is his, and the grid never shows them anyway), only the
     plays the deck draws, and the head coach's own shelf for "From the
     Library…" — his plays and the shared ones, as the Library shows him. */
  const deck = pages.map((p) => ({ ...p, notes: null }))
  const used = new Set(deck.flatMap((p) => p.blocks.flatMap((b) => (b.kind === 'play' && b.playId ? [b.playId] : []))))
  const shelf = owner ? plays.filter((p) => !p.ownerEmail || p.ownerEmail === viewer.email) : []
  const onShelf = new Set(shelf.map((p) => p.id))
  const playMap = Object.fromEntries(
    plays
      .filter((p) => used.has(p.id) || onShelf.has(p.id))
      .map((p) => [p.id, { id: p.id, name: p.name, board: p.board }]),
  )

  return (
    <>
      {!ready && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 mb-5">
          <p className="text-sm text-amber-900 font-bold mb-1">The playbook isn&rsquo;t switched on yet.</p>
          <p className="text-sm text-amber-900">
            Run <code>supabase/migrations/0036_playbook.sql</code> in the Supabase SQL editor.
            Nothing else on the site is affected.
          </p>
        </div>
      )}
      <DeckGrid
        pages={deck}
        plays={playMap}
        shelf={shelf.map((p) => ({ id: p.id, name: p.name, steps: p.steps?.length ?? 0 }))}
        team={team}
        settings={settings}
        canEdit={owner && ready}
      />
    </>
  )
}
