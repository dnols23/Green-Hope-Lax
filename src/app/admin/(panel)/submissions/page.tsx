import Link from 'next/link'
import { createClient } from '@/lib/supabase-server'
import { ExportCsvButton } from '@/components/admin/ExportCsvButton'
import { DeleteButton } from '@/components/admin/DeleteButton'
import { MoveSubmission } from '@/components/admin/MoveSubmission'
import { SweepLegacyButton } from '@/components/admin/SweepLegacyButton'
import {
  deleteInterestSubmission,
  deleteContactSubmission,
  deleteSwflSignup,
  moveSubmission,
  sweepLegacySubmissions,
} from '@/lib/actions'
import {
  EXPERIENCE_LABELS,
  type InterestSubmission,
  type ContactSubmission,
  type SwflSignup,
  type PlayerCollection,
} from '@/lib/types'
import { formatDateTime } from '@/lib/format'

export const metadata = { title: 'Submissions' }

const fmt = formatDateTime

const TABS = [
  { key: 'swfl', label: 'SWFL Fall League' },
  { key: 'high_school', label: 'High School Interest' },
  { key: 'green_machine', label: 'Green Machine' },
  { key: 'contact', label: 'Contact Messages' },
] as const
type TabKey = (typeof TABS)[number]['key']

// What each collection is fed by, so an empty tab explains itself rather than
// just reading zero.
const SOURCE: Record<TabKey, { blurb: string; href?: string; linkText?: string }> = {
  swfl: { blurb: 'Signups from the fall league page.', href: '/swfl', linkText: 'SWFL page' },
  high_school: { blurb: 'Interest forms from the join page.', href: '/join', linkText: 'Join the Team page' },
  green_machine: {
    blurb: 'Interest forms from the Green Machine page. Most families register through LeagueApps instead, so this stays low.',
    href: '/join/green-machine',
    linkText: 'Green Machine page',
  },
  contact: { blurb: 'Messages from the contact page.', href: '/contact', linkText: 'Contact page' },
}

