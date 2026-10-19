import type { Metadata } from 'next'
import Link from 'next/link'
import { assertPageVisible } from '@/lib/pages'
import { BATTLELAX_STORE, GEAR, GEAR_DEADLINE, GEAR_MINIMUM, gearCounts } from '@/lib/gearInterest'
import { GearForm } from './GearForm'

export const metadata: Metadata = {
  title: 'Bag & Glove Head Count',
  description: 'The Green Hope Maverik gloves and bag need six orders each to be made. Tell us if you want one.',
}
export const dynamic = 'force-dynamic'

/**
 * The bag & glove head count. Six of each have to be ordered for the order to
 * go through, so families say they want one here first and everyone can see
 * how close each item is.
 */
export default async function GearHeadcountPage() {
  await assertPageVisible('shop')
  const counts = await gearCounts()

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <Link href="/shop" className="text-sm font-bold text-[var(--gh-green)]">← Team Store</Link>
      <div className="section-label mt-4">Team Store</div>
      <h1 className="page-title mb-3">Bag &amp; Glove Head Count</h1>
      <p className="text-gray-600 max-w-2xl">
        The Green Hope Maverik gloves and bag are made to order, and the order only goes through if at least{' '}
        <strong>{GEAR_MINIMUM} of each</strong> are ordered. Tell us if you want one by <strong>{GEAR_DEADLINE}</strong> and
        we’ll see if we get there. If an item doesn’t reach {GEAR_MINIMUM}, we’re sorry — it can’t be made this time.
      </p>
      <a href={BATTLELAX_STORE} target="_blank" rel="noopener noreferrer" className="inline-block mt-3 text-sm font-bold text-[var(--gh-green)]">
        See them on the BattleLax store ↗
      </a>

      {counts && (
        <div className="grid sm:grid-cols-2 gap-4 my-8">
          {GEAR.map((g) => {
            const n = counts[g.key]
            const pct = Math.min(100, (n / GEAR_MINIMUM) * 100)
            const there = n >= GEAR_MINIMUM
            return (
              <div key={g.key} className="card p-5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={g.image} alt="" className="w-28 h-28 object-contain mx-auto mb-3" />
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="font-black leading-tight">{g.name}</h2>
                  <span className="font-black" style={{ color: 'var(--gh-green)' }}>${g.price}</span>
                </div>
                <div className="mt-4 h-3 rounded-full overflow-hidden" style={{ background: 'var(--surface-2, #f3f4f6)' }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: there ? 'var(--gh-green)' : 'var(--gh-maroon)' }} />
                </div>
                <p className="text-sm mt-2 font-semibold">
                  {there ? (
                    <span style={{ color: 'var(--gh-green)' }}>✓ {n} in — the order is on</span>
                  ) : (
                    <>
                      <span className="font-black">{n}</span> of {GEAR_MINIMUM} · {GEAR_MINIMUM - n} more needed
                    </>
                  )}
                </p>
              </div>
            )
          })}
        </div>
      )}

      {counts ? (
        <GearForm />
      ) : (
        <div className="card p-6 text-gray-500">The head count opens shortly.</div>
      )}
    </div>
  )
}
