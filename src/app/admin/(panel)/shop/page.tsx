import { createClient } from '@/lib/supabase-server'
import { upsertProduct, deleteProduct, saveShopSettings } from '@/lib/actions'
import { getShopSettings } from '@/lib/queries'
import { DeleteButton } from '@/components/admin/DeleteButton'
import { PublishToggle } from '@/components/admin/PublishToggle'
import { formatPrice, SHOP_CATEGORY_ORDER, type Product } from '@/lib/types'

export const metadata = { title: 'Manage Shop' }

const CATEGORIES = [...SHOP_CATEGORY_ORDER, 'Apparel', 'Other']

function ProductFields({ p }: { p?: Product }) {
  return (
    <div className="space-y-3">
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <label className="field-label">Product name *</label>
          <input name="name" required defaultValue={p?.name ?? ''} className="field" />
        </div>
        <div>
          <label className="field-label">Category</label>
          <input name="category" list="shop-categories" defaultValue={p?.category ?? 'Apparel'} className="field" />
          <datalist id="shop-categories">
            {CATEGORIES.map((c) => <option key={c} value={c} />)}
          </datalist>
        </div>
        <div>
          <label className="field-label">Badge (optional)</label>
          <input name="badge" defaultValue={p?.badge ?? ''} placeholder="Best Seller, New…" className="field" />
        </div>
        <div>
          <label className="field-label">Price (USD)</label>
          <input name="price" type="number" step="0.01" min="0" defaultValue={p?.price ?? ''} placeholder="45.00" className="field" />
        </div>
        <div>
          <label className="field-label">Price note (optional)</label>
          <input name="price_note" defaultValue={p?.price_note ?? ''} placeholder="from, + tax at checkout…" className="field" />
        </div>
        <div>
          <label className="field-label">Sizes (optional)</label>
          <input name="sizes" defaultValue={p?.sizes ?? ''} placeholder="YM, YL, S, M, L, XL, 2XL" className="field" />
        </div>
        <div>
          <label className="field-label">Sort order</label>
          <input name="sort_order" type="number" defaultValue={p?.sort_order ?? 0} className="field" />
        </div>
        <div className="sm:col-span-2">
          <label className="field-label">Photo URL (optional)</label>
          <input name="image_url" defaultValue={p?.image_url ?? ''} placeholder="https://… (paste the vendor's product image)" className="field" />
        </div>
        <div className="sm:col-span-2">
          <label className="field-label">Buy link (vendor product page)</label>
          <input name="buy_url" defaultValue={p?.buy_url ?? ''} placeholder="https://… (leave blank to use the main store link)" className="field" />
        </div>
        <div>
          <label className="field-label">Published?</label>
          <select name="is_published" defaultValue={String(p?.is_published ?? true)} className="field">
            <option value="true">Live on the store</option>
            <option value="false">Hidden</option>
          </select>
        </div>
      </div>
      <div>
        <label className="field-label">Description (optional)</label>
        <textarea name="description" rows={2} defaultValue={p?.description ?? ''} className="field" />
      </div>
    </div>
  )
}

export default async function AdminShopPage() {
  const supabase = await createClient()
  const [{ data }, settings] = await Promise.all([
    supabase.from('products').select('*').order('sort_order', { ascending: true }).order('created_at', { ascending: true }),
    getShopSettings(),
  ])
  const products = (data as Product[]) ?? []

  return (
    <div>
      <h1 className="text-xl font-black mb-1">Team Store</h1>
      <p className="text-sm text-gray-500 mb-6">
        Products you add here show on the public <strong>/shop</strong> page. Each “Buy” button
        links out to your print-on-demand store, which takes payment and ships — the team keeps
        the fundraising markup.
      </p>

      {/* Store-wide settings */}
      <div className="card p-5 mb-6">
        <h2 className="font-bold text-gray-700 mb-1">Store link &amp; intro</h2>
        <p className="text-xs text-gray-400 mb-4">
          The main “Shop the full store” button and the blurb at the top of the shop page. Set the
          store link once you’ve created your vendor store (SquadLocker, Bonfire, Custom Ink, etc.).
        </p>
        <form action={saveShopSettings} className="space-y-3">
          <div>
            <label className="field-label">Full store URL</label>
            <input name="store_url" defaultValue={settings.storeUrl} placeholder="https://your-team.squadlocker.com" className="field" />
          </div>
          <div>
            <label className="field-label">Shop page intro</label>
            <textarea name="intro" rows={2} defaultValue={settings.intro} className="field" />
          </div>
          <button type="submit" className="btn btn-primary">Save store settings</button>
        </form>
      </div>

      {/* Add product */}
      <div className="card p-5 mb-6">
        <h2 className="font-bold text-gray-700 mb-4">Add Product</h2>
        <form action={upsertProduct} className="space-y-4">
          <ProductFields />
          <button type="submit" className="btn btn-primary">Add product</button>
        </form>
      </div>

      {/* Product list */}
      <div className="space-y-2">
        {products.length === 0 && (
          <div className="card p-6 text-sm text-gray-500">
            No products yet. Run <code>supabase/migrations/0008_shop.sql</code> to seed the starter
            catalog, or add products above.
          </div>
        )}
        {products.map((p) => (
          <details key={p.id} className="card p-4">
            <summary className="flex items-center justify-between cursor-pointer list-none gap-3">
              <span className="font-semibold flex items-center gap-2 min-w-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {p.image_url && <img src={p.image_url} alt="" className="w-8 h-8 rounded object-cover shrink-0" />}
                <span className="truncate">{p.name}</span>
                <span className="text-xs text-gray-400 whitespace-nowrap">{p.category}{p.price != null ? ` · ${formatPrice(p.price)}` : ''}</span>
              </span>
              <span className="flex items-center gap-3 shrink-0">
                <PublishToggle entity="product" id={p.id} live={p.is_published} />
                <DeleteButton id={p.id} action={deleteProduct} />
              </span>
            </summary>
            <form action={upsertProduct} className="mt-4 space-y-4">
              <input type="hidden" name="id" value={p.id} />
              <ProductFields p={p} />
              <button type="submit" className="btn btn-primary">Save changes</button>
            </form>
          </details>
        ))}
      </div>
    </div>
  )
}
