import Link from 'next/link'
import { requireSection } from '@/lib/permissions'
import { RECRUIT_STATUSES, isRecruitStatus, listRecruits, statusOf, type Recruit } from '@/lib/recruits'
import { addRecruit, deleteRecruit, setRecruitStatus, updateRecruit } from '@/lib/recruitActions'
import { formatShortDate } from '@/lib/format'

export const metadata = { title: 'Recruits' }
export const dynamic = 'force-dynamic'

/**
 * Recruits: kids the staff is reaching out to on X about playing lacrosse.
 * Every coach adds them and moves them along — tweeted, followed back,
 * talking, visited, joined.
 */
export default async function RecruitsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const viewer = await requireSection('recruits')
  const sp = await searchParams
  const status = isRecruitStatus(sp.status) ? sp.status : null
  const q = typeof sp.q === 'string' ? sp.q.trim().slice(0, 80) : ''
  const all = await listRecruits()

  if (all === null) {
    return (
      <div className="max-w-2xl">
        <h1 className="text-xl font-black mb-4">Recruits</h1>
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm text-amber-900">
            Run <code>supabase/migrations/0052_recruits.sql</code> in the Supabase SQL editor to start the recruits list.
          </p>
        </div>
      </div>
    )
  }

  const needle = q.toLowerCase()
  const found = needle
    ? all.filter((r) =>
        [r.name, r.school, r.sports, r.position, r.handle, r.parentName, r.coach, r.notes]
          .some((f) => f?.toLowerCase().includes(needle)),
      )
    : all
  const shown = status ? found.filter((r) => r.status === status) : found
  const count = (key: string) => found.filter((r) => r.status === key).length
  const href = (s: string | null) => {
    const p = new URLSearchParams()
    if (s) p.set('status', s)
    if (q) p.set('q', q)
    const qs = p.toString()
    return `/admin/recruits${qs ? `?${qs}` : ''}`
  }
  const chip = (on: boolean) =>
    `px-3 min-h-8 inline-flex items-center gap-1.5 rounded-full border text-xs font-bold ${
      on ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-500 hover:text-gray-900'
    }`
  const year = new Date().getFullYear()
  const years = Array.from({ length: 7 }, (_, i) => year + i)

  return (
    <div className="max-w-3xl space-y-5">
      <h1 className="text-xl font-black">Recruits</h1>

      <form action="/admin/recruits" className="flex gap-2">
        {status && <input type="hidden" name="status" value={status} />}
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search name, school, handle…"
          aria-label="Search recruits"
          className="field flex-1"
        />
        <button type="submit" className="btn btn-ghost">Search</button>
      </form>

      <div className="flex flex-wrap items-center gap-1.5">
        <Link href={href(null)} className={chip(!status)}>
          All <span className="opacity-60">{found.length}</span>
        </Link>
        {RECRUIT_STATUSES.map((s) => (
          <Link key={s.key} href={href(s.key)} className={chip(status === s.key)}>
            {s.label} <span className="opacity-60">{count(s.key)}</span>
          </Link>
        ))}
      </div>

      <details className="card p-4">
        <summary className="cursor-pointer font-bold text-[var(--gh-green)] list-none">+ Add a recruit</summary>
        <RecruitForm action={addRecruit} submit="Add" years={years} coach={viewer.name || ''} />
      </details>

      {shown.length === 0 ? (
        <p className="text-sm text-gray-400">{all.length === 0 ? 'No recruits yet.' : 'No one here.'}</p>
      ) : (
        <div className="space-y-2">
          {shown.map((r) => (
            <RecruitCard
              key={r.id}
              r={r}
              years={years}
              mayDelete={viewer.isOwner || r.addedBy?.toLowerCase() === viewer.email.toLowerCase()}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function RecruitCard({ r, years, mayDelete }: { r: Recruit; years: number[]; mayDelete: boolean }) {
  const s = statusOf(r.status)
  const at = RECRUIT_STATUSES.findIndex((x) => x.key === r.status)
  // The next step along the way; nothing past Joined or Not interested.
  const next = r.status === 'joined' || r.status === 'passed' ? null : RECRUIT_STATUSES[at + 1]
  const facts = [r.school, r.sports, r.position].filter(Boolean).join(' · ')
  return (
    <div className={`card p-4 ${r.status === 'passed' ? 'opacity-70' : ''}`}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold break-words">{r.name}</span>
            {r.gradYear && <span className="badge badge-sched">’{String(r.gradYear).slice(2)}</span>}
            <span className="badge" style={{ background: s.tone.bg, color: s.tone.fg }}>{s.label}</span>
          </div>
          {facts && <div className="text-sm text-gray-600 mt-0.5 break-words">{facts}</div>}
          <div className="text-xs text-gray-500 mt-1 flex flex-wrap gap-x-3 gap-y-1">
            {r.handle && (
              <a
                href={`https://x.com/${r.handle}`}
                target="_blank"
                rel="noreferrer"
                className="font-bold text-[var(--gh-green)]"
              >
                @{r.handle} ↗
              </a>
            )}
            {r.tweetedAt && <span>Tweeted {formatShortDate(`${r.tweetedAt}T12:00:00Z`)}</span>}
            {r.coach && <span>Coach: {r.coach}</span>}
          </div>
        </div>
        {next && (
          <form action={setRecruitStatus} className="shrink-0">
            <input type="hidden" name="id" value={r.id} />
            <input type="hidden" name="status" value={next.key} />
            <button type="submit" className="btn btn-ghost !px-3 !py-1.5 text-xs whitespace-nowrap">
              → {next.label}
            </button>
          </form>
        )}
      </div>

      {r.nextStep && (
        <p className="mt-2 text-sm">
          <span className="font-bold text-[var(--gh-maroon)]">Next: </span>
          {r.nextStep}
        </p>
      )}

      {(r.parentName || r.parentContact || r.notes) && (
        <details className="mt-3 border-t border-gray-100 pt-2">
          <summary className="cursor-pointer text-sm font-bold text-gray-600">Parent · Notes</summary>
          <div className="mt-2 space-y-2 text-sm">
            {(r.parentName || r.parentContact) && (
              <div>
                <div className="field-label">Parent</div>
                <p className="text-gray-800 break-words">{[r.parentName, r.parentContact].filter(Boolean).join(' · ')}</p>
              </div>
            )}
            {r.notes && (
              <div>
                <div className="field-label">Notes</div>
                <p className="whitespace-pre-wrap text-gray-800">{r.notes}</p>
              </div>
            )}
          </div>
        </details>
      )}

      <details className="mt-2 border-t border-gray-100 pt-2">
        <summary className="cursor-pointer text-sm font-bold text-gray-400">
          Edit <span className="font-normal">· added by {r.addedByName ?? 'a coach'}</span>
        </summary>
        <RecruitForm action={updateRecruit} r={r} submit="Save" years={years} />
        {mayDelete && (
          <form action={deleteRecruit} className="mt-2">
            <input type="hidden" name="id" value={r.id} />
            <button type="submit" className="text-xs font-bold text-[var(--gh-maroon)]">Delete</button>
          </form>
        )}
      </details>
    </div>
  )
}

function RecruitForm({
  action,
  r,
  submit,
  years,
  coach,
}: {
  action: (fd: FormData) => Promise<void>
  r?: Recruit
  submit: string
  years: number[]
  coach?: string
}) {
  const yearList = r?.gradYear && !years.includes(r.gradYear) ? [r.gradYear, ...years] : years
  return (
    <form action={action} className="mt-3 space-y-3">
      {r && <input type="hidden" name="id" value={r.id} />}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="col-span-2">
          <label className="field-label">Name</label>
          <input name="name" required defaultValue={r?.name ?? ''} className="field" maxLength={120} />
        </div>
        <div>
          <label className="field-label">Class</label>
          <select name="grad_year" defaultValue={r?.gradYear ?? ''} className="field">
            <option value="">—</option>
            {yearList.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label">Status</label>
          <select name="status" defaultValue={r?.status ?? 'identified'} className="field">
            {RECRUIT_STATUSES.map((s) => (
              <option key={s.key} value={s.key}>{s.label}</option>
            ))}
          </select>
        </div>
        <div className="col-span-2">
          <label className="field-label">X handle</label>
          <input name="handle" defaultValue={r?.handle ? `@${r.handle}` : ''} className="field" maxLength={200} placeholder="@" />
        </div>
        <div className="col-span-2">
          <label className="field-label">School</label>
          <input name="school" defaultValue={r?.school ?? ''} className="field" maxLength={120} />
        </div>
        <div className="col-span-2">
          <label className="field-label">Sports</label>
          <input name="sports" defaultValue={r?.sports ?? ''} className="field" maxLength={200} placeholder="Football, basketball" />
        </div>
        <div>
          <label className="field-label">Position</label>
          <input name="position" defaultValue={r?.position ?? ''} className="field" maxLength={60} />
        </div>
        <div>
          <label className="field-label">Coach</label>
          <input name="coach" defaultValue={r?.coach ?? coach ?? ''} className="field" maxLength={120} />
        </div>
        <div className="col-span-2">
          <label className="field-label">Parent</label>
          <input name="parent_name" defaultValue={r?.parentName ?? ''} className="field" maxLength={120} />
        </div>
        <div className="col-span-2">
          <label className="field-label">Parent phone / email</label>
          <input name="parent_contact" defaultValue={r?.parentContact ?? ''} className="field" maxLength={200} />
        </div>
      </div>
      <div>
        <label className="field-label">Next step</label>
        <input name="next_step" defaultValue={r?.nextStep ?? ''} className="field" maxLength={500} />
      </div>
      <div>
        <label className="field-label">Notes</label>
        <textarea name="notes" defaultValue={r?.notes ?? ''} rows={3} className="field" />
      </div>
      <button type="submit" className="btn btn-primary !py-1.5">{submit}</button>
    </form>
  )
}
