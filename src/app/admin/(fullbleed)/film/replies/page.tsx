import { requireOwner } from '@/lib/permissions'
import { listReplyThreads } from '@/lib/clipShareData'
import { RepliesInbox } from './RepliesInbox'

export const metadata = { title: 'Film replies' }
export const dynamic = 'force-dynamic'

/** What the players, parents and coaches wrote back about the clips the head coach sent. */
export default async function FilmRepliesPage() {
  await requireOwner()
  const threads = await listReplyThreads()
  return (
    <div className="flex-1 min-h-0 overflow-y-auto" style={{ background: 'var(--surface-2)' }}>
      <div className="max-w-screen-xl mx-auto px-4 py-5">
        <RepliesInbox threads={threads} />
      </div>
    </div>
  )
}
