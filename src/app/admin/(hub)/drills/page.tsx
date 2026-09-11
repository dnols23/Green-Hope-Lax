import { requireSection } from '@/lib/permissions'
import { drillsReady, listDrills } from '@/lib/drillsData'
import { upsertDrill, deleteDrill, toggleDrillFavorite } from '@/lib/actions'
import { DRILL_CATEGORIES } from '@/lib/drills'
import { DeleteButton } from '@/components/admin/DeleteButton'
import { DrillImport } from './DrillImport'

export const metadata = { title: 'Drill Bank' }
export const dynamic = 'force-dynamic'

export default async function DrillBankPage() {
  await requireSection('drills')

  if (!(await drillsReady())) {
    return (
      <div className="max-w-2xl">
        <h1 className="text-xl font-black mb-1">Drill Bank</h1>
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 mt-4">
          <p className="text-sm text-amber-900 font-bold mb-1">The drill bank isn&rsquo;t switched on yet.</p>
          <p className="text-sm text-amber-900">
            Run <code>supabase/migrations/0018_drills.sql</code> in the Supabase SQL editor and this
            page starts working. Nothing else on the site is affected.
          </p>
        </div>
      </div>
    )
  }

  const drills = await listDrills()

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h1 className="text-xl font-black mb-1">Drill Bank</h1>
        <p className="text-gray-500 text-sm">
          Every drill you run, kept once. A drill&rsquo;s link comes with it into a practice plan, so
          nobody is hunting for the video at 3:30.
        </p>
      </div>

      <details className="card p-4">
        <summary className="cursor-pointer list-none font-bold text-gray-700 flex items-center gap-2">
          <span className="caret text-sm">▸</span> Add a drill
        </summary>
        <form action={upsertDrill} className="mt-4 pt-4 border-t border-gray-100 grid sm:grid-cols-6 gap-3">
          <div className="sm:col-span-3">
            <label className="field-label">Name *</label>
            <input name="name" required className="field" placeholder="West Genny" />
          </div>
          <div className="sm:col-span-2">
            <label className="field-label">Category</label>
            <select name="category" className="field">
              {DRILL_CATEGORIES.map((c) => (
                <option key={c.key} value={c.key}>{c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label">Minutes</label>
            <input type="number" name="minutes" min={0} max={240} defaultValue={10} className="field" />
          </div>
          <div className="sm:col-span-4">
            <label className="field-label">Link</label>
            <input name="link" className="field" placeholder="https://… video, diagram, playbook page" />
          </div>
          <div className="sm:col-span-2">
            <label className="field-label">Link says</label>
            <input name="link_label" className="field" placeholder="Video" />
          </div>
          <div className="sm:col-span-6">
            <label className="field-label">How it runs</label>
            <textarea name="description" rows={2} className="field" placeholder="Setup, reps, coaching points" />
          </div>
          <div className="sm:col-span-4">
            <label className="field-label">Equipment</label>
            <input name="equipment" className="field" placeholder="6 cones, 2 goals, ball bag" />
          </div>
          <div className="sm:col-span-6">
            <button type="submit" className="btn btn-primary">Add drill</button>
          </div>
        </form>
      </details>

      <DrillImport />

      {drills.length === 0 ? (
        <div className="card p-6 text-sm text-gray-500">
          No drills yet. Add one above, or paste your whole list in at once.
        </div>
      ) : (
        DRILL_CATEGORIES.map((cat) => {
          const group = drills.filter((d) => d.category === cat.key)
          if (group.length === 0) return null
          return (
            <details key={cat.key} open className="card p-4">
              <summary className="cursor-pointer list-none font-bold text-gray-700 flex items-center gap-2">
                <span className="caret text-sm">▸</span> {cat.icon} {cat.label}
                <span className="font-normal text-xs text-gray-400">{group.length}</span>
              </summary>
              <div className="mt-3 pt-3 border-t border-gray-100 divide-y divide-gray-100">
                {group.map((d) => (
                  <details key={d.id} className="py-2">
                    <summary className="cursor-pointer list-none flex items-center gap-2">
                      <span className="caret text-xs text-gray-300">▸</span>
                      <span className="font-semibold text-sm">{d.name}</span>
                      {d.is_favorite && <span title="Favourite">⭐</span>}
                      <span className="text-xs text-gray-400">{d.minutes}m</span>
                      {d.link && (
                        <a
                          href={d.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-xs font-bold ml-auto"
                          style={{ color: 'var(--gh-green)' }}
                        >
                          {d.link_label || 'Open link'} ↗
                        </a>
                      )}
                    </summary>
                    <div className="pl-6 pt-2 space-y-2">
                      {d.description && <p className="text-sm text-gray-600 whitespace-pre-line">{d.description}</p>}
                      {d.equipment && <p className="text-xs text-gray-500">Needs: {d.equipment}</p>}
                      <form action={upsertDrill} className="grid sm:grid-cols-6 gap-2 items-end">
                        <input type="hidden" name="id" value={d.id} />
                        <input type="hidden" name="is_favorite" value={String(d.is_favorite)} />
                        <div className="sm:col-span-2">
                          <label className="field-label">Name</label>
                          <input name="name" defaultValue={d.name} className="field !py-1.5" />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="field-label">Category</label>
                          <select name="category" defaultValue={d.category} className="field !py-1.5">
                            {DRILL_CATEGORIES.map((c) => (
                              <option key={c.key} value={c.key}>{c.label}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="field-label">Min</label>
                          <input type="number" name="minutes" defaultValue={d.minutes} className="field !py-1.5" />
                        </div>
                        <div className="sm:col-span-4">
                          <label className="field-label">Link</label>
                          <input name="link" defaultValue={d.link ?? ''} className="field !py-1.5" />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="field-label">Link says</label>
                          <input name="link_label" defaultValue={d.link_label ?? ''} className="field !py-1.5" />
                        </div>
                        <div className="sm:col-span-6">
                          <label className="field-label">How it runs</label>
                          <textarea name="description" rows={2} defaultValue={d.description ?? ''} className="field !py-1.5" />
                        </div>
                        <div className="sm:col-span-4">
                          <label className="field-label">Equipment</label>
                          <input name="equipment" defaultValue={d.equipment ?? ''} className="field !py-1.5" />
                        </div>
                        <div className="sm:col-span-6 flex items-center gap-3">
                          <button type="submit" className="btn btn-primary !py-1.5 text-sm">Save</button>
                        </div>
                      </form>
                      <div className="flex items-center gap-3">
                        <form action={toggleDrillFavorite}>
                          <input type="hidden" name="id" value={d.id} />
                          <input type="hidden" name="favorite" value={String(!d.is_favorite)} />
                          <button type="submit" className="text-xs font-bold text-gray-500 hover:text-gray-800">
                            {d.is_favorite ? '☆ Remove from favourites' : '⭐ Favourite'}
                          </button>
                        </form>
                        <DeleteButton id={d.id} action={deleteDrill} label="Delete drill" />
                      </div>
                    </div>
                  </details>
                ))}
              </div>
            </details>
          )
        })
      )}
    </div>
  )
}
