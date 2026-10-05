import Link from 'next/link'
import { requireSection } from '@/lib/permissions'
import { listItems, listSeries } from '@/lib/contentData'
import { createContentItem } from '@/lib/contentActions'
import {
  CONTENT_STATUSES,
  STATUS_LABELS,
  dayLabel,
  etLabel,
  etTime,
  etToday,
  etYmd,
  suggestedPost,
  type ContentItem,
  type ContentSeries,
} from '@/lib/content'
import { addDaysYmd } from '@/lib/zoned'
import { ContentTabs } from './ContentTabs'
import { StatusSelect } from './StatusSelect'

export const metadata = { title: 'Instagram' }
export const dynamic = 'force-dynamic'

export default async function ContentBoard({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireSection('social')
  const sp = await searchParams
  const [items, series] = await Promise.all([listItems(), listSeries()])

  const today = etToday()
  const weekEnd = addDaysYmd(today, 7)
  const shoot = typeof sp.shoot === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(sp.shoot) ? sp.shoot : ''
  const presetSeries = series.find((s) => s.slug === sp.series || s.id === sp.series)?.id ?? ''
  const seriesOf = (id: string | null) => series.find((s) => s.id === id) ?? null

  // The week ahead: every shoot and every post, in order.
  const week = items
    .filter((i) => i.status !== 'skipped')
    .flatMap((i) => {
      const out: { key: string; kind: 'shoot' | 'post'; day: string; item: ContentItem }[] = []
      if (i.shoot_date && i.shoot_date >= today && i.shoot_date < weekEnd) out.push({ key: `${i.shoot_date} 00:00`, kind: 'shoot', day: i.shoot_date, item: i })
      if (i.publish_at && i.status !== 'posted') {
        const d = etYmd(i.publish_at)
        if (d >= today && d < weekEnd) out.push({ key: `${d} ${i.publish_at}`, kind: 'post', day: d, item: i })
      }
      return out
    })
    .sort((a, b) => a.key.localeCompare(b.key))

  const sortKey = (i: ContentItem) => i.publish_at ?? (i.shoot_date ? `${i.shoot_date}T23:59` : '9999')
  return (
    <div className="space-y-6">
      <div>
        <ContentTabs active="board" />
        <h1 className="text-xl font-black mb-1">Content Board</h1>
        <p className="text-gray-500 text-sm">Two Reels a week: shot Tue/Thu at practice, edited in Canva, posted Thu + Sun at 7pm.</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <section className="card p-4 min-w-0">
          <h2 className="font-bold text-gray-700 mb-3">Next 7 days</h2>
          {week.length === 0 ? (
            <p className="text-sm text-gray-500">Nothing to shoot or post this week.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {week.map((w) => {
                const s = seriesOf(w.item.series_id)
                return (
                  <li key={`${w.kind}-${w.item.id}`} className="py-2 flex items-center gap-3 text-sm">
                    <span className="w-24 shrink-0 text-gray-500 text-xs font-semibold">
                      {dayLabel(w.day)}
                      {w.kind === 'post' && w.item.publish_at ? <span className="block">{etTime(w.item.publish_at)}</span> : null}
                    </span>
                    <span aria-hidden>{w.kind === 'shoot' ? '📷' : '📲'}</span>
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s?.color ?? '#9ca3af' }} />
                    <Link href={`/admin/content/${w.item.id}`} className="font-semibold hover:underline min-w-0 truncate">
                      {w.kind === 'shoot' ? 'Shoot: ' : 'Post: '}
                      {w.item.title}
                    </Link>
                    <span className="ml-auto text-xs text-gray-400 shrink-0">{STATUS_LABELS[w.item.status]}</span>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <section id="new" className="card p-4 min-w-0">
          <h2 className="font-bold text-gray-700 mb-3">+ New video</h2>
          <form action={createContentItem} className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="field-label">Series</label>
              <select name="series_id" defaultValue={presetSeries} className="field">
                <option value="">No series</option>
                {series.filter((s) => s.is_active || s.id === presetSeries).map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label">Title</label>
              <input name="title" maxLength={200} className="field" placeholder="Blank: series name + shoot day" />
            </div>
            <div>
              <label className="field-label">Shoot day</label>
              <input type="date" name="shoot_date" defaultValue={shoot} className="field" />
            </div>
            <div>
              <label className="field-label">Post time (ET)</label>
              <input type="datetime-local" name="publish_at" defaultValue={shoot ? suggestedPost(shoot) : ''} className="field" />
            </div>
            <div className="sm:col-span-2">
              <button type="submit" className="btn btn-primary">Add video</button>
            </div>
          </form>
        </section>
      </div>

      <div className="overflow-x-auto -mx-4 px-4 pb-2">
        <div className="flex gap-3 min-w-max items-start">
          {CONTENT_STATUSES.map((status) => {
            const col = items.filter((i) => i.status === status).sort((a, b) => sortKey(a).localeCompare(sortKey(b)))
            return (
              <section key={status} className="w-64 shrink-0 rounded-xl bg-gray-100/70 p-2">
                <h2 className="px-1 pb-2 text-xs font-black uppercase tracking-wider text-gray-500 flex items-center justify-between">
                  {STATUS_LABELS[status]}
                  <span className="font-semibold text-gray-400">{col.length}</span>
                </h2>
                <div className="space-y-2">
                  {col.map((i) => (
                    <Card key={i.id} item={i} series={seriesOf(i.series_id)} />
                  ))}
                  {col.length === 0 && <p className="px-1 pb-1 text-xs text-gray-400">—</p>}
                </div>
              </section>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function Card({ item: i, series }: { item: ContentItem; series: ContentSeries | null }) {
  const done = i.shot_checklist.filter((s) => s.done).length
  return (
    <article className="card p-3" style={{ borderLeft: `4px solid ${series?.color ?? '#9ca3af'}` }}>
      <Link href={`/admin/content/${i.id}`} className="font-bold text-sm leading-snug hover:underline block">
        {i.title}
      </Link>
      {series && <div className="text-[0.7rem] font-semibold mt-0.5" style={{ color: series.color }}>{series.name}</div>}
      <div className="text-xs text-gray-500 mt-1.5 space-y-0.5">
        {i.shoot_date && <div>📷 {dayLabel(i.shoot_date)}</div>}
        {i.publish_at && <div>📲 {etLabel(i.publish_at)}</div>}
        {i.shot_checklist.length > 0 && (
          <div>
            🎞 {done}/{i.shot_checklist.length} shots
          </div>
        )}
      </div>
      <div className="mt-2">
        <StatusSelect key={i.status} id={i.id} status={i.status} />
      </div>
    </article>
  )
}
