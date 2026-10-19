import type { Metadata } from 'next'
import { getProducts, getShopSettings } from '@/lib/queries'
import { assertPageVisible } from '@/lib/pages'
import { FalconHead } from '@/components/Logo'
import { formatPrice, SHOP_CATEGORY_ORDER, type Product } from '@/lib/types'
import Link from 'next/link'
import { BATTLELAX_STORE, GEAR_DEADLINE, GEAR_MINIMUM, gearCounts } from '@/lib/gearInterest'

/** A line under a store's heading — when it closes, how it works. */
const CATEGORY_NOTES: Record<string, string> = {
  'Spirit Wear': 'Falcons Team Store · closes Oct. 30 · ships 3 weeks after it closes · no exchanges or returns on custom items',
  'BattleLax Team Gear': `Made to order — at least ${GEAR_MINIMUM} of each have to be ordered. Tell us if you want one first.`,
}

/** The team stores families can buy from. Nothing is required. */
const STORES = [
  {
    key: 'spirit',
    label: 'Spirit wear',
    name: 'Falcons Team Store',
    href: 'https://greenhopelax.itemorder.com/shop/home/',
    cta: 'Shop spirit wear',
    facts: ['Store closes Oct. 30', 'Items ship 3 weeks after the store closes', 'No exchanges or returns on custom items'],
  },
  {
    key: 'battlelax',
    label: 'Team gear',
    name: 'BattleLax Green Hope Store',
    href: BATTLELAX_STORE,
    cta: 'Shop BattleLax',
    facts: ['Maverik gloves, bags and more with the Falcon', 'In stock — checkout on BattleLax'],
  },
]

export const metadata: Metadata = {
  title: 'Team Store',
  description: 'Official Green Hope Falcons Lacrosse spirit wear. Every purchase supports the team.',
}
// The head count moves as families sign up, so the page is read fresh each time.
export const dynamic = 'force-dynamic'

// Order categories by the preferred list, then any extras in first-seen order.
function groupByCategory(products: Product[]): [string, Product[]][] {
  const groups = new Map<string, Product[]>()
  for (const p of products) {
    if (!groups.has(p.category)) groups.set(p.category, [])
    groups.get(p.category)!.push(p)
  }
  const order = [...SHOP_CATEGORY_ORDER] as string[]
  return [...groups.entries()].sort(
    ([a], [b]) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99)
  )
}

