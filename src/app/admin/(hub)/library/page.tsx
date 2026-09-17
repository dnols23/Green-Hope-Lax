import { requireSection } from '@/lib/permissions'
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
export default async function LibraryPage() {
  await requireSection('library')

  const [plays, shots, hasPlays, hasShots] = await Promise.all([
    playsReady().then((ok) => (ok ? listPlays() : [])),
    libraryReady().then((ok) => (ok ? listShots() : [])),
    playsReady(),
    libraryReady(),
  ])

  return (
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
  )
}
