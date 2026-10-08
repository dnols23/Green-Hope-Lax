'use client'
import { useRouter } from 'next/navigation'
import type { SlidePlay } from '@/components/playbook/SlideView'
import type { PlaybookPage, PlaybookSection } from '@/lib/playbook'
import { withTeam, type Team } from '@/lib/teams'
import { Presenter } from './Presenter'

/**
 * The playbook on the TV in the film room.
 *
 * Esc goes back where you came from — the deck, or the slide you were
 * editing — and the address keeps up with the slide on screen, so a reload or
 * a link copied mid-meeting opens on it.
 */
export function Present({
  team,
  pages,
  plays,
  title,
  from,
  section,
  showNotes,
}: {
  team: Team
  pages: PlaybookPage[]
  plays: Record<string, SlidePlay>
  title: string
  from: string | null
  section: PlaybookSection | null
  showNotes: boolean
}) {
  const router = useRouter()

  const close = () => {
    // Opened in a tab of its own there is nothing to go back to: the deck it is.
    if (window.history.length > 1) router.back()
    else router.push(withTeam('/admin/playbook', team))
  }

  const move = (pageId: string, sec: PlaybookSection | null) => {
    const url = new URL(window.location.href)
    url.searchParams.set('from', pageId)
    if (sec) url.searchParams.set('section', sec)
    else url.searchParams.delete('section')
    window.history.replaceState(null, '', url)
  }

  return (
    <Presenter
      pages={pages}
      plays={plays}
      title={title}
      startId={from}
      section={section}
      notes={showNotes}
      tools
      onClose={close}
      onMove={move}
    />
  )
}
