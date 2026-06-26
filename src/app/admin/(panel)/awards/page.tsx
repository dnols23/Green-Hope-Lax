import { getAwards } from '@/lib/queries'
import { upsertAward, deleteAward } from '@/lib/actions'
import { DeleteButton } from '@/components/admin/DeleteButton'
import type { TeamAward } from '@/lib/types'

export const metadata = { title: 'Manage Awards' }

function AwardFields({ a }: { a?: TeamAward }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div>
        <label className="field-label">Season *</label>
        <input name="season" required defaultValue={a?.season ?? '2026'} className="field" placeholder="2026" />
      </div>
      <div>
        <label className="field-label">Award *</label>
        <input name="award" required defaultValue={a?.award ?? ''} className="field" placeholder="Team MVP" />
      </div>
      <div>
        <label className="field-label">Recipient * (match roster name for the 🏆 icon)</label>
        <input name="recipient" required defaultValue={a?.recipient ?? ''} className="field" placeholder="Player name" />
      </div>
      <div>
        <label className="field-label">Sort order</label>
        <input type="number" name="sort_order" defaultValue={a?.sort_order ?? 0} className="field" />
      </div>
      <div className="sm:col-span-2">
        <label className="field-label">Description (optional)</label>
        <input name="description" defaultValue={a?.description ?? ''} className="field" placeholder="e.g. Male Athlete of the Year" />
      </div>
    </div>
  )
}

export default async function AdminAwardsPage() {
  const awards = await getAwards()

  return (
    <div>
      <h1 className="text-xl font-black mb-1">Team Awards</h1>
      <p className="text-gray-500 text-sm mb-6">
        Recipients whose name matches a roster player get a 🏆 icon on the roster linking to the awards page.
      </p>

      <div className="card p-5 mb-6">
        <h2 className="font-bold text-gray-700 mb-4">Add Award</h2>
        <form action={upsertAward} className="space-y-4">
          <AwardFields />
          <button type="submit" className="btn btn-primary">Add award</button>
        </form>
      </div>

      <div className="space-y-2">
        {awards.map((a) => (
          <details key={a.id} className="card p-4">
            <summary className="flex items-center justify-between cursor-pointer list-none gap-3">
              <span className="font-semibold">
                🏆 {a.award} — {a.recipient}
                <span className="ml-2 text-xs text-gray-400">{a.season}</span>
              </span>
              <DeleteButton id={a.id} action={deleteAward} />
            </summary>
            <form action={upsertAward} className="mt-4 space-y-4">
              <input type="hidden" name="id" value={a.id} />
              <AwardFields a={a} />
              <button type="submit" className="btn btn-primary">Save changes</button>
            </form>
          </details>
        ))}
      </div>
    </div>
  )
}
