import type { Metadata } from 'next'
import Link from 'next/link'
import { getProgramStats } from '@/lib/queries'
import { assertPageVisible } from '@/lib/pages'
import { STAT_SECTION_META, type ProgramStat, type StatSection } from '@/lib/types'

export const metadata: Metadata = { title: 'Record Books' }

const SECTION_ORDER: StatSection[] = ['records', 'leaders', 'milestones', 'honors']

export default async function RecordBooksPage() {
  await assertPageVisible('record-books')
  const stats = await getProgramStats()
  const bySection = (section: StatSection) => stats.filter((s) => s.section === section)

  return (
    <div className="max-w-screen-xl mx-auto px-4 py-10">
      <div className="mb-6">
        <div className="section-label">Green Hope Falcons</div>
        <h1 className="page-title">Record Books</h1>
        <p className="text-gray-500 mt-2 max-w-2xl">
          All-time program records, career leaders, milestones, and honors. For current and
          past won/loss records, see the{' '}
          <Link href="/stats" className="font-semibold" style={{ color: 'var(--gh-green)' }}>Stats</Link> page.
        </p>
      </div>

      {SECTION_ORDER.map((section) => {
        const meta = STAT_SECTION_META[section]
        const rows = bySection(section)
        if (rows.length === 0) return null
        return (
          <section key={section} className="mb-12">
            <h2 className="font-black text-xl mb-1">{meta.emoji} {meta.label}</h2>
            <p className="text-sm text-gray-500 mb-4">{meta.blurb}</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {rows.map((s) => <StatLine key={s.id} stat={s} />)}
            </div>
          </section>
        )
      })}

      {stats.length === 0 && (
        <div className="card p-8 text-center text-gray-500">
          <p className="font-semibold text-gray-700">The record book is empty.</p>
          <p className="text-sm mt-1">
            Records, career leaders, milestones, and honors can be added from
            the admin panel (Record Books).
          </p>
        </div>
      )}
    </div>
  )
}

function StatLine({ stat }: { stat: ProgramStat }) {
  return (
    <div className="card p-4">
      <div className="text-xs font-bold uppercase tracking-wide text-gray-400">
        {stat.label}
        {stat.season && <span className="ml-1 text-gray-300">· {stat.season}</span>}
      </div>
      {stat.value && <div className="text-xl font-black mt-1">{stat.value}</div>}
      {stat.detail && <div className="text-sm text-gray-500 mt-0.5">{stat.detail}</div>}
    </div>
  )
}
