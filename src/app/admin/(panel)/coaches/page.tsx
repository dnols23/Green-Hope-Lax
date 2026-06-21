import { createClient } from '@/lib/supabase-server'
import { upsertCoach, deleteCoach } from '@/lib/actions'
import { DeleteButton } from '@/components/admin/DeleteButton'
import type { Coach } from '@/lib/types'

export const metadata = { title: 'Manage Coaches' }

function CoachFields({ c }: { c?: Coach }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      <div>
        <label className="field-label">Name *</label>
        <input name="name" required defaultValue={c?.name ?? ''} className="field" />
      </div>
      <div>
        <label className="field-label">Role *</label>
        <input name="role" required defaultValue={c?.role ?? ''} placeholder="Head Coach — Boys" className="field" />
      </div>
      <div>
        <label className="field-label">Program</label>
        <select name="program" defaultValue={c?.program ?? ''} className="field">
          <option value="">Whole program</option>
          <option value="boys">Boys</option>
          <option value="girls">Girls</option>
        </select>
      </div>
      <div>
        <label className="field-label">Email</label>
        <input name="email" type="email" defaultValue={c?.email ?? ''} className="field" />
      </div>
      <div>
        <label className="field-label">Phone</label>
        <input name="phone" defaultValue={c?.phone ?? ''} className="field" />
      </div>
      <div>
        <label className="field-label">Photo URL</label>
        <input name="photo_url" defaultValue={c?.photo_url ?? ''} className="field" />
      </div>
      <div>
        <label className="field-label">Sort order</label>
        <input type="number" name="sort_order" defaultValue={c?.sort_order ?? 0} className="field" />
      </div>
      <div className="sm:col-span-2 lg:col-span-3">
        <label className="field-label">Bio</label>
        <textarea name="bio" rows={2} defaultValue={c?.bio ?? ''} className="field" />
      </div>
    </div>
  )
}

export default async function AdminCoachesPage() {
  const supabase = await createClient()
  const { data } = await supabase.from('coaches').select('*').order('sort_order')
  const coaches = (data as Coach[]) ?? []

  return (
    <div>
      <h1 className="text-xl font-black mb-4">Coaches &amp; Staff</h1>

      <div className="card p-5 mb-6">
        <h2 className="font-bold text-gray-700 mb-4">Add Coach</h2>
        <form action={upsertCoach} className="space-y-4">
          <CoachFields />
          <button type="submit" className="btn btn-primary">Add coach</button>
        </form>
      </div>

      <div className="space-y-2">
        {coaches.map((c) => (
          <details key={c.id} className="card p-4">
            <summary className="flex items-center justify-between cursor-pointer list-none gap-3">
              <span className="font-semibold">{c.name} <span className="text-xs text-gray-400">{c.role}</span></span>
              <DeleteButton id={c.id} action={deleteCoach} />
            </summary>
            <form action={upsertCoach} className="mt-4 space-y-4">
              <input type="hidden" name="id" value={c.id} />
              <CoachFields c={c} />
              <button type="submit" className="btn btn-primary">Save changes</button>
            </form>
          </details>
        ))}
      </div>
    </div>
  )
}
