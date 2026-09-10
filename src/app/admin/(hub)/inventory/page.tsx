import { createServiceClient } from '@/lib/supabase-server'
import { requireTeamScope } from '@/lib/permissions'
import { upsertInventoryItem, deleteInventoryItem } from '@/lib/actions'
import { DeleteButton } from '@/components/admin/DeleteButton'
import {
  INVENTORY_CATEGORIES,
  INVENTORY_CONDITION_LABELS,
  INVENTORY_TEAM_LABELS,
  type InventoryItem,
  type InventoryCondition,
} from '@/lib/types'

export const metadata = { title: 'Inventory' }
export const dynamic = 'force-dynamic'

const CONDITION_STYLE: Record<InventoryCondition, string> = {
  new: 'badge-win',
  good: 'badge-conf',
  worn: 'badge-tie',
  retire: 'badge-loss',
}

function ItemFields({ item, jvOnly }: { item?: InventoryItem; jvOnly: boolean }) {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
      <div className="lg:col-span-2">
        <label className="field-label">Item *</label>
        <input name="item" required defaultValue={item?.item ?? ''} className="field" placeholder="Warrior Burn helmet" />
      </div>
      <div>
        <label className="field-label">Category</label>
        <input
          name="category"
          list="inventory-categories"
          defaultValue={item?.category ?? ''}
          className="field"
          placeholder="Helmets"
        />
      </div>
      {!jvOnly && (
        <div>
          <label className="field-label">Team</label>
          <select name="team" defaultValue={item?.team ?? 'program'} className="field">
            {Object.entries(INVENTORY_TEAM_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
      )}
      <div>
        <label className="field-label">Quantity</label>
        <input name="quantity" type="number" min={0} defaultValue={item?.quantity ?? 0} className="field" />
      </div>
      <div>
        <label className="field-label">Size</label>
        <input name="size" defaultValue={item?.size ?? ''} className="field" placeholder="L / 12 / one size" />
      </div>
      <div>
        <label className="field-label">Condition</label>
        <select name="condition" defaultValue={item?.condition ?? 'good'} className="field">
          {Object.entries(INVENTORY_CONDITION_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="field-label">Where it is</label>
        <input name="location" defaultValue={item?.location ?? ''} className="field" placeholder="Equipment room, bin 3" />
      </div>
      <div className="sm:col-span-2 lg:col-span-3">
        <label className="field-label">Notes</label>
        <input name="notes" defaultValue={item?.notes ?? ''} className="field" placeholder="Four need restringing" />
      </div>
    </div>
  )
}

export default async function InventoryPage() {
  const { scope } = await requireTeamScope('inventory', 'inventory-jv')
  const jvOnly = scope === 'jv'

  const svc = createServiceClient()
  let query = svc.from('team_inventory').select('*').order('team').order('category').order('item')
  if (jvOnly) query = query.eq('team', 'jv')
  const { data, error } = await query

  // The table arrives with migration 0012. Say so plainly instead of erroring.
  if (error) {
    return (
      <div className="max-w-2xl">
        <h1 className="text-xl font-black mb-1">Inventory</h1>
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 mt-4">
          <p className="text-sm text-amber-900 font-bold mb-1">Inventory isn&rsquo;t switched on yet.</p>
          <p className="text-sm text-amber-900">
            The equipment table hasn&rsquo;t been created in the database. Run{' '}
            <code>supabase/migrations/0012_inventory.sql</code> in the Supabase SQL editor and this
            page starts working — nothing else changes.
          </p>
        </div>
      </div>
    )
  }

  const items = (data as InventoryItem[]) ?? []
  const total = items.reduce((n, i) => n + (i.quantity ?? 0), 0)
  const groups = items.reduce<Record<string, InventoryItem[]>>((acc, i) => {
    ;(acc[i.category] ??= []).push(i)
    return acc
  }, {})

  return (
    <div className="space-y-8">
      <datalist id="inventory-categories">
        {INVENTORY_CATEGORIES.map((c) => <option key={c} value={c} />)}
      </datalist>

      <div>
        <h1 className="text-xl font-black mb-1">{jvOnly ? 'JV Inventory' : 'Inventory'}</h1>
        <p className="text-gray-500 text-sm">
          {jvOnly
            ? 'Gear assigned to the JV team. Everything you add here is filed under JV.'
            : 'What the program owns, where it is, and what shape it&rsquo;s in.'}
          {items.length > 0 && ` ${items.length} entries, ${total} items counted.`}
        </p>
      </div>

      <section className="card p-5">
        <h2 className="font-bold text-gray-700 mb-4">Add gear</h2>
        <form action={upsertInventoryItem} className="space-y-4">
          <ItemFields jvOnly={jvOnly} />
          <button type="submit" className="btn btn-primary">Add to inventory</button>
        </form>
      </section>

      {items.length === 0 ? (
        <div className="card p-6 text-sm text-gray-500">
          Nothing counted yet. Add your first item above.
        </div>
      ) : (
        Object.entries(groups).map(([category, rows]) => (
          <section key={category}>
            <h2 className="font-bold text-gray-700 mb-3">
              {category}{' '}
              <span className="text-xs font-normal text-gray-400">
                ({rows.reduce((n, r) => n + (r.quantity ?? 0), 0)} items)
              </span>
            </h2>
            <div className="space-y-2">
              {rows.map((r) => (
                <details key={r.id} className="card p-4">
                  <summary className="flex items-center justify-between cursor-pointer list-none gap-3 flex-wrap">
                    <span className="font-semibold flex items-center gap-2 flex-wrap">
                      <span className="font-black text-lg" style={{ color: 'var(--gh-green-dk)' }}>
                        {r.quantity}
                      </span>
                      {r.item}
                      {r.size && <span className="text-xs text-gray-400">size {r.size}</span>}
                      <span className={`badge ${CONDITION_STYLE[r.condition]}`}>
                        {INVENTORY_CONDITION_LABELS[r.condition]}
                      </span>
                      {!jvOnly && (
                        <span className="text-xs text-gray-400">{INVENTORY_TEAM_LABELS[r.team]}</span>
                      )}
                      {r.location && <span className="text-xs text-gray-400">· {r.location}</span>}
                    </span>
                    <DeleteButton id={r.id} action={deleteInventoryItem} />
                  </summary>
                  <form action={upsertInventoryItem} className="mt-4 space-y-4">
                    <input type="hidden" name="id" value={r.id} />
                    <ItemFields item={r} jvOnly={jvOnly} />
                    <button type="submit" className="btn btn-primary">Save changes</button>
                  </form>
                </details>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  )
}
