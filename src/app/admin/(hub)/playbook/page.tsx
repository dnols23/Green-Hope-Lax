import Link from 'next/link'
import { requireTeam } from '@/lib/permissions'
import { teamLabel, withTeam } from '@/lib/teams'
import { listPlays } from '@/lib/plays'
import { listPages, getSettings, playbookReady } from '@/lib/playbookData'
import { addPlaybookPage, savePlaybookSettings } from '@/lib/playbookActions'
import { DeckGrid } from './DeckGrid'

export const metadata = { title: 'Playbook' }
export const dynamic = 'force-dynamic'

/**
 * The deck.
 *
 * The Library is a shelf — everything anybody kept, in case. This is what the
 * team actually runs, in the order it gets installed, with the words round each
 * play. The head coach writes it; everyone else reads it once he says so.
 */
export default async function PlaybookPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { viewer, team, locked } = await requireTeam('playbook', (await searchParams).team)
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

  const playMap = Object.fromEntries(plays.map((p) => [p.id, { id: p.id, name: p.name, board: p.board }]))
  /* The deck cards are a client component, so whatever is handed to them
     travels to the browser whether or not it is drawn. What the head coach
     says while a page is up is his, so for anyone else it does not go. */
  const deck = owner ? pages : pages.map((p) => ({ ...p, notes: null }))

  return (
    <div>
      <div className="flex items-center gap-2 mb-1 flex-wrap">
        <h1 className="text-xl font-black">
          {teamLabel(team)} {settings.title}
        </h1>
        {!locked && (
          <Link
            href={withTeam('/admin/playbook', team === 'varsity' ? 'jv' : 'varsity')}
            className="text-xs font-bold px-2 py-0.5 rounded-full border border-gray-200 text-gray-500 hover:border-[var(--gh-green)] hover:text-[var(--gh-green)]"
          >
            {team === 'varsity' ? 'JV' : 'Varsity'} &rarr;
          </Link>
        )}
        {pages.length > 0 && (
          <Link href={withTeam('/admin/playbook/present', team)} className="btn btn-primary !py-1.5 text-sm ml-auto">
            Present
          </Link>
        )}
      </div>
      <p className="text-gray-500 text-sm mb-5">
        {owner
          ? 'What we are actually running, in the order we install it. The Library keeps everything; this keeps what matters.'
          : `The ${teamLabel(team).toLowerCase()} playbook, as the head coach wrote it.`}
      </p>

      {!ready && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 mb-4">
          <p className="text-sm text-amber-900 font-bold mb-1">The playbook isn&rsquo;t switched on yet.</p>
          <p className="text-sm text-amber-900">
            Run <code>supabase/migrations/0036_playbook.sql</code> in the Supabase SQL editor.
            Nothing else on the site is affected.
          </p>
        </div>
      )}

      {owner && ready && (
        <details className="card p-4 mb-5">
          <summary className="cursor-pointer list-none font-bold text-gray-700 flex items-center gap-2 flex-wrap">
            <span className="caret text-sm">▸</span> Name it, and say who can read it
            <span className="font-normal text-xs text-gray-400">
              {settings.publishPlayers ? 'Players ✓' : 'Players —'} ·{' '}
              {settings.publishCoaches ? 'Coaches ✓' : 'Coaches —'}
            </span>
          </summary>
          <form action={savePlaybookSettings} className="mt-4 pt-4 border-t border-gray-100 space-y-3">
            <input type="hidden" name="team" value={team} />
            <div className="max-w-xs">
              <label className="field-label">What it&rsquo;s called</label>
              <input name="title" defaultValue={settings.title} className="field" />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="publish_coaches" defaultChecked={settings.publishCoaches} />
              The rest of the staff can read it
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="publish_players" defaultChecked={settings.publishPlayers} />
              Players can read it in the Team Hub
            </label>
            <p className="text-xs text-gray-400">
              Half-installed in a player&rsquo;s hands is worse than not there at all — so both start off.
            </p>
            <button type="submit" className="btn btn-primary text-sm">Save</button>
          </form>
        </details>
      )}

      {ready && pages.length === 0 ? (
        <div className="card p-6 text-sm text-gray-500">
          {owner ? (
            <>
              Nothing in it yet. Draw a play on the{' '}
              <Link href="/admin/playboard" className="font-bold text-[var(--gh-green)]">playboard</Link>{' '}
              and send it here, or start a page below.
            </>
          ) : (
            'Nothing in it yet.'
          )}
        </div>
      ) : (
        <DeckGrid pages={deck} plays={playMap} team={team} canEdit={owner} />
      )}

      {owner && ready && (
        <form action={addPlaybookPage} className="card p-4 mt-5 space-y-3">
          <input type="hidden" name="team" value={team} />
          <div>
            <label className="field-label" htmlFor="new-page-title">New page</label>
            <input id="new-page-title" name="title" placeholder="2-3-1 — the first look" className="field" />
          </div>
          {/* What sort of page. A field page is the field, full screen, drawn on
              directly; a words page is a title and text; a picture page is a
              photo from the phone, the computer or Drive. */}
          <div className="flex flex-wrap gap-2">
            <button type="submit" name="kind" value="field" className="btn btn-primary">🥍 Field page</button>
            <button type="submit" name="kind" value="field-half" className="btn btn-ghost">🥅 Half-field page</button>
            <button type="submit" name="kind" value="words" className="btn btn-ghost">✍️ Words page</button>
            <button type="submit" name="kind" value="picture" className="btn btn-ghost">🖼 Picture page</button>
          </div>
        </form>
      )}
    </div>
  )
}
