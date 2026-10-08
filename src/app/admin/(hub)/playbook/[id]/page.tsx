import { notFound } from 'next/navigation'
import { requireOwner } from '@/lib/permissions'
import { listPlays } from '@/lib/plays'
import { listShots } from '@/lib/library'
import { getPage, listPages } from '@/lib/playbookData'
import { SlideEditor } from './SlideEditor'

export const metadata = { title: 'Playbook page' }
export const dynamic = 'force-dynamic'

/**
 * One page of the playbook, open in the slide editor — with the rest of that
 * team's deck down the side, so the editor can move between pages without
 * coming back here.
 */
export default async function PlaybookPageEditor({ params }: { params: Promise<{ id: string }> }) {
  await requireOwner()
  const { id } = await params
  const page = await getPage(id)
  if (!page) notFound()

  const [pages, plays, shots] = await Promise.all([listPages(page.team), listPlays(), listShots()])

  return (
    <SlideEditor
      /* Keyed by team, not page: moving between pages happens in the editor,
         and the refresh after each save must not throw away what's on screen. */
      key={page.team}
      team={page.team}
      pages={pages.some((p) => p.id === page.id) ? pages : [...pages, page]}
      initialId={page.id}
      plays={plays.map((p) => ({ id: p.id, name: p.name, board: p.board, steps: p.steps?.length ?? 0 }))}
      shots={shots.map((s) => ({ id: s.id, title: s.title, url: s.url }))}
    />
  )
}
