import Link from 'next/link'
import { requireSection } from '@/lib/permissions'
import { listItems, listPractices, listSeries } from '@/lib/contentData'
import { etTime, etToday, etYmd, isMonth, monthGrid, monthLabel, shiftMonth } from '@/lib/content'
import { zonedToUtc } from '@/lib/zoned'
import { ContentTabs } from '../ContentTabs'

export const metadata = { title: 'Instagram · Calendar' }
export const dynamic = 'force-dynamic'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default async function ContentCalendar({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireSection('social')
  const today = etToday()
  const m = (await searchParams).m
  const month = isMonth(m) ? m : today.slice(0, 7)
  const next = shiftMonth(month, 1)

  const [items, series, practices] = await Promise.all([
    listItems(),
    listSeries(),
    listPractices(zonedToUtc(`${month}-01`).toISOString(), zonedToUtc(`${next}-01`).toISOString()),
  ])
  const colorOf = (id: string | null) => series.find((s) => s.id === id)?.color ?? '#6b7280'
  const live = items.filter((i) => i.status !== 'skipped')
  const shootsOn = (d: string) => live.filter((i) => i.shoot_date === d)
  const postAt = (i: (typeof items)[number]) => i.publish_at ?? i.posted_at
  const postsOn = (d: string) => live.filter((i) => postAt(i) && etYmd(postAt(i)!) === d)
  const practicesOn = (d: string) => practices.filter((p) => etYmd(p.starts_at) === d)

  return (
    <div className="space-y-4">
      <div>
        <ContentTabs active="calendar" />
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-xl font-black">{monthLabel(month)}</h1>
          <div className="flex items-center gap-1">
            <Link href={`/admin/content/calendar?m=${shiftMonth(month, -1)}`} className="btn btn-ghost !py-1 !px-3" aria-label="Previous month">‹</Link>
            <Link href="/admin/content/calendar" className="btn btn-ghost !py-1 !px-3 text-sm">Today</Link>
            <Link href={`/admin/content/calendar?m=${next}`} className="btn btn-ghost !py-1 !px-3" aria-label="Next month">›</Link>
          </div>
          <p className="text-xs text-gray-500 basis-full sm:basis-auto">
            📷 shoot · 📲 post · <span className="px-1 rounded bg-gray-100 text-gray-500">practice</span>
          </p>
        </div>
      </div>

      <div className="card p-1 sm:p-2 overflow-x-auto">
        <div className="grid grid-cols-7 min-w-[42rem]">
          {WEEKDAYS.map((w) => (
            <div key={w} className="px-1.5 py-1 text-[0.65rem] font-black uppercase tracking-wider text-gray-400">{w}</div>
          ))}
          {monthGrid(month).flat().map((d, n) => {
            if (!d) return <div key={`x${n}`} className="min-h-24 border-t border-gray-100" />
            const prac = practicesOn(d)
            return (
              <div
                key={d}
                className={`min-h-24 border-t border-gray-100 p-1 space-y-0.5 ${d === today ? 'bg-[#DFEFE7]/60' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-bold ${d === today ? 'text-[var(--gh-green)]' : 'text-gray-500'}`}>{Number(d.slice(8))}</span>
                  {prac.length > 0 && d >= today && (
                    <Link href={`/admin/content?shoot=${d}#new`} className="text-[0.65rem] font-bold text-[var(--gh-green)] hover:underline">
                      + plan
                    </Link>
                  )}
                </div>
                {prac.map((p) => (
                  <div key={p.id} className="text-[0.65rem] leading-tight px-1 py-0.5 rounded bg-gray-100 text-gray-400 truncate" title={p.title}>
                    {etTime(p.starts_at)} {p.title}
                  </div>
                ))}
                {shootsOn(d).map((i) => (
                  <Link
                    key={`s${i.id}`}
                    href={`/admin/content/${i.id}`}
                    className="block text-[0.65rem] leading-tight px-1 py-0.5 rounded border font-semibold truncate hover:underline"
                    style={{ borderColor: colorOf(i.series_id), color: colorOf(i.series_id) }}
                    title={`Shoot: ${i.title}`}
                  >
                    📷 {i.title}
                  </Link>
                ))}
                {postsOn(d).map((i) => (
                  <Link
                    key={`p${i.id}`}
                    href={`/admin/content/${i.id}`}
                    className="block text-[0.65rem] leading-tight px-1 py-0.5 rounded font-semibold text-white truncate hover:opacity-90"
                    style={{ background: colorOf(i.series_id) }}
                    title={`Post ${etTime(postAt(i)!)}: ${i.title}`}
                  >
                    📲 {etTime(postAt(i)!).replace(':00', '')} {i.title}
                  </Link>
                ))}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
