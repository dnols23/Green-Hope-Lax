import { redirect } from 'next/navigation'
import { mayReadTeamCalendar } from '@/lib/calendarGate'
import { feedFor, filmViewerFor, headCoachName } from '@/lib/clipShareData'
import { TeamHubShell } from '@/components/team/TeamHubShell'
import { ClipFeed } from '@/components/film/ClipFeed'

export const metadata = { title: 'Film Room' }
export const dynamic = 'force-dynamic'

/** A player's Film Room: the clips the coach sent them, ready to watch. */
export default async function TeamFilmPage() {
  if (!(await mayReadTeamCalendar())) redirect('/team/login')
  const [viewer, coach] = await Promise.all([filmViewerFor('team'), headCoachName()])
  const clips = viewer ? await feedFor(viewer) : []
  return (
    <TeamHubShell tab="film">
      {viewer ? (
        <ClipFeed hub="team" clips={clips} coachName={coach} />
      ) : (
        <div className="card p-6 max-w-lg">
          <h1 className="font-black text-lg">Film Room</h1>
          <p className="text-sm text-gray-500 mt-1">
            Sign in with your own player account to see the film {coach} sends you.
          </p>
        </div>
      )}
    </TeamHubShell>
  )
}
