import Link from 'next/link'
import { requireSection } from '@/lib/permissions'
import {
  WISH_KINDS,
  WISH_STATUSES,
  WISH_TEAMS,
  isWishKind,
  isWishStatus,
  listWishes,
  type WishItem,
} from '@/lib/wishlist'
import { addWish, decideWish, deleteWish, saveNextSteps, updateWish } from '@/lib/wishActions'
import { formatShortDate } from '@/lib/format'

export const metadata = { title: 'Wish List' }
export const dynamic = 'force-dynamic'

const KIND_TONE = {
  need: { bg: '#fde8ea', fg: 'var(--gh-maroon)' },
  want: { bg: '#e6f0fb', fg: '#1f5fa8' },
}

const STATUS_TONE = {
  approved: { bg: '#e3f4ea', fg: '#00512F', label: 'Approved' },
  rejected: { bg: 'var(--color-gray-100, #f3f4f6)', fg: 'var(--color-gray-500, #6b7280)', label: 'Rejected' },
}

/**
 * The program's wish list.
 *
 * Needs and wants, each with who to ask and the pitch to make. Any coach adds
 * to it; the head coach approves or rejects and keeps the next steps.
 */
export default async function WishListPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const viewer = await requireSection('wishlist')
  const sp = await searchParams
  const kind = isWishKind(sp.kind) ? sp.kind : null
  const status = isWishStatus(sp.status) ? sp.status : null
  const items = await listWishes()

  if (items === null) {
    return (
      <div className="max-w-2xl">
        <h1 className="text-xl font-black mb-4">Wish List</h1>
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm text-amber-900">
            Run <code>supabase/migrations/0044_wishlist.sql</code> in the Supabase SQL editor to start the wish list.
          </p>
        </div>
      </div>
    )
  }

  const shown = items.filter((i) => (!kind || i.kind === kind) && (!status || i.status === status))
  const href = (next: { kind?: string | null; status?: string | null }) => {
    const q = new URLSearchParams()
    const k = next.kind === undefined ? kind : next.kind
    const s = next.status === undefined ? status : next.status
    if (k) q.set('kind', k)
    if (s) q.set('status', s)
    const qs = q.toString()
    return `/admin/wishlist${qs ? `?${qs}` : ''}`
  }
  const chip = (on: boolean) =>
    `px-3 min-h-8 inline-flex items-center rounded-full border text-xs font-bold ${
      on ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-500 hover:text-gray-900'
    }`

  return (
    <div className="max-w-3xl space-y-5">
      <h1 className="text-xl font-black">Wish List</h1>

      <div className="flex flex-wrap items-center gap-1.5">
        <Link href={href({ kind: null })} className={chip(!kind)}>All</Link>
        {WISH_KINDS.map((k) => (
          <Link key={k.key} href={href({ kind: k.key })} className={chip(kind === k.key)}>
            {k.plural}
          </Link>
        ))}
        <span aria-hidden className="w-px h-5 bg-gray-200 mx-1" />
        <Link href={href({ status: null })} className={chip(!status)}>Any</Link>
        {WISH_STATUSES.map((s) => (
          <Link key={s.key} href={href({ status: s.key })} className={chip(status === s.key)}>
            {s.label}
          </Link>
        ))}
      </div>

      <details className="card p-4 group">
        <summary className="cursor-pointer font-bold text-[var(--gh-green)] list-none">+ Add to the wish list</summary>
        <WishForm action={addWish} submit="Add" />
      </details>

      {WISH_KINDS.filter((k) => !kind || k.key === kind).map((k) => {
        const group = shown.filter((i) => i.kind === k.key)
        return (
          <section key={k.key}>
            <h2 className="font-bold text-gray-700 mb-2">
              {k.plural} ({group.length})
            </h2>
            {group.length === 0 ? (
              <p className="text-sm text-gray-400">Nothing here.</p>
            ) : (
              <div className="space-y-2">
                {group.map((item) => (
                  <WishCard
                    key={item.id}
                    item={item}
                    isOwner={viewer.isOwner}
                    mayEdit={viewer.isOwner || item.addedBy?.toLowerCase() === viewer.email.toLowerCase()}
                  />
                ))}
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}

function WishCard({ item, isOwner, mayEdit }: { item: WishItem; isOwner: boolean; mayEdit: boolean }) {
  const tone = KIND_TONE[item.kind]
  const decided = item.status === 'pending' ? null : STATUS_TONE[item.status]
  const team = WISH_TEAMS.find((t) => t.key === item.team)
  return (
    <div className={`card p-4 ${item.status === 'rejected' ? 'opacity-70' : ''}`}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold break-words">{item.title}</span>
            <span className="badge" style={{ background: tone.bg, color: tone.fg }}>
              {item.kind === 'need' ? 'Need' : 'Want'}
            </span>
            {item.team !== 'program' && <span className="badge badge-sched">{team?.label}</span>}
            {decided && (
              <span className="badge" style={{ background: decided.bg, color: decided.fg }}>
                {decided.label}
              </span>
            )}
          </div>
          <div className="text-xs text-gray-500 mt-0.5 flex flex-wrap gap-x-2">
            {item.cost && <span className="font-semibold text-gray-700">{item.cost}</span>}
            {item.link && (
              <a href={item.link} target="_blank" rel="noreferrer" className="text-[var(--gh-green)] font-semibold">
                Link ↗
              </a>
            )}
            <span>
              {item.addedByName ?? 'A coach'} · {item.createdAt ? formatShortDate(item.createdAt) : ''}
            </span>
          </div>
        </div>
        {isOwner && (
          <div className="flex items-center gap-1 shrink-0">
            <form action={decideWish}>
              <input type="hidden" name="id" value={item.id} />
              <input type="hidden" name="status" value="approved" />
              <button
                type="submit"
                aria-pressed={item.status === 'approved'}
                className={`btn !px-3 !py-1.5 text-xs ${item.status === 'approved' ? 'btn-primary' : 'btn-ghost'}`}
              >
                Approve
              </button>
            </form>
            <form action={decideWish}>
              <input type="hidden" name="id" value={item.id} />
              <input type="hidden" name="status" value="rejected" />
              <button
                type="submit"
                aria-pressed={item.status === 'rejected'}
                className={`btn !px-3 !py-1.5 text-xs ${item.status === 'rejected' ? 'btn-maroon' : 'btn-ghost'}`}
              >
                Reject
              </button>
            </form>
          </div>
        )}
      </div>

      <details className="mt-3 border-t border-gray-100 pt-2">
        <summary className="cursor-pointer text-sm font-bold text-gray-600">Who to contact · The pitch</summary>
        <div className="mt-2 space-y-2 text-sm">
          <div>
            <div className="field-label">Who to contact</div>
            <p className="whitespace-pre-wrap text-gray-800">{item.contact ?? '—'}</p>
          </div>
          <div>
            <div className="field-label">The pitch</div>
            <p className="whitespace-pre-wrap text-gray-800">{item.pitch ?? '—'}</p>
          </div>
        </div>
      </details>

      {(isOwner || item.nextSteps) && (
        <details className="mt-2 border-t border-gray-100 pt-2" open={!!item.nextSteps && item.status === 'approved'}>
          <summary className="cursor-pointer text-sm font-bold text-gray-600">Next steps</summary>
          {isOwner ? (
            <form action={saveNextSteps} className="mt-2 space-y-2">
              <input type="hidden" name="id" value={item.id} />
              <textarea
                name="next_steps"
                defaultValue={item.nextSteps ?? ''}
                rows={3}
                className="field text-sm"
                aria-label="Next steps"
              />
              <button type="submit" className="btn btn-primary !py-1.5 text-sm">Save</button>
            </form>
          ) : (
            <p className="mt-2 whitespace-pre-wrap text-sm text-gray-800">{item.nextSteps}</p>
          )}
        </details>
      )}

      {mayEdit && (
        <details className="mt-2 border-t border-gray-100 pt-2">
          <summary className="cursor-pointer text-sm font-bold text-gray-400">Edit</summary>
          <WishForm action={updateWish} item={item} submit="Save" />
          <form action={deleteWish} className="mt-2">
            <input type="hidden" name="id" value={item.id} />
            <button type="submit" className="text-xs font-bold text-[var(--gh-maroon)]">Delete</button>
          </form>
        </details>
      )}
    </div>
  )
}

function WishForm({
  action,
  item,
  submit,
}: {
  action: (fd: FormData) => Promise<void>
  item?: WishItem
  submit: string
}) {
  return (
    <form action={action} className="mt-3 space-y-3">
      {item && <input type="hidden" name="id" value={item.id} />}
      <div>
        <label className="field-label">What</label>
        <input name="title" required defaultValue={item?.title ?? ''} className="field" maxLength={200} />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <label className="field-label">Need or want</label>
          <select name="kind" defaultValue={item?.kind ?? 'need'} className="field">
            {WISH_KINDS.map((k) => (
              <option key={k.key} value={k.key}>{k.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label">For</label>
          <select name="team" defaultValue={item?.team ?? 'program'} className="field">
            {WISH_TEAMS.map((t) => (
              <option key={t.key} value={t.key}>{t.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label">Cost</label>
          <input name="cost" defaultValue={item?.cost ?? ''} className="field" maxLength={80} placeholder="$" />
        </div>
        <div>
          <label className="field-label">Link</label>
          <input name="link" defaultValue={item?.link ?? ''} className="field" maxLength={500} />
        </div>
      </div>
      <div>
        <label className="field-label">Who to contact</label>
        <textarea name="contact" defaultValue={item?.contact ?? ''} rows={2} className="field" />
      </div>
      <div>
        <label className="field-label">The pitch</label>
        <textarea name="pitch" defaultValue={item?.pitch ?? ''} rows={4} className="field" />
      </div>
      <button type="submit" className="btn btn-primary !py-1.5">{submit}</button>
    </form>
  )
}
