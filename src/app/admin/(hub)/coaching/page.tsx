import Link from 'next/link'
import { requireSection } from '@/lib/permissions'
import {
  areaSlug,
  areasOf,
  clipOf,
  listCoachingEntries,
  type CoachingArea,
  type CoachingEntry,
} from '@/lib/coachingBank'
import { addCoachingEntry, deleteCoachingEntry, moveCoachingEntry, updateCoachingEntry } from '@/lib/coachingActions'
import { SubmitButton } from '@/components/SubmitButton'
import { DeleteButton } from '@/components/admin/DeleteButton'
import { AreaField, ClipFrame } from './CoachingBits'

export const metadata = { title: 'Coaching Bank' }
export const dynamic = 'force-dynamic'

const CLIP_SOURCE = { instagram: 'Instagram', youtube: 'YouTube', vimeo: 'Vimeo' } as const

/**
 * The Coaching Bank: how we coach, area by area.
 *
 * The head coach files his philosophy here — the point in his words, the clip
 * that says it, and how it shows up on our field — and the staff go through it
 * an area at a time. Only he writes it.
 */
export default async function CoachingBankPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const viewer = await requireSection('coaching')
  const sp = await searchParams
  const entries = await listCoachingEntries()

  if (entries === null) {
    return (
      <div className="max-w-2xl">
        <h1 className="text-xl font-black mb-4">Coaching Bank</h1>
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm text-amber-900">
            Run <code>supabase/migrations/0062_coaching_bank.sql</code> in the Supabase SQL editor to start the Coaching Bank.
          </p>
        </div>
      </div>
    )
  }

  const canWrite = viewer.isOwner
  const areas = areasOf(entries)
  const inArea = (a: CoachingArea) => entries.filter((e) => areaSlug(e.area) === areaSlug(a.label))
  // The staff see the areas that have something in them; he sees every one, to fill.
  const listed = canWrite ? areas : areas.filter((a) => inArea(a).length)
  const picked = typeof sp.area === 'string' ? areas.find((a) => areaSlug(a.label) === sp.area) ?? null : null
  const shown = picked ? [picked] : listed.filter((a) => inArea(a).length)
  const chip = (on: boolean) =>
    `shrink-0 px-3 min-h-8 inline-flex items-center gap-1 rounded-full border text-xs font-bold whitespace-nowrap ${
      on ? 'bg-gray-900 text-white border-gray-900' : 'bg-white border-gray-200 text-gray-600 hover:text-gray-900'
    }`

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h1 className="text-xl font-black">Coaching Bank</h1>
        <p className="text-sm text-gray-500">How we coach, area by area.</p>
      </div>

      <nav aria-label="Areas" className="-mx-4 px-4 sm:mx-0 sm:px-0 flex sm:flex-wrap gap-1.5 overflow-x-auto pb-1">
        <Link href="/admin/coaching" className={chip(!picked)} aria-current={!picked ? 'page' : undefined}>
          All <span className="opacity-60">{entries.length}</span>
        </Link>
        {listed.map((a) => {
          const n = inArea(a).length
          const on = picked?.label === a.label
          return (
            <Link
              key={a.label}
              href={`/admin/coaching?area=${areaSlug(a.label)}`}
              className={`${chip(on)} ${!n && !on ? 'opacity-50' : ''}`}
              aria-current={on ? 'page' : undefined}
            >
              <span aria-hidden>{a.icon}</span> {a.label} {n > 0 && <span className="opacity-60">{n}</span>}
            </Link>
          )
        })}
      </nav>

      {canWrite && (
        <details className="card p-4" open={entries.length === 0}>
          <summary className="cursor-pointer font-bold text-[var(--gh-green)] list-none">＋ Add to the Coaching Bank</summary>
          <EntryForm
            action={addCoachingEntry}
            areas={areas.map((a) => a.label)}
            area={picked?.label ?? 'Culture & Standards'}
            submit="Add"
            pending="Adding…"
          />
        </details>
      )}

      {shown.length === 0 ? (
        <p className="text-sm text-gray-400">
          {picked ? 'Nothing in this area yet.' : canWrite ? 'Nothing here yet. Add the first one above.' : 'Nothing here yet.'}
        </p>
      ) : (
        shown.map((a) => {
          const list = inArea(a)
          return (
            <section key={a.label} className="space-y-3">
              <h2 className="font-black text-gray-800 flex items-center gap-2">
                <span aria-hidden>{a.icon}</span> {a.label}
                {!picked && (
                  <Link href={`/admin/coaching?area=${areaSlug(a.label)}`} className="text-xs font-bold text-gray-400 hover:text-gray-700">
                    {list.length} →
                  </Link>
                )}
              </h2>
              {list.length === 0 && <p className="text-sm text-gray-400">Nothing in this area yet.</p>}
              {list.map((e, i) => (
                <EntryCard
                  key={e.id}
                  entry={e}
                  canWrite={canWrite}
                  first={i === 0}
                  last={i === list.length - 1}
                  areas={areas.map((x) => x.label)}
                />
              ))}
            </section>
          )
        })
      )}
    </div>
  )
}

