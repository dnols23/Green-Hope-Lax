import { createServiceClient } from './supabase-server'
import { COMP_FORMATS, type CompFormat } from './compete'
import { readBoard } from './planner'

/**
 * The competitions, as the staff has them: the ones the site ships with — as
 * the staff has changed them — then the staff's own. Before 0050 is run it is
 * just the built-ins.
 */
export async function listCompetitionTypes(): Promise<{ ready: boolean; list: CompFormat[] }> {
  const builtIns: CompFormat[] = COMP_FORMATS.map((f) => ({ ...f, builtIn: true }))
  const { data, error } = await createServiceClient().from('competition_types').select('*').order('created_at', { ascending: true })
  if (error) return { ready: false, list: builtIns }
  const rows = (data ?? []) as Record<string, unknown>[]
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v : null)
  // No categories ticked reads as the built-in's own, or any drill for the staff's own.
  const fitsOf = (v: unknown, base?: CompFormat): string[] | 'any' => {
    const list = Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
    return list.length ? list : (base?.fits ?? 'any')
  }
  const fromRow = (r: Record<string, unknown>, base?: CompFormat): CompFormat => ({
    key: String(r.key),
    label: str(r.label) ?? base?.label ?? 'Competition',
    summary: str(r.summary) ?? base?.summary ?? '',
    how: str(r.how) ?? base?.how ?? '',
    setup: str(r.setup),
    why: str(r.why),
    link: str(r.link),
    link_label: str(r.link_label),
    board: readBoard(r.board),
    fits: fitsOf(r.fits, base),
    builtIn: !!base,
    edited: !!base,
  })
  const merged = builtIns.map((b) => {
    const row = rows.find((r) => r.key === b.key)
    return row ? fromRow(row, b) : b
  })
  const own = rows.filter((r) => !builtIns.some((b) => b.key === r.key)).map((r) => fromRow(r))
  return { ready: true, list: [...merged, ...own] }
}
