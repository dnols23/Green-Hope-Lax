import Link from 'next/link'
import { notFound } from 'next/navigation'
import { currentParent } from '@/lib/parentAccess'
import { getSheet } from '@/lib/signupSheets'
import { SlotRow } from '@/components/parents/SlotRow'
import { formatDateTime } from '@/lib/format'

export const metadata = { title: 'Sign-up' }
export const dynamic = 'force-dynamic'

export default async function SheetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [sheet, parent] = await Promise.all([getSheet(id), currentParent()])
  if (!sheet) notFound()

  return (
    <div className="space-y-6">
      <div>
        <Link href="/parents" className="text-sm font-semibold text-[var(--gh-green)]">
          ← All sign-ups
        </Link>
        <h1 className="text-2xl font-black mt-2">{sheet.title}</h1>
        <p className="text-gray-500 text-sm mt-1">
          {[sheet.event_date && formatDateTime(sheet.event_date), sheet.location]
            .filter(Boolean)
            .join(' · ')}
        </p>
        {sheet.description && <p className="text-gray-600 mt-3">{sheet.description}</p>}
        {!sheet.is_open && (
          <p className="mt-3 text-sm font-semibold text-[var(--gh-maroon)]">
            This sheet is closed — talk to a coach if you still want to help.
          </p>
        )}
      </div>

      <div className="space-y-3">
        {sheet.slots.length === 0 ? (
          <p className="card p-6 text-gray-500">Nothing on this sheet yet.</p>
        ) : (
          sheet.slots.map((slot) => (
            <SlotRow
              key={slot.id}
              sheetId={sheet.id}
              slot={slot}
              open={sheet.is_open}
              parentId={parent?.id ?? null}
            />
          ))
        )}
      </div>

      {sheet.created_by && (
        <p className="text-xs text-gray-400">Put together by {sheet.created_by}.</p>
      )}
    </div>
  )
}
