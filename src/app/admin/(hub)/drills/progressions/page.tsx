import { requireSection } from '@/lib/permissions'
import { isSandboxed } from '@/lib/sections'
import { listDrillGroups, listDrills } from '@/lib/drillsData'
import { isShortcutGroup } from '@/lib/drills'
import { listProgressions, progressionsReady } from '@/lib/progressionsData'
import { PROGRESSION_POSITIONS } from '@/lib/progressions'
import { createProgression } from '@/lib/progressionActions'
import { DrillTabs } from '../DrillTabs'
import { ProgressionCard, type DrillOption } from './ProgressionCard'

export const metadata = { title: 'Positional Progressions' }
export const dynamic = 'force-dynamic'

/**
 * Drills from the bank in a set order — a development routine for each
 * position. Built here, dropped into a practice plan as one block.
 */
export default async function ProgressionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const viewer = await requireSection('drills')
  const open = String((await searchParams).open ?? '')

  if (!(await progressionsReady())) {
    return (
      <div className="max-w-2xl">
        <DrillTabs active="progressions" />
        <h1 className="text-xl font-black mb-1">Positional Progressions</h1>
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 mt-4">
          <p className="text-sm text-amber-900">
            Run <code>supabase/migrations/0055_drill_progressions.sql</code> in the Supabase SQL editor and this page starts working.
          </p>
        </div>
      </div>
    )
  }

  const [progressions, drills, groups] = await Promise.all([listProgressions(), listDrills(), listDrillGroups()])
  const canWrite = !isSandboxed(viewer)
  const options: DrillOption[] = drills.map((d) => ({
    id: d.id,
    name: d.name,
    category: d.category,
    minutes: d.minutes,
    link: d.link,
    favorite: d.is_favorite,
  }))
  const categories = groups.filter((g) => !isShortcutGroup(g.key)).map((g) => ({ key: g.key, label: `${g.icon} ${g.label}` }))

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <DrillTabs active="progressions" />
        <h1 className="text-xl font-black mb-1">Positional Progressions</h1>
        <p className="text-gray-500 text-sm">Drills in order — a routine for each position. Insert one into any practice plan.</p>
      </div>

      {canWrite && (
        <form action={createProgression} className="card p-4 grid sm:grid-cols-6 gap-3 items-end">
          <div className="sm:col-span-3">
            <label className="field-label">New progression</label>
            <input name="name" required maxLength={120} className="field" placeholder="Dodging to the cage" />
          </div>
          <div className="sm:col-span-2">
            <label className="field-label">Position</label>
            <select name="position" className="field" defaultValue="attack">
              {PROGRESSION_POSITIONS.map((p) => (
                <option key={p.key} value={p.key}>{p.label}</option>
              ))}
            </select>
          </div>
          <div>
            <button type="submit" className="btn btn-primary w-full">Create</button>
          </div>
        </form>
      )}

      {progressions.length === 0 ? (
        <div className="card p-6 text-sm text-gray-500">No progressions yet.</div>
      ) : (
        PROGRESSION_POSITIONS.filter((pos) => progressions.some((p) => p.position === pos.key)).map((pos) => (
          <section key={pos.key} className="space-y-2">
            <h2 className="section-label">{pos.label}</h2>
            {progressions
              .filter((p) => p.position === pos.key)
              .map((p) => (
                <ProgressionCard
                  key={p.id}
                  progression={p}
                  drills={options}
                  categories={categories}
                  canWrite={canWrite}
                  startOpen={p.id === open}
                />
              ))}
          </section>
        ))
      )}
    </div>
  )
}
