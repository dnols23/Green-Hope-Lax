import { requireTeam } from '@/lib/permissions'
import { teamLabel } from '@/lib/teams'
import { listPlays } from '@/lib/plays'
import { getSettings, listPages } from '@/lib/playbookData'
import { Present } from './Present'

export const metadata = { title: 'Playbook — present' }
export const dynamic = 'force-dynamic'

export default async function PresentPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { viewer, team } = await requireTeam('playbook', (await searchParams).team)
  const settings = await getSettings(team)
  if (!viewer.isOwner && !settings.publishCoaches) {
    return <p className="text-sm text-gray-500">The head coach hasn&rsquo;t published this yet.</p>
  }

  const [all, plays] = await Promise.all([listPages(team), listPlays()])
  // Same rule as the deck: an assistant's copy of the deck is built without
  // the head coach's notes rather than with them and told not to look.
  const pages = viewer.isOwner ? all : all.map((p) => ({ ...p, notes: null }))
  return (
    <Present
      pages={pages}
      plays={Object.fromEntries(plays.map((p) => [p.id, { id: p.id, name: p.name, board: p.board }]))}
      title={`${teamLabel(team)} ${settings.title}`}
      showNotes={viewer.isOwner}
    />
  )
}
