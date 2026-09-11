import { createServiceClient } from '@/lib/supabase-server'
import { mergeSplitNames } from '@/lib/actions'

/**
 * Players whose surname landed in the jersey-number column.
 *
 * A spreadsheet with first and last names in separate columns used to import as
 * name "Cayden", number "Staley". The importer handles that shape now; this
 * offers to repair the rows that came in before it did — and it appears wherever
 * those half-names are on screen, not only on the Roster page where nobody was
 * looking.
 */
export async function SplitNameNotice() {
  const svc = createServiceClient()
  const { data } = await svc.from('players').select('id, name, number')
  const rows = ((data ?? []) as { id: string; name: string; number: string | null }[]).filter(
    (p) => p.number && !/^#?\d{1,3}$/.test(p.number.trim())
  )
  if (rows.length === 0) return null

  return (
    <div className="card p-4 mb-4 border-l-4" style={{ borderLeftColor: 'var(--gh-maroon)' }}>
      <p className="font-bold text-gray-700">
        {rows.length} {rows.length === 1 ? 'player is' : 'players are'} missing a surname
      </p>
      <p className="text-sm text-gray-500 mt-1">
        They came in from a spreadsheet with first and last names in separate columns, so the
        surname is sitting in the jersey-number box — <b>{rows[0].name}</b> is wearing number
        &ldquo;{rows[0].number}&rdquo;. This joins them into one name and clears the number. Real
        jersey numbers are left alone.
      </p>
      <form action={mergeSplitNames} className="mt-3">
        <button type="submit" className="btn btn-primary !py-1.5 text-sm">
          Fix {rows.length} {rows.length === 1 ? 'name' : 'names'}
        </button>
      </form>
    </div>
  )
}
