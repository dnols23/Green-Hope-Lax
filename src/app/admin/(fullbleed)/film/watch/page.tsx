import Link from 'next/link'
import { requireSection } from '@/lib/permissions'
import { feedFor, filmViewerFor, headCoachName } from '@/lib/clipShareData'
import { ClipFeed } from '@/components/film/ClipFeed'

export const metadata = { title: 'Film for you' }
export const dynamic = 'force-dynamic'

/** A coach's own Film Room: the clips the head coach sent the staff, or them. */
export default async function CoachFilmFeedPage() {
  await requireSection('film')
  const [viewer, coach] = await Promise.all([filmViewerFor('admin'), headCoachName()])
  const clips = viewer ? await feedFor(viewer) : []
  return (
    <div className="flex-1 min-h-0 overflow-y-auto app-theme" style={{ background: 'var(--surface-2)' }}>
      <div className="max-w-screen-xl mx-auto px-4 py-5">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h1 className="text-xl font-black">Film for you</h1>
          <Link href="/admin/film" className="btn btn-ghost !py-1.5 text-sm">
            Open the board
          </Link>
        </div>
        <ClipFeed hub="admin" clips={clips} coachName={coach} />
      </div>
    </div>
  )
}
