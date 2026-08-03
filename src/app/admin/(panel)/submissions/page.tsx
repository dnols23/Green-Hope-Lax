import Link from 'next/link'
import { createClient } from '@/lib/supabase-server'
import { ExportCsvButton } from '@/components/admin/ExportCsvButton'
import { DeleteButton } from '@/components/admin/DeleteButton'
import { deleteInterestSubmission, deleteContactSubmission } from '@/lib/actions'
import { EXPERIENCE_LABELS, type InterestSubmission, type ContactSubmission } from '@/lib/types'

export const metadata = { title: 'Submissions' }

function fmt(iso: string) {
  return new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
}

// Interest rows are tagged in `notes` by the form that created them (e.g.
// "[SWFL Fall League] …"). Route each row to its own tab so fall-league
// signups never mix with join-the-team interest or Revolution inquiries.
function bucketOf(r: InterestSubmission): 'swfl' | 'revolution' | 'interest' {
  const n = r.notes ?? ''
  if (n.startsWith('[SWFL Fall League]')) return 'swfl'
  if (n.startsWith('[Green Machine')) return 'revolution'
  return 'interest'
}
const stripTag = (notes: string | null) => (notes ?? '').replace(/^\[[^\]]*\]\s*/, '') || '—'

const TABS = [
  { key: 'swfl', label: 'SWFL Fall League' },
  { key: 'interest', label: 'High School Interest' },
  { key: 'revolution', label: 'Green Machine' },
  { key: 'contact', label: 'Contact Messages' },
] as const
type TabKey = (typeof TABS)[number]['key']

export default async function SubmissionsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab: tabParam } = await searchParams
  const supabase = await createClient()
  const [{ data: interest }, { data: contact }] = await Promise.all([
    supabase.from('interest_form_submissions').select('*').order('created_at', { ascending: false }),
    supabase.from('contact_submissions').select('*').order('created_at', { ascending: false }),
  ])
  const interests = (interest as InterestSubmission[]) ?? []
  const contacts = (contact as ContactSubmission[]) ?? []

  const byBucket: Record<'swfl' | 'revolution' | 'interest', InterestSubmission[]> = {
    swfl: [], revolution: [], interest: [],
  }
  for (const r of interests) byBucket[bucketOf(r)].push(r)

  const counts: Record<TabKey, number> = {
    swfl: byBucket.swfl.length,
    interest: byBucket.interest.length,
    revolution: byBucket.revolution.length,
    contact: contacts.length,
  }
  const tab: TabKey = (TABS.some((t) => t.key === tabParam) ? tabParam : 'swfl') as TabKey

  return (
    <div>
      <h1 className="text-xl font-black mb-4">Submissions</h1>

      {/* Tab chooser — one form type per view */}
      <div className="flex gap-2 flex-wrap mb-6">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/admin/submissions?tab=${t.key}`}
            className="px-3.5 py-2 text-xs font-bold uppercase tracking-wide border transition-colors"
            style={tab === t.key
              ? { background: 'var(--gh-green)', borderColor: 'var(--gh-green)', color: '#fff' }
              : { borderColor: 'var(--border, #e5e7eb)', color: 'var(--gray, #6b7280)' }}
          >
            {t.label} ({counts[t.key]})
          </Link>
        ))}
      </div>

      {tab === 'contact' ? (
        <ContactTable rows={contacts} />
      ) : (
        <InterestTable
          rows={byBucket[tab]}
          title={TABS.find((t) => t.key === tab)!.label}
          csvName={`falcons-${tab}-submissions.csv`}
          showProgram={tab === 'interest'}
        />
      )}
    </div>
  )
}

function InterestTable({ rows, title, csvName, showProgram }: {
  rows: InterestSubmission[]; title: string; csvName: string; showProgram: boolean
}) {
  return (
    <section>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <h2 className="text-lg font-black">{title}</h2>
        <ExportCsvButton
          rows={rows.map((r) => ({
            submitted: fmt(r.created_at),
            player_first: r.player_first,
            player_last: r.player_last,
            grad_year: r.grad_year,
            program: r.program,
            experience: EXPERIENCE_LABELS[r.experience],
            parent_name: r.parent_name,
            parent_email: r.parent_email,
            parent_phone: r.parent_phone,
            player_email: r.player_email,
            notes: stripTag(r.notes),
          }))}
          filename={csvName}
        />
      </div>
      {rows.length === 0 ? (
        <p className="text-gray-500 text-sm">Nothing here yet.</p>
      ) : (
        <div className="card table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Submitted</th><th>Player</th>{showProgram && <th>Program</th>}<th>Grad</th><th>Experience</th>
                <th>Parent</th><th>Email</th><th>Phone</th><th>Notes</th><th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap text-gray-500">{fmt(r.created_at)}</td>
                  <td className="font-semibold whitespace-nowrap">{r.player_first} {r.player_last}</td>
                  {showProgram && <td className="capitalize">{r.program}</td>}
                  <td>{r.grad_year ?? '—'}</td>
                  <td>{EXPERIENCE_LABELS[r.experience]}</td>
                  <td className="whitespace-nowrap">{r.parent_name}</td>
                  <td><a href={`mailto:${r.parent_email}`} className="text-[var(--gh-green)]">{r.parent_email}</a></td>
                  <td className="whitespace-nowrap">{r.parent_phone}</td>
                  <td className="max-w-xs text-gray-600">{stripTag(r.notes)}</td>
                  <td><DeleteButton id={r.id} action={deleteInterestSubmission} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function ContactTable({ rows }: { rows: ContactSubmission[] }) {
  return (
    <section>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <h2 className="text-lg font-black">Contact Messages</h2>
        <ExportCsvButton
          rows={rows.map((r) => ({
            submitted: fmt(r.created_at),
            name: r.name,
            email: r.email,
            message: r.message,
          }))}
          filename="falcons-contact-messages.csv"
        />
      </div>
      {rows.length === 0 ? (
        <p className="text-gray-500 text-sm">No contact messages yet.</p>
      ) : (
        <div className="card table-scroll">
          <table className="data-table">
            <thead>
              <tr><th>Submitted</th><th>Name</th><th>Email</th><th>Message</th><th></th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap text-gray-500">{fmt(r.created_at)}</td>
                  <td className="font-semibold whitespace-nowrap">{r.name}</td>
                  <td><a href={`mailto:${r.email}`} className="text-[var(--gh-green)]">{r.email}</a></td>
                  <td className="max-w-md text-gray-600">{r.message}</td>
                  <td><DeleteButton id={r.id} action={deleteContactSubmission} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
