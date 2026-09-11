import Link from 'next/link'
import { formatShortDate } from '@/lib/format'
import type { SignupSheet } from '@/lib/signupSheets'

export function SheetCard({ sheet, spotsLeft }: { sheet: SignupSheet; spotsLeft: number }) {
  const full = spotsLeft === 0
  return (
    <Link
      href={`/parents/s/${sheet.id}`}
      className="card p-5 flex flex-wrap items-center gap-4 hover:shadow-md transition-shadow"
      style={{ borderLeft: '4px solid var(--gh-maroon)' }}
    >
      <div className="flex-1 min-w-52">
        <div className="font-black text-lg">{sheet.title}</div>
        <p className="text-sm text-gray-500 mt-0.5">
          {[sheet.event_date && formatShortDate(sheet.event_date), sheet.location]
            .filter(Boolean)
            .join(' · ') || 'No date set'}
        </p>
      </div>
      <span
        className="text-xs font-bold px-3 py-1 rounded-full border"
        style={
          full
            ? { background: '#f3f4f6', color: '#6b7280', borderColor: '#d1d5db' }
            : { background: '#dcfce7', color: '#15803d', borderColor: '#86efac' }
        }
      >
        {full ? 'All filled' : `${spotsLeft} spot${spotsLeft === 1 ? '' : 's'} left`}
      </span>
    </Link>
  )
}
