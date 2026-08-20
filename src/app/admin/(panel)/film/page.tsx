import { requireSection } from '@/lib/permissions'
import { VideoBoard } from '@/components/videoboard/VideoBoard'

export const metadata = { title: 'Film Room' }

/**
 * Film Room for coaches, inside the admin panel.
 *
 * The board also lives at /team/video for the parent/player Team Hub, which has
 * its own full-screen chrome and a single way out. Mounting it here instead means
 * staff keep the admin menu across the top and can move in and out of film the
 * same way they move between any other pages.
 */
export default async function AdminFilmRoom() {
  await requireSection('film')

  return (
    // Negative margins cancel the panel's page padding so the board runs to the
    // edges; the height fills whatever the nav leaves.
    <div
      className="-mx-4 -my-6 flex flex-col overflow-hidden"
      style={{ background: '#0b0d0c', height: 'calc(100svh - 4.25rem)' }}
    >
      <VideoBoard basePath="/admin/film" />
    </div>
  )
}
