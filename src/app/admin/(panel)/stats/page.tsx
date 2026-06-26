import { createClient } from '@/lib/supabase-server'
import { upsertProgramStat, deleteProgramStat } from '@/lib/actions'
import { DeleteButton } from '@/components/admin/DeleteButton'
import { PublishToggle } from '@/components/admin/PublishToggle'
import { STAT_SECTION_META, type ProgramStat, type StatSection } from '@/lib/types'

export const metadata = { title: 'Manage Stats' }

const SECTIONS: StatSection[] = ['records', 'leaders', 'milestones', 'honors']

function StatFields({ s }: { s?: ProgramStat }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      <div>
        <label className="field-label">Section *</label>
        <select name="section" defaultValue={s?.section ?? 'records'} className="field">
          {SECTIONS.map((sec) => (
            <option key={sec} value={sec}>{STAT_SECTION_META[sec].label}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="field-label">Label *</label>
        <input name="label" required defaultValue={s?.label ?? ''} placeholder="e.g. Most Goals (Season)" className="field" />
      </div>
      <div>
        <label className="field-label">Value</label>
        <input name="value" defaultValue={s?.value ?? ''} placeholder="e.g. 98 — Jane Doe" className="field" />
      </div>
      <div>
        <label className="field-label">Detail</label>
        <input name="detail" defaultValue={s?.detail ?? ''} placeholder="e.g. broke the previous record of 91" className="field" />
      </div>
      <div>
        <label className="field-label">Season / year</label>
        <input name="season" defaultValue={s?.season ?? ''} placeholder="e.g. 2026" className="field" />
      </div>
      <div>
        <label className="field-label">Program</label>
        <select name="gender" defaultValue={s?.gender ?? ''} className="field">
          <option value="">Whole program</option>
          <option value="boys">Boys</option>
          <option value="girls">Girls</option>
        </select>
      </div>
      <div>
        <label className="field-label">Sort order</label>
        <input type="number" name="sort_order" defaultValue={s?.sort_order ?? 0} className="field" />
      </div>
      <div>
        <label className="field-label">Published?</label>
        <select name="is_published" defaultValue={String(s?.is_published ?? true)} className="field">
          <option value="true">Yes (visible)</option>
          <option value="false">No (hidden draft)</option>
        </select>
      </div>
    </div>
  )
}

export default async function AdminStatsPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('program_stats')
    .select('*')
    .order('section', { ascending: true })
    .order('sort_order', { ascending: true })
  const stats = (data as ProgramStat[]) ?? []

  return (
    <div>
      <h1 className="text-xl font-black mb-1">Stats</h1>
      <p className="text-sm text-gray-500 mb-4">
        Season win/loss records are computed automatically from the schedule.
        Use this page to add all-time <strong>records</strong>, <strong>career leaders</strong>,{' '}
        <strong>milestones</strong>, and <strong>team honors</strong> shown on the public stats page.
      </p>

      <div className="card p-5 mb-6">
        <h2 className="font-bold text-gray-700 mb-4">Add Stat</h2>
        <form action={upsertProgramStat} className="space-y-4">
          <StatFields />
          <button type="submit" className="btn btn-primary">Add stat</button>
        </form>
      </div>

      <div className="space-y-2">
        {stats.length === 0 && <p className="text-sm text-gray-400">No stats added yet.</p>}
        {stats.map((s) => (
          <details key={s.id} className="card p-4">
            <summary className="flex items-center justify-between cursor-pointer list-none gap-3">
              <span className="font-semibold">
                <span className="text-gray-400">{STAT_SECTION_META[s.section]?.label ?? s.section} —</span> {s.label}
                {s.value && <span className="ml-2 text-gray-500">{s.value}</span>}
              </span>
              <span className="flex items-center gap-3">
                <PublishToggle entity="stat" id={s.id} live={s.is_published} />
                <DeleteButton id={s.id} action={deleteProgramStat} />
              </span>
            </summary>
            <form action={upsertProgramStat} className="mt-4 space-y-4">
              <input type="hidden" name="id" value={s.id} />
              <StatFields s={s} />
              <button type="submit" className="btn btn-primary">Save changes</button>
            </form>
          </details>
        ))}
      </div>
    </div>
  )
}
