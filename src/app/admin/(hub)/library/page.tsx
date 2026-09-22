import { requireSection } from '@/lib/permissions'
import { listStaff } from '@/lib/staff'
import { listPlays, playsReady } from '@/lib/plays'
import { listShots, libraryReady } from '@/lib/library'
import { LibraryClient } from './LibraryClient'

export const metadata = { title: 'Library' }
export const dynamic = 'force-dynamic'

/**
 * Everything the staff has kept: plays drawn on the board, the takes of those
 * plays being drawn, and screenshots of the field.
 *
 * One shelf, because a coach looking for "the 1-4-1 pop" does not care whether
 * he saved it as a drawing, a recording or a picture — he wants it on the
 * screen, and then he wants it in tonight's practice plan.
 */
export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const viewer = await requireSection('library')

  /* Your shelf. The head coach can stand in front of anybody's — he is the one
     who has to know whether the staff is actually producing anything — and the
     rest of the staff only ever sees their own. */
  const asked = (await searchParams).coach
  const wanted = typeof asked === 'string' ? asked.toLowerCase() : ''
  const staff = viewer.isOwner ? await listStaff() : []
  const whose = viewer.isOwner && staff.some((s) => s.email === wanted) ? wanted : viewer.email
  const looking = viewer.isOwner && whose !== viewer.email
    ? staff.find((s) => s.email === whose)?.name ?? whose
    : null

  const [plays, shots, hasPlays, hasShots] = await Promise.all([
    playsReady().then((ok) => (ok ? listPlays(whose) : [])),
    libraryReady().then((ok) => (ok ? listShots(whose) : [])),
    playsReady(),
    libraryReady(),
  ])

  return (
    <>
      {viewer.isOwner && staff.length > 0 && (
        <form className="card p-3 mb-4 flex items-end gap-2 flex-wrap">
          <div>
            <label className="field-label">Whose shelf</label>
            <select name="coach" defaultValue={whose} className="field !py-1.5 text-sm">
              <option value={viewer.email}>Mine</option>
              {staff
                .filter((s) => s.email !== viewer.email)
                .map((s) => (
                  <option key={s.email} value={s.email}>{s.name}</option>
                ))}
            </select>
          </div>
          <button type="submit" className="btn btn-ghost !py-1.5 text-sm">Look</button>
          {looking && (
            <span className="text-xs text-gray-500">
              Looking at <strong>{looking}</strong>&rsquo;s shelf. They can&rsquo;t see yours.
            </span>
          )}
        </form>
      )}
      <LibraryClient
        plays={plays.map((p) => ({
          id: p.id,
          name: p.name,
          board: p.board,
          clip: p.clip,
          createdBy: p.createdBy,
          updatedAt: p.updatedAt,
        }))}
        shots={shots}
        ready={hasPlays && hasShots}
      />
    </>
  )
}
