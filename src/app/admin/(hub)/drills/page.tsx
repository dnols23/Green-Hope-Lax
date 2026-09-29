import { requireSection } from '@/lib/permissions'
import { drillsReady, listDrills } from '@/lib/drillsData'
import { upsertDrill, deleteDrill, toggleDrillFavorite } from '@/lib/actions'
import { DRILL_CATEGORIES, DRILL_SETTINGS, SETTING_LABELS, isHomework, type DrillSetting } from '@/lib/drills'
import { DeleteButton } from '@/components/admin/DeleteButton'
import { DrillLink } from '@/components/admin/DrillLink'
import { DrillImport } from './DrillImport'
import { DrillSearch } from './DrillSearch'
import { DrillDiagram } from '@/components/planner/DrillDetail'
import { CompetitionDiagram } from './CompetitionDiagram'
import { listCompetitionTypes, listConsequences } from '@/lib/competitionsData'
import { removeCompetitionType, removeConsequence, saveCompetitionType, saveConsequence } from '@/lib/competitionActions'
import type { CompFormat, Consequence } from '@/lib/compete'

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

  const [drills, comps, consequences] = await Promise.all([listDrills(), listCompetitionTypes(), listConsequences()])

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h1 className="text-xl font-black mb-1">Drill Bank</h1>
        <p className="text-gray-500 text-sm">
          Every drill you run, kept once. A drill&rsquo;s link comes with it into a practice plan, so
          nobody is hunting for the video at 3:30.
        </p>
      </div>

      {drills.length > 0 && <DrillSearch listId="drill-list" />}

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
          <div className="sm:col-span-6">
            <PlacePicker chosen={['team']} />
          </div>
          <div className="sm:col-span-6">
            <label className="field-label">Video link</label>
            <input name="link" className="field" placeholder="https://… video, diagram, playbook page" />
          </div>
          <div className="sm:col-span-6">
            <label className="field-label">Link name (optional)</label>
            <input name="link_label" maxLength={80} className="field" placeholder="Watch it" />
          </div>
          {/* Three fields, because a coach who has never seen the drill needs
              three different things: how to put it out, how to run it, and
              what he is actually trying to teach. */}
          <div className="sm:col-span-6">
            <label className="field-label">Setup</label>
            <textarea name="setup" rows={2} className="field"
              placeholder="Two lines at the restraining line, 6 cones, one ball each, goalie in the cage" />
          </div>
          <div className="sm:col-span-6">
            <label className="field-label">How it runs</label>
            <textarea name="description" rows={2} className="field" placeholder="The reps, in order" />
          </div>
          <div className="sm:col-span-6">
            <label className="field-label">Why we run it</label>
            <textarea name="context" rows={2} className="field"
              placeholder="What it teaches, and what good looks like" />
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
        <div id="drill-list" className="space-y-4">
          {DRILL_CATEGORIES.map((cat) => {
            const group = drills.filter((d) => d.category === cat.key)
            if (group.length === 0) return null
            return (
              <details key={cat.key} open className="card p-4" data-drill-group>
                <summary className="cursor-pointer list-none font-bold text-gray-700 flex items-center gap-2">
                  <span className="caret text-sm">▸</span> {cat.icon} {cat.label}
                  <span className="font-normal text-xs text-gray-400">{group.length}</span>
                </summary>
                <div className="mt-3 pt-3 border-t border-gray-100 divide-y divide-gray-100">
                  {group.map((d) => (
                    <details
                      key={d.id}
                      className="py-2"
                      data-drill={[d.name, cat.label, ...d.settings.map((x) => SETTING_LABELS[x]), d.description, d.setup, d.context, d.equipment]
                        .filter(Boolean)
                        .join(' ')
                        .toLowerCase()}
                    >
                      <summary className="cursor-pointer list-none flex items-center gap-2">
                        <span className="caret text-xs text-gray-300">▸</span>
                        <span className="font-semibold text-sm">{d.name}</span>
                        {d.is_favorite && <span title="Favourite">⭐</span>}
                        {d.settings.map((place) => (
                          <span
                            key={place}
                            className="text-[0.65rem] font-bold px-1.5 py-0.5 rounded-full"
                            style={{
                              background: isHomework(place) ? '#DFEFE7' : 'var(--color-gray-100, #f3f4f6)',
                              color: isHomework(place) ? '#00512F' : 'var(--color-gray-500, #6b7280)',
                            }}
                            title={isHomework(place) ? 'Can be sent home to a player' : 'Practice or film only'}
                          >
                            {SETTING_LABELS[place]}
                          </span>
                        ))}
                        {d.link && <DrillLink href={d.link} label={d.link_label || 'Open link'} />}
                      </summary>
                      <div className="pl-6 pt-2 space-y-2">
                        {d.description && <p className="text-sm text-gray-600 whitespace-pre-line">{d.description}</p>}
                        {d.equipment && <p className="text-xs text-gray-500">Needs: {d.equipment}</p>}
                        <DrillDiagram drill={d} />
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
                          <div className="sm:col-span-6">
                            <PlacePicker chosen={d.settings} />
                          </div>
                          <div className="sm:col-span-6">
                            <label className="field-label">Video link</label>
                            <input name="link" defaultValue={d.link ?? ''} className="field !py-1.5" />
                          </div>
                          <div className="sm:col-span-6">
                            <label className="field-label">Link name (optional)</label>
                            <input name="link_label" maxLength={80} defaultValue={d.link_label ?? ''} placeholder="Watch it" className="field !py-1.5" />
                          </div>
                          <div className="sm:col-span-6">
                            <label className="field-label">Setup</label>
                            <textarea name="setup" rows={2} defaultValue={d.setup ?? ''} className="field !py-1.5"
                              placeholder="Cones, lines, balls, where the goalie stands" />
                          </div>
                          <div className="sm:col-span-6">
                            <label className="field-label">How it runs</label>
                            <textarea name="description" rows={2} defaultValue={d.description ?? ''} className="field !py-1.5" />
                          </div>
                          <div className="sm:col-span-6">
                            <label className="field-label">Why we run it</label>
                            <textarea name="context" rows={2} defaultValue={d.context ?? ''} className="field !py-1.5"
                              placeholder="What it teaches, and what good looks like" />
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
          })}
          <CompetitionsGroup comps={comps.list} ready={comps.ready} drills={drills} />
          <ConsequencesGroup list={consequences} />
        </div>
      )}
    </div>
  )
}