function EntryCard({
  entry,
  canWrite,
  first,
  last,
  areas,
}: {
  entry: CoachingEntry
  canWrite: boolean
  first: boolean
  last: boolean
  areas: string[]
}) {
  const clip = clipOf(entry.url)
  return (
    <article className="card p-4 sm:p-5 space-y-3">
      <div className="flex items-start gap-3">
        <h3 className="font-black text-lg leading-snug flex-1 min-w-0 break-words">{entry.title}</h3>
        {canWrite && (
          <div className="flex gap-1 shrink-0">
            {(['up', 'down'] as const).map((dir) => (
              <form key={dir} action={moveCoachingEntry}>
                <input type="hidden" name="id" value={entry.id} />
                <input type="hidden" name="dir" value={dir} />
                <button
                  type="submit"
                  disabled={dir === 'up' ? first : last}
                  aria-label={dir === 'up' ? 'Move up' : 'Move down'}
                  title={dir === 'up' ? 'Move up' : 'Move down'}
                  className="w-7 h-7 rounded-md border border-gray-200 text-xs font-black text-gray-500 hover:text-[var(--gh-green)] disabled:opacity-30"
                >
                  {dir === 'up' ? '↑' : '↓'}
                </button>
              </form>
            ))}
          </div>
        )}
      </div>

      {entry.point && (
        <blockquote
          className="border-l-4 pl-3 text-[1.05rem] leading-relaxed font-semibold text-gray-800 whitespace-pre-wrap"
          style={{ borderColor: 'var(--gh-green)' }}
        >
          {entry.point}
        </blockquote>
      )}

      {clip && <ClipFrame clip={clip} title={entry.title} />}

      {entry.notes && <p className="text-sm leading-relaxed text-gray-700 whitespace-pre-wrap">{entry.notes}</p>}

      {entry.url && (
        <a
          href={entry.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block text-xs font-bold"
          style={{ color: 'var(--gh-green)' }}
        >
          {clip ? `Open on ${CLIP_SOURCE[clip.kind]}` : 'Open link'} ↗
        </a>
      )}

      {canWrite && (
        <details className="border-t border-gray-100 pt-2">
          <summary className="cursor-pointer text-sm font-bold text-gray-400">Edit</summary>
          <EntryForm action={updateCoachingEntry} entry={entry} areas={areas} area={entry.area} submit="Save" pending="Saving…" />
          <div className="mt-3">
            <DeleteButton id={entry.id} action={deleteCoachingEntry} />
          </div>
        </details>
      )}
    </article>
  )
}

function EntryForm({
  action,
  entry,
  areas,
  area,
  submit,
  pending,
}: {
  action: (fd: FormData) => Promise<void>
  entry?: CoachingEntry
  areas: string[]
  area: string
  submit: string
  pending: string
}) {
  // An area he typed with different capitals still shows as picked.
  const value = areas.find((a) => areaSlug(a) === areaSlug(area)) ?? areas[0]
  return (
    <form action={action} className="mt-3 space-y-3">
      {entry && <input type="hidden" name="id" value={entry.id} />}
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="field-label">Area</label>
          <AreaField areas={areas} value={value} />
        </div>
        <div>
          <label className="field-label">Clip or link</label>
          <input
            name="url"
            defaultValue={entry?.url ?? ''}
            maxLength={500}
            inputMode="url"
            placeholder="Instagram, YouTube, any link"
            className="field"
          />
        </div>
      </div>
      <div>
        <label className="field-label">Title</label>
        <input
          name="title"
          required
          defaultValue={entry?.title ?? ''}
          maxLength={200}
          placeholder="Every rep counts"
          className="field"
        />
      </div>
      <div>
        <label className="field-label">The point, in your words</label>
        <textarea name="point" defaultValue={entry?.point ?? ''} rows={3} maxLength={2000} className="field" />
      </div>
      <div>
        <label className="field-label">How it shows up for us</label>
        <textarea
          name="notes"
          defaultValue={entry?.notes ?? ''}
          rows={3}
          maxLength={8000}
          placeholder="What you want your coaches to do with it"
          className="field"
        />
      </div>
      <SubmitButton className="btn btn-primary !py-1.5" pendingText={pending}>
        {submit}
      </SubmitButton>
    </form>
  )
}
