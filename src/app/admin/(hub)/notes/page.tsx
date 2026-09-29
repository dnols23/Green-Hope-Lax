import Link from 'next/link'
import { requireSection, canTeam } from '@/lib/permissions'
import { canSeePlan, listPlans, plannerReady } from '@/lib/plans'
import { createPlan } from '@/lib/actions'
import { describeNote, readNoteBlocks } from '@/lib/noteBlocks'
import { formatShortDate } from '@/lib/format'
import { TEAMS, teamLabel, withTeam } from '@/lib/teams'

export const metadata = { title: 'Notes' }
export const dynamic = 'force-dynamic'

/**
 * Notes: anything written down that isn't a practice or a game plan — what to
 * say at the parent meeting, the offense ideas from the clinic. Kept apart from
 * the planner, newest first, from both teams the coach works on.
 */
export default async function NotesPage() {
  const viewer = await requireSection('planner')
  if (!(await plannerReady())) {
    return (
      <div className="max-w-2xl">
        <h1 className="text-xl font-black mb-1">Notes</h1>
        <p className="text-sm text-gray-500">The planner SQL needs to be run before notes can be kept.</p>
      </div>
    )
  }
  const teams = TEAMS.filter((t) => canTeam(viewer, t.key))
  const notes = (await Promise.all(TEAMS.map((t) => listPlans(t.key))))
    .flat()
    .filter((p) => p.kind === 'note' && canSeePlan(viewer, p))
    .sort((a, b) => (b.updated_at ?? b.created_at).localeCompare(a.updated_at ?? a.created_at))

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-end gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-black">Notes</h1>
          <p className="text-sm text-gray-500">Newest first.</p>
        </div>
        {teams.length > 0 && (
          <form action={createPlan} className="flex items-center gap-2">
            <input type="hidden" name="kind" value="note" />
            {teams.length > 1 ? (
              <select name="team" defaultValue={teams[0].key} className="field !py-1.5 !w-auto text-sm" aria-label="Which team's notes">
                {teams.map((t) => (
                  <option key={t.key} value={t.key}>{t.label}</option>
                ))}
              </select>
            ) : (
              <input type="hidden" name="team" value={teams[0].key} />
            )}
            <button type="submit" className="btn btn-primary !py-1.5">+ New note</button>
          </form>
        )}
      </div>

      {notes.length === 0 ? (
        <div className="card p-6 text-sm text-gray-500">No notes yet.</div>
      ) : (
        <div className="space-y-2">
          {notes.map((n) => {
            const line = describeNote(readNoteBlocks(n.content))
            return (
              <Link
                key={n.id}
                href={withTeam(`/admin/notes/${n.id}`, n.team)}
                className="card p-4 flex items-center gap-3 hover:shadow-md transition-shadow"
              >
                <span aria-hidden className="text-xl">📝</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-bold truncate">
                    {n.title || 'Untitled'}
                    {n.private && (
                      <span className="ml-2 align-middle text-[0.65rem] font-black uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">
                        Only you
                      </span>
                    )}
                  </span>
                  <span className="block text-xs text-gray-500">
                    {[
                      n.plan_date ? formatShortDate(`${n.plan_date}T12:00:00Z`) : null,
                      teams.length > 1 || n.team !== teams[0]?.key ? teamLabel(n.team) : null,
                      line || null,
                    ]
                      .filter(Boolean)
                      .join(' · ') || 'Empty'}
                  </span>
                </span>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