/**
 * The ways to compete, kept like the drills: what each one is, how it's set
 * up and run, why, a video and a diagram — and the drills it has been saved
 * to, which says what kind of drill it works for.
 */
function CompetitionsGroup({
  comps,
  ready,
  drills,
}: {
  comps: CompFormat[]
  ready: boolean
  drills: Awaited<ReturnType<typeof listDrills>>
}) {
  const savedTo = (key: string) => drills.filter((d) => d.competitions.some((c) => c.key === key))
  return (
    <details className="card p-4" data-drill-group>
      <summary className="cursor-pointer list-none font-bold text-gray-700 flex items-center gap-2">
        <span className="caret text-sm">▸</span> 🏆 Competitions
        <span className="font-normal text-xs text-gray-400">{comps.length}</span>
      </summary>
      {!ready && (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          To change these or add your own, run <code>supabase/migrations/0050_competition_types.sql</code> in the Supabase SQL editor.
        </p>
      )}
      <div className="mt-3 pt-3 border-t border-gray-100 divide-y divide-gray-100">
        {comps.map((c) => {
          const used = savedTo(c.key)
          return (
            <details
              key={c.key}
              className="py-2"
              data-drill={[c.label, c.summary, c.how, c.setup, c.why, 'competition', ...used.map((d) => d.name)].filter(Boolean).join(' ').toLowerCase()}
            >
              <summary className="cursor-pointer list-none flex items-center gap-2 flex-wrap">
                <span className="caret text-xs text-gray-300">▸</span>
                <span className="font-semibold text-sm">{c.label}</span>
                {!c.builtIn && <span className="text-[0.65rem] font-bold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">Ours</span>}
                {used.length > 0 && (
                  <span className="text-[0.65rem] font-bold px-1.5 py-0.5 rounded-full" style={{ background: '#DFEFE7', color: '#00512F' }}>
                    ★ {used.length} {used.length === 1 ? 'drill' : 'drills'}
                  </span>
                )}
                <span className="basis-full pl-5 text-xs text-gray-500">{c.summary}</span>
              </summary>
              <div className="pl-6 pt-2 space-y-3">
                <div>
                  <div className="section-label mb-1">Saved for</div>
                  {used.length === 0 ? (
                    <p className="text-sm text-gray-400">Not saved to a drill yet. Save it from a practice when it works.</p>
                  ) : (
                    <ul className="flex flex-wrap gap-1.5">
                      {used.map((d) => (
                        <li key={d.id} className="text-xs font-semibold px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                          {DRILL_CATEGORIES.find((x) => x.key === d.category)?.icon} {d.name}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                {ready && <CompetitionDiagram compKey={c.key} board={c.board} title={c.label} />}
                {ready && <CompetitionForm comp={c} />}
                {ready && (c.edited || !c.builtIn) && (
                  <form action={removeCompetitionType}>
                    <input type="hidden" name="key" value={c.key} />
                    <button type="submit" className="text-xs font-bold text-gray-400 hover:text-red-700">
                      {c.builtIn ? 'Put it back the way it came' : 'Delete this competition'}
                    </button>
                  </form>
                )}
              </div>
            </details>
          )
        })}
      </div>
      {ready && (
        <details className="mt-3 pt-3 border-t border-gray-100">
          <summary className="cursor-pointer list-none text-sm font-bold text-[var(--gh-green)]">+ Add a competition</summary>
          <div className="pt-2">
            <CompetitionForm />
          </div>
        </details>
      )}
    </details>
  )
}

function CompetitionForm({ comp }: { comp?: CompFormat }) {
  const fits = comp && comp.fits !== 'any' ? comp.fits : []
  return (
    <form action={saveCompetitionType} className="space-y-2">
      {comp && <input type="hidden" name="key" value={comp.key} />}
      <div className="grid sm:grid-cols-3 gap-2">
        <div>
          <label className="field-label">Name</label>
          <input name="label" required maxLength={60} defaultValue={comp?.label ?? ''} className="field !py-1.5" />
        </div>
        <div className="sm:col-span-2">
          <label className="field-label">What it is, in a sentence</label>
          <input name="summary" maxLength={200} defaultValue={comp?.summary ?? ''} placeholder="A race to ten points between the two sides." className="field !py-1.5" />
        </div>
      </div>
      <div>
        <label className="field-label">Setup</label>
        <textarea name="setup" rows={2} defaultValue={comp?.setup ?? ''} className="field !py-1.5 text-sm" />
      </div>
      <div>
        <label className="field-label">How it runs</label>
        <textarea name="how" rows={2} defaultValue={comp?.how ?? ''} className="field !py-1.5 text-sm" />
      </div>
      <div>
        <label className="field-label">Why we run it</label>
        <textarea name="why" rows={2} defaultValue={comp?.why ?? ''} className="field !py-1.5 text-sm" />
      </div>
      <div>
        <label className="field-label">Video link</label>
        <input name="link" type="url" defaultValue={comp?.link ?? ''} placeholder="https://" className="field !py-1.5" />
      </div>
      <div>
        <label className="field-label">Link name (optional)</label>
        <input name="link_label" maxLength={80} defaultValue={comp?.link_label ?? ''} placeholder="Watch it" className="field !py-1.5" />
      </div>
      <details>
        <summary className="cursor-pointer list-none text-xs font-bold text-gray-500">
          Suggest it for {fits.length ? `(${fits.length})` : '(any drill)'}
        </summary>
        <div className="flex flex-wrap gap-x-3 gap-y-1 pt-2">
          {DRILL_CATEGORIES.map((cat) => (
            <label key={cat.key} className="flex items-center gap-1.5 text-xs min-h-8">
              <input type="checkbox" name="fits" value={cat.key} defaultChecked={fits.includes(cat.key)} className="w-4 h-4 accent-[var(--gh-green)]" />
              {cat.icon} {cat.label}
            </label>
          ))}
        </div>
      </details>
      <button type="submit" className="btn btn-primary !py-1.5 text-sm">{comp ? 'Save' : 'Add it'}</button>
    </form>
  )
}

/**
 * What the losing side does. The ones the site ships with stay as they are;
 * the staff's own can be changed or taken off, and new ones added.
 */
function ConsequencesGroup({ list }: { list: Consequence[] }) {
  return (
    <details className="card p-4" data-drill-group>
      <summary className="cursor-pointer list-none font-bold text-gray-700 flex items-center gap-2">
        <span className="caret text-sm">▸</span> 🧹 Consequences
        <span className="font-normal text-xs text-gray-400">{list.length}</span>
      </summary>
      <p className="mt-2 text-xs text-gray-500">What the losing side does. Never running, never anything a parent emails about.</p>
      <div className="mt-2 pt-2 border-t border-gray-100 divide-y divide-gray-100">
        {list.map((c) => (
          <details key={c.key} className="py-2" data-drill={[c.label, c.summary, 'consequence'].join(' ').toLowerCase()}>
            <summary className="cursor-pointer list-none flex items-center gap-2 flex-wrap">
              <span className="caret text-xs text-gray-300">▸</span>
              <span className="font-semibold text-sm">{c.label}</span>
              {!c.builtIn && <span className="text-[0.65rem] font-bold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">Ours</span>}
              <span className="basis-full pl-5 text-xs text-gray-500">{c.summary}</span>
            </summary>
            {!c.builtIn && (
              <div className="pl-6 pt-2 space-y-2">
                <ConsequenceForm item={c} />
                <form action={removeConsequence}>
                  <input type="hidden" name="key" value={c.key} />
                  <button type="submit" className="text-xs font-bold text-gray-400 hover:text-red-700">Delete this consequence</button>
                </form>
              </div>
            )}
          </details>
        ))}
      </div>
      <details className="mt-3 pt-3 border-t border-gray-100">
        <summary className="cursor-pointer list-none text-sm font-bold text-[var(--gh-green)]">+ Add a consequence</summary>
        <div className="pt-2">
          <ConsequenceForm />
        </div>
      </details>
    </details>
  )
}

function ConsequenceForm({ item }: { item?: Consequence }) {
  return (
    <form action={saveConsequence} className="grid sm:grid-cols-3 gap-2 items-end">
      {item && <input type="hidden" name="key" value={item.key} />}
      <div>
        <label className="field-label">Name</label>
        <input name="label" required maxLength={60} defaultValue={item?.label ?? ''} placeholder="Pinnie pickup" className="field !py-1.5" />
      </div>
      <div className="sm:col-span-2">
        <label className="field-label">What the losers do, in a sentence</label>
        <input name="summary" maxLength={200} defaultValue={item?.summary ?? ''} placeholder="Losers collect and bag every pinnie." className="field !py-1.5" />
      </div>
      <div>
        <button type="submit" className="btn btn-primary !py-1.5 text-sm">{item ? 'Save' : 'Add it'}</button>
      </div>
    </form>
  )
}

/** Where a drill can be done — any of them, as many as fit. */
function PlacePicker({ chosen }: { chosen: DrillSetting[] }) {
  return (
    <fieldset>
      <legend className="field-label">Where it can be done</legend>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {DRILL_SETTINGS.map((place) => (
          <label key={place} className="flex items-center gap-2 text-sm min-h-9 cursor-pointer">
            <input
              type="checkbox"
              name="settings"
              value={place}
              defaultChecked={chosen.includes(place)}
              className="w-4 h-4 accent-[var(--gh-green)]"
            />
            {SETTING_LABELS[place]}
          </label>
        ))}
      </div>
      <p className="text-xs text-gray-500 mt-0.5">Wall, on your own and with a friend can be sent to a player as homework.</p>
    </fieldset>
  )
}
