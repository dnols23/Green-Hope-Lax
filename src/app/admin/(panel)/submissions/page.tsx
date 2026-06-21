import { createClient } from '@/lib/supabase-server'
import { ExportCsvButton } from '@/components/admin/ExportCsvButton'
import { EXPERIENCE_LABELS, type InterestSubmission, type ContactSubmission } from '@/lib/types'

export const metadata = { title: 'Submissions' }

function fmt(iso: string) {
  return new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
}

export default async function SubmissionsPage() {
  const supabase = await createClient()
  const [{ data: interest }, { data: contact }] = await Promise.all([
    supabase.from('interest_form_submissions').select('*').order('created_at', { ascending: false }),
    supabase.from('contact_submissions').select('*').order('created_at', { ascending: false }),
  ])
  const interests = (interest as InterestSubmission[]) ?? []
  const contacts = (contact as ContactSubmission[]) ?? []

  return (
    <div className="space-y-10">
      {/* Interest submissions */}
      <section>
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <h1 className="text-xl font-black">Interest Form Submissions</h1>
          <ExportCsvButton
            rows={interests.map((r) => ({
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
              notes: r.notes,
            }))}
            filename="falcons-interest-submissions.csv"
          />
        </div>
        {interests.length === 0 ? (
          <p className="text-gray-500 text-sm">No interest submissions yet.</p>
        ) : (
          <div className="card table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Submitted</th><th>Player</th><th>Program</th><th>Grad</th><th>Experience</th>
                  <th>Parent</th><th>Email</th><th>Phone</th><th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {interests.map((r) => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap text-gray-500">{fmt(r.created_at)}</td>
                    <td className="font-semibold whitespace-nowrap">{r.player_first} {r.player_last}</td>
                    <td className="capitalize">{r.program}</td>
                    <td>{r.grad_year ?? '—'}</td>
                    <td>{EXPERIENCE_LABELS[r.experience]}</td>
                    <td className="whitespace-nowrap">{r.parent_name}</td>
                    <td><a href={`mailto:${r.parent_email}`} className="text-[var(--gh-green)]">{r.parent_email}</a></td>
                    <td className="whitespace-nowrap">{r.parent_phone}</td>
                    <td className="max-w-xs text-gray-600">{r.notes ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Contact submissions */}
      <section>
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <h1 className="text-xl font-black">Contact Messages</h1>
          <ExportCsvButton
            rows={contacts.map((r) => ({
              submitted: fmt(r.created_at),
              name: r.name,
              email: r.email,
              message: r.message,
            }))}
            filename="falcons-contact-messages.csv"
          />
        </div>
        {contacts.length === 0 ? (
          <p className="text-gray-500 text-sm">No contact messages yet.</p>
        ) : (
          <div className="card table-scroll">
            <table className="data-table">
              <thead>
                <tr><th>Submitted</th><th>Name</th><th>Email</th><th>Message</th></tr>
              </thead>
              <tbody>
                {contacts.map((r) => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap text-gray-500">{fmt(r.created_at)}</td>
                    <td className="font-semibold whitespace-nowrap">{r.name}</td>
                    <td><a href={`mailto:${r.email}`} className="text-[var(--gh-green)]">{r.email}</a></td>
                    <td className="max-w-md text-gray-600">{r.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
