import { redirect } from 'next/navigation'
import { mayReadParentCalendar } from '@/lib/calendarGate'
import { feedFor, filmViewerFor, headCoachName } from '@/lib/clipShareData'
import { ClipFeed } from '@/components/film/ClipFeed'

export const metadata = { title: 'Film Room' }
export const dynamic = 'force-dynamic'

/** A parent's Film Room: the clips the coach sent the parents, or them. */
export default async function ParentFilmPage() {
  if (!(await mayReadParentCalendar())) redirect('/parents/welcome')
  const [viewer, coach] = await Promise.all([filmViewerFor('parents'), headCoachName()])
  if (!viewer) {
    return (
      <div className="card p-6 max-w-lg">
        <h1 className="font-black text-lg">Film Room</h1>
        <p className="text-sm text-gray-500 mt-1">Sign in to the Parent Hub to see the film {coach} sends you.</p>
      </div>
    )
  }
  return <ClipFeed hub="parents" clips={await feedFor(viewer)} coachName={coach} />
}