export default async function SubmissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab: tabParam } = await searchParams
  const supabase = await createClient()
  const [{ data: swfl }, { data: interest }, { data: contact }] = await Promise.all([
    supabase.from('swfl_signups').select('*').order('created_at', { ascending: false }),
    supabase.from('interest_form_submissions').select('*').order('created_at', { ascending: false }),
    supabase.from('contact_submissions').select('*').order('created_at', { ascending: false }),
  ])
  const swfls = (swfl as SwflSignup[]) ?? []
  const interests = (interest as InterestSubmission[]) ?? []
  const contacts = (contact as ContactSubmission[]) ?? []

  // Which collection a row belongs to is a stored column now, not a guess made
  // by parsing the notes text.
  const highSchool = interests.filter((r) => r.form_type !== 'green_machine')
  const greenMachine = interests.filter((r) => r.form_type === 'green_machine')

  // Anything still carrying a "[…]" tag was submitted on an older build and
  // hasn't been filed by column yet, so it's showing in the wrong tab. Matches
  // the same shape the sweep does, so the banner clears when the sweep is done.
  const legacy = interests.filter((r) => /^\[[^\]]*\]/.test(r.notes ?? ''))

  const counts: Record<TabKey, number> = {
    swfl: swfls.length,
    high_school: highSchool.length,
    green_machine: greenMachine.length,
    contact: contacts.length,
  }
  const tab: TabKey = (TABS.some((t) => t.key === tabParam) ? tabParam : 'swfl') as TabKey
  const source = SOURCE[tab]

  return (
    <div>
      <h1 className="text-xl font-black mb-4">Submissions</h1>

      {/* Tab chooser — one form type per view */}
      <div className="flex gap-2 flex-wrap mb-6">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/admin/submissions?tab=${t.key}`}
            aria-current={tab === t.key ? 'page' : undefined}
            className="px-3.5 py-2 text-xs font-bold uppercase tracking-wide border transition-colors"
            style={tab === t.key
              ? { background: 'var(--gh-green)', borderColor: 'var(--gh-green)', color: '#fff' }
              : { borderColor: 'var(--border, #e5e7eb)', color: 'var(--gray, #6b7280)' }}
          >
            {t.label} ({counts[t.key]})
          </Link>
        ))}
      </div>

      <p className="text-xs text-gray-500 -mt-2 mb-5">
        {source.blurb}{' '}
        {source.href && (
          <Link href={source.href} target="_blank" className="font-semibold text-[var(--gh-green)]">
            {source.linkText} ↗
          </Link>
        )}
      </p>

      {legacy.length > 0 && tab !== 'contact' && (
        <SweepLegacyButton count={legacy.length} action={sweepLegacySubmissions} />
      )}

      {tab === 'contact' ? (
        <ContactTable rows={contacts} />
      ) : tab === 'swfl' ? (
        <PlayerTable
          rows={swfls}
          collection="swfl"
          title="SWFL Fall League"
          csvName="falcons-fall-league-signups.csv"
          showProgram={false}
          onDelete={deleteSwflSignup}
        />
      ) : (
        <PlayerTable
          rows={tab === 'green_machine' ? greenMachine : highSchool}
          collection={tab}
          title={TABS.find((t) => t.key === tab)!.label}
          csvName={`falcons-${tab}-submissions.csv`}
          showProgram={tab === 'high_school'}
          onDelete={deleteInterestSubmission}
        />
      )}
    </div>
  )
}

function PlayerTable({ rows, collection, title, csvName, showProgram, onDelete }: {
  rows: (InterestSubmission | SwflSignup)[]
  collection: PlayerCollection
  title: string
  csvName: string
  showProgram: boolean
  onDelete: (id: string) => Promise<void>
}) {
  return (
    <section>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <h2 className="text-lg font-black">{title}</h2>
        {rows.length > 0 && (
          <ExportCsvButton
            rows={rows.map((r) => ({
              submitted: fmt(r.created_at),
              player_first: r.player_first,
              player_last: r.player_last,
              grad_year: r.grad_year,
              ...(showProgram ? { program: (r as InterestSubmission).program } : {}),
              experience: EXPERIENCE_LABELS[r.experience],
              parent_name: r.parent_name,
              parent_email: r.parent_email,
              parent_phone: r.parent_phone,
              player_email: r.player_email,
              notes: r.notes,
            }))}
            filename={csvName}
          />
        )}
      </div>
      {rows.length === 0 ? (
        <p className="text-gray-500 text-sm">Nothing here yet.</p>
      ) : (
        <div className="card table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Submitted</th><th>Player</th>{showProgram && <th>Program</th>}<th>Grad</th><th>Experience</th>
                <th>Parent</th><th>Email</th><th>Phone</th><th>Notes</th>
                <th className="col-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap text-gray-500">{fmt(r.created_at)}</td>
                  <td className="font-semibold whitespace-nowrap">{r.player_first} {r.player_last}</td>
                  {showProgram && <td className="capitalize">{(r as InterestSubmission).program}</td>}
                  <td>{r.grad_year ?? '—'}</td>
                  <td>{EXPERIENCE_LABELS[r.experience]}</td>
                  <td className="whitespace-nowrap">{r.parent_name}</td>
                  <td><a href={`mailto:${r.parent_email}`} className="text-[var(--gh-green)]">{r.parent_email}</a></td>
                  <td className="whitespace-nowrap">{r.parent_phone}</td>
                  <td className="max-w-xs text-gray-600">{r.notes || '—'}</td>
                  <td className="col-actions">
                    <div className="flex items-center gap-2">
                      <MoveSubmission id={r.id} current={collection} action={moveSubmission} />
                      <DeleteButton id={r.id} action={onDelete} />
                    </div>
                  </td>
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
        {rows.length > 0 && (
          <ExportCsvButton
            rows={rows.map((r) => ({
              submitted: fmt(r.created_at),
              name: r.name,
              email: r.email,
              message: r.message,
            }))}
            filename="falcons-contact-messages.csv"
          />
        )}
      </div>
      {rows.length === 0 ? (
        <p className="text-gray-500 text-sm">No contact messages yet.</p>
      ) : (
        <div className="card table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Submitted</th><th>Name</th><th>Email</th><th>Message</th>
                <th className="col-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap text-gray-500">{fmt(r.created_at)}</td>
                  <td className="font-semibold whitespace-nowrap">{r.name}</td>
                  <td><a href={`mailto:${r.email}`} className="text-[var(--gh-green)]">{r.email}</a></td>
                  <td className="max-w-md text-gray-600">{r.message}</td>
                  <td className="col-actions">
                    <DeleteButton id={r.id} action={deleteContactSubmission} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
