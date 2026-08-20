import { requireSection } from '@/lib/permissions'
import { assertPageVisible } from '@/lib/pages'
import { VideoBoard } from '@/components/videoboard/VideoBoard'

export const metadata = { title: 'Film Room' }

/**
 * Film Room for coaches, inside the admin panel.
 *
 * The board also lives at /team/video for the parent/player Team Hub, which has
 * its own full-screen chrome and a single way out. Mounting it here instead means
 * staff keep the admin menu across the top and can move in and out of film the
 * same way they move between any other pages.
 *
 * It sits in the (fullbleed) route group, so the board runs edge to edge under
 * the menu bar and takes every pixel the bar leaves.
 */
export default async function AdminFilmRoom() {
  await requireSection('film')
  // Turned off for coaches in Admin → Pages.
  await assertPageVisible('film-coaches')

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden" style={{ background: '#0b0d0c' }}>
      <VideoBoard basePath="/admin/film" />
    </div>
  )
}
