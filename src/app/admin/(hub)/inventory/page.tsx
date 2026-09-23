import { createServiceClient } from '@/lib/supabase-server'
import Link from 'next/link'
import { requireTeamScope, teamFor } from '@/lib/permissions'
import { teamLabel, withTeam, type Team } from '@/lib/teams'
import { upsertInventoryItem, deleteInventoryItem, signOutEquipment, returnEquipment } from '@/lib/actions'
import { DeleteButton } from '@/components/admin/DeleteButton'
import { PlayerLink } from '@/components/admin/PlayerLink'
import { equipmentReady, listAssignments, outByItem } from '@/lib/equipment'
import { formatShortDate } from '@/lib/format'
import type { Player } from '@/lib/types'
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

function ItemFields({ item, team }: { item?: InventoryItem; team: Team }) {
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
      {/* Two choices, not three. You are already on one team's board, so the
          only real question is whether this piece of gear is theirs or shared
          — and the board's own team is what it starts on. */}
      <div>
        <label className="field-label">Whose</label>
        <select name="team" defaultValue={item?.team ?? team} className="field">
          <option value={team}>{teamLabel(team)} only</option>
          <option value="program">Shared — both teams</option>
        </select>
      </div>
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

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { viewer, scope } = await requireTeamScope('inventory', 'inventory-jv')
  /* Whose shed this is. Two locks, and either one holds: the JV-only grant on
     this page, and the side of the program this coach works on at all. */
  const asked: Team = teamFor(viewer, (await searchParams).team)
  const team: Team = scope === 'jv' ? 'jv' : asked
  /* The one place still shut: a coach granted only the JV shed sees only the
     JV shed, because that grant is about the gear, not about the team. */
  const locked = scope === 'jv'

  const svc = createServiceClient()
  // This team's gear, plus what both teams share — balls and goals belong to
  // whoever is on the field, and hiding them from one board loses them.
  const { data, error } = await svc
    .from('team_inventory')
    .select('*')
    .in('team', [team, 'program'])
    .order('team')
    .order('category')
    .order('item')

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

  // Who has what. A player list to sign gear out to, and the rows still out.
  const signOutOn = await equipmentReady()
  const assignments = signOutOn ? await listAssignments({ includeReturned: false }) : []
  const outCount = outByItem(assignments)
  /* Who you can sign it out to. Player teams are spelled boys_varsity /
     boys_jv / girls, so the JV board asks for boys_jv and the varsity board
     takes everyone who isn't on it — which keeps the girls' squad in view on
     the varsity board rather than quietly dropping it. */
  let playerQuery = svc.from('players').select('id, name, number, team').eq('is_active', true).order('name')
  playerQuery = team === 'jv' ? playerQuery.eq('team', 'boys_jv') : playerQuery.neq('team', 'boys_jv')
  const { data: playerRows } = await playerQuery
  const players = (playerRows ?? []) as Pick<Player, 'id' | 'name' | 'number' | 'team'>[]
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
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <h1 className="text-xl font-black">{teamLabel(team)} Inventory</h1>
          {!locked && (
            <Link
              href={withTeam('/admin/inventory', team === 'varsity' ? 'jv' : 'varsity')}
              className="text-xs font-bold px-2 py-0.5 rounded-full border border-gray-200 text-gray-500 hover:border-[var(--gh-green)] hover:text-[var(--gh-green)]"
            >
              {team === 'varsity' ? 'JV' : 'Varsity'} &rarr;
            </Link>
          )}
        </div>
        <p className="text-gray-500 text-sm">
          What {teamLabel(team)} owns, where it is, and what shape it&rsquo;s in. Anything you add
          lands on this board unless you mark it shared.
          {items.length > 0 && ` ${items.length} entries, ${total} items counted.`}
        </p>
      </div>

      <section className="card p-5">
        <h2 className="font-bold text-gray-700 mb-4">Add gear</h2>
        <form action={upsertInventoryItem} className="space-y-4">
          <ItemFields team={team} />
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
                      {r.team === 'program' && (
                        <span className="text-xs font-bold text-gray-400">
                          {INVENTORY_TEAM_LABELS.program} — shared
                        </span>
                      )}
                      {r.location && <span className="text-xs text-gray-400">· {r.location}</span>}
                      {(outCount[r.id] ?? 0) > 0 && (
                        <span className="text-xs font-bold" style={{ color: 'var(--gh-maroon)' }}>
                          {outCount[r.id]} out · {Math.max(0, r.quantity - outCount[r.id])} here
                        </span>
                      )}
                    </span>
                    <DeleteButton id={r.id} action={deleteInventoryItem} />
                  </summary>

                  {signOutOn && (
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <div className="section-label mb-2">Signed out</div>
                      {assignments.filter((a) => a.item_id === r.id).length === 0 ? (
                        <p className="text-sm text-gray-500 mb-3">Nobody has one of these.</p>
                      ) : (
                        <ul className="space-y-1 mb-3">
                          {assignments
                            .filter((a) => a.item_id === r.id)
                            .map((a) => (
                              <li key={a.id} className="flex flex-wrap items-center gap-2 text-sm">
                                {a.player_id ? (
                                  <PlayerLink id={a.player_id} name={a.player_name} />
                                ) : (
                                  <span className="font-semibold">{a.player_name}</span>
                                )}
                                {a.quantity > 1 && <span className="text-xs text-gray-400">×{a.quantity}</span>}
                                <span className="text-xs text-gray-400">since {formatShortDate(a.out_at)}</span>
                                {a.due_at && (
                                  <span className="text-xs font-bold" style={{ color: 'var(--gh-maroon)' }}>
                                    due {formatShortDate(a.due_at)}
                                  </span>
                                )}
                                <form action={returnEquipment} className="ml-auto">
                                  <input type="hidden" name="id" value={a.id} />
                                  <input type="hidden" name="player_id" value={a.player_id ?? ''} />
                                  <button type="submit" className="text-xs font-bold text-[var(--gh-green)]">
                                    Returned
                                  </button>
                                </form>
                              </li>
                            ))}
                        </ul>
                      )}

                      <form action={signOutEquipment} className="grid sm:grid-cols-5 gap-2 items-end">
                        <input type="hidden" name="item_id" value={r.id} />
                        <div className="sm:col-span-2">
                          <label className="field-label">Sign out to</label>
                          <select name="player_id" required className="field !py-1.5">
                            <option value="">Choose a player</option>
                            {players.map((pl) => (
                              <option key={pl.id} value={pl.id}>
                                {pl.number ? `#${pl.number} ` : ''}{pl.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="field-label">How many</label>
                          <input type="number" name="quantity" min={1} defaultValue={1} className="field !py-1.5" />
                        </div>
                        <div>
                          <label className="field-label">Back by</label>
                          <input type="date" name="due_at" className="field !py-1.5" />
                        </div>
                        <button type="submit" className="btn btn-primary !py-1.5 text-sm">Sign out</button>
                      </form>
                    </div>
                  )}

                  <form action={upsertInventoryItem} className="mt-4 pt-4 border-t border-gray-100 space-y-4">
                    <input type="hidden" name="id" value={r.id} />
                    <ItemFields item={r} team={team} />
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
