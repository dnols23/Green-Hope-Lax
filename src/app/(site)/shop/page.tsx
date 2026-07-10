import type { Metadata } from 'next'
import { getProducts, getShopSettings } from '@/lib/queries'
import { assertPageVisible } from '@/lib/pages'
import { FalconHead } from '@/components/Logo'
import { formatPrice, SHOP_CATEGORY_ORDER, type Product } from '@/lib/types'

export const metadata: Metadata = {
  title: 'Team Store',
  description: 'Official Green Hope Falcons Lacrosse spirit wear. Every purchase supports the team.',
}

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
          {href ? (
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
  const [products, { storeUrl, intro }] = await Promise.all([getProducts(), getShopSettings()])
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

      {products.length === 0 ? (
        <div className="card p-8 text-center text-gray-500">
          <FalconHead size={64} className="mx-auto mb-4 opacity-80" />
          <p className="font-semibold">Our team store is coming soon.</p>
          <p className="text-sm mt-1">Check back shortly for official Falcons gear.</p>
        </div>
      ) : (
        <div className="space-y-12">
          {groups.map(([category, items]) => (
            <section key={category}>
              <h2 className="text-xl font-black mb-4" style={{ color: 'var(--gh-green)' }}>{category}</h2>
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
        Gear is printed on demand by our team-store partner and ships directly to you. Prices,
        sizes, and availability are set in the store at checkout. A portion of every sale supports
        Green Hope Lacrosse. 🦅
      </p>
    </div>
  )
}