function ProductCard({ p, storeUrl }: { p: Product; storeUrl: string }) {
  const href = p.buy_url || storeUrl
  return (
    <div className="card overflow-hidden flex flex-col">
      {/* Image / branded placeholder */}
      <div className="relative aspect-square bg-gray-50 flex items-center justify-center overflow-hidden">
        {p.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{ background: 'linear-gradient(160deg, var(--gh-green), var(--gh-green-dk))' }}
          >
            <FalconHead size={72} className="opacity-90" />
          </div>
        )}
        {p.badge && (
          <span
            className="absolute top-2 left-2 text-[0.65rem] font-black uppercase tracking-wide text-white px-2 py-1 rounded-full"
            style={{ background: 'var(--gh-maroon)' }}
          >
            {p.badge}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="p-4 flex flex-col flex-1">
        <h3 className="font-bold leading-tight">{p.name}</h3>
        {p.description && <p className="text-sm text-gray-500 mt-1 flex-1">{p.description}</p>}
        {p.sizes && <p className="text-xs text-gray-400 mt-2">Sizes: {p.sizes}</p>}

        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="font-black text-lg" style={{ color: 'var(--gh-green)' }}>
            {p.price != null ? (
              <>
                {p.price_note && <span className="text-xs font-semibold text-gray-400 mr-1">{p.price_note}</span>}
                {formatPrice(p.price)}
              </>
            ) : (
              <span className="text-sm font-semibold text-gray-400">See store</span>
            )}
          </span>
          {href?.startsWith('/') ? (
            // Made to order: say you want one first.
            <Link href={href} className="btn btn-maroon !py-2 !px-4 text-sm whitespace-nowrap">
              Count me in
            </Link>
          ) : href ? (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary !py-2 !px-4 text-sm whitespace-nowrap"
            >
              Buy ↗
            </a>
          ) : (
            <span className="text-xs font-semibold text-gray-400 border border-gray-200 rounded-full px-3 py-1.5 whitespace-nowrap">
              Coming soon
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

export default async function ShopPage() {
  await assertPageVisible('shop')
  const [products, { storeUrl, intro }, counts] = await Promise.all([getProducts(), getShopSettings(), gearCounts()])
  const groups = groupByCategory(products)

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="section-label">Falcons Spirit Wear</div>
      <h1 className="page-title mb-3">Team Store</h1>
      {intro && <p className="text-gray-600 max-w-2xl mb-6">{intro}</p>}

      {storeUrl && (
        <a href={storeUrl} target="_blank" rel="noopener noreferrer" className="btn btn-maroon mb-10">
          Shop the full store ↗
        </a>
      )}

      {/* The two stores we're featuring this fall. */}
      <div className="grid gap-4 md:grid-cols-2 mb-6">
        {STORES.map((st) => (
          <a
            key={st.key}
            href={st.href}
            target="_blank"
            rel="noopener noreferrer"
            className="group rounded-2xl p-6 text-white flex flex-col shadow-sm transition-transform hover:-translate-y-0.5"
            style={{
              background:
                st.key === 'spirit'
                  ? 'linear-gradient(135deg, #004D2E 0%, #00693E 70%, #2d7a55 100%)'
                  : 'linear-gradient(135deg, #1b1f1d 0%, #2b302d 60%, #004D2E 140%)',
            }}
          >
            <span className="text-xs font-black uppercase tracking-widest text-white/70">{st.label}</span>
            <span className="text-2xl font-black mt-1">{st.name}</span>
            <ul className="mt-3 space-y-1 text-sm text-white/85 flex-1">
              {st.facts.map((f) => (
                <li key={f}>• {f}</li>
              ))}
            </ul>
            <span className="mt-5 inline-flex items-center gap-2 self-start rounded-full bg-white text-[var(--gh-green-dk,#004D2E)] font-black text-sm px-4 py-2 group-hover:bg-white/90">
              {st.cta} ↗
            </span>
          </a>
        ))}
      </div>

      {/* The made-to-order gear only happens at six of each. */}
      <Link
        href="/shop/headcount"
        className="card p-5 mb-12 flex flex-col sm:flex-row sm:items-center gap-4 border-2 hover:shadow-md transition-shadow"
        style={{ borderColor: 'var(--gh-maroon)' }}
      >
        <div className="flex-1">
          <div className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--gh-maroon)' }}>
            Head count · by {GEAR_DEADLINE}
          </div>
          <div className="font-black text-lg mt-0.5">Want the Green Hope Maverik gloves or bag?</div>
          <p className="text-sm text-gray-600 mt-1">
            They’re made to order — at least {GEAR_MINIMUM} of each have to be ordered for the order to go through. Tell us if you want one.
            {counts && ` Gloves ${Math.min(counts.gloves, 99)} of ${GEAR_MINIMUM} · Bags ${Math.min(counts.bag, 99)} of ${GEAR_MINIMUM}.`}
          </p>
        </div>
        <span className="btn btn-maroon whitespace-nowrap self-start sm:self-center">Count me in →</span>
      </Link>

      {products.length === 0 ? (
        null
      ) : (
        <div className="space-y-12">
          {groups.map(([category, items]) => (
            <section key={category}>
              <h2 className="text-xl font-black" style={{ color: 'var(--gh-green)' }}>{category}</h2>
              <p className="text-sm text-gray-500 mb-4">{CATEGORY_NOTES[category] ?? ''}</p>
              <div className="grid gap-5 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {items.map((p) => (
                  <ProductCard key={p.id} p={p} storeUrl={storeUrl} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <p className="text-xs text-gray-400 mt-12 max-w-2xl">
        Nothing here is required. Every item is bought and shipped through the store it comes from, and
        prices, sizes and availability are set there at checkout. 🦅
      </p>
    </div>
  )
}
