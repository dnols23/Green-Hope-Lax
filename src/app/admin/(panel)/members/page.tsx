import { getTeamMembers } from '@/lib/queries'
import { ExportCsvButton } from '@/components/admin/ExportCsvButton'

export const metadata = { title: 'Team Members' }
export const dynamic = 'force-dynamic'

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { dateStyle: 'medium' })
}

export default async function AdminMembersPage() {
  const members = await getTeamMembers()
  const optedIn = members.filter((m) => m.email_opt_in).length

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-2">
        <h1 className="text-xl font-black">Team Members</h1>
        <ExportCsvButton
          rows={members.map((m) => ({
            registered: fmt(m.created_at),
            parent_name: m.parent_name,
            parent_email: m.parent_email,
            parent_phone: m.parent_phone,
            player_name: m.player_name,
            player_grad_year: m.player_grad_year,
            player_team: m.player_team,
            email_updates: m.email_opt_in ? 'yes' : 'no',
          }))}
          filename="falcons-team-members.csv"
        />
      </div>
      <p className="text-gray-500 text-sm mb-6">
        Everyone who registered for the Team Hub — your contact list for current and future outreach.
        <strong> {members.length}</strong> registered · <strong>{optedIn}</strong> opted in to email updates.
      </p>

      {members.length === 0 ? (
        <p className="text-gray-500 text-sm">No registrations yet. Share the Team Hub link and password with your families.</p>
      ) : (
        <div className="card table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Registered</th><th>Parent</th><th>Email</th><th>Phone</th>
                <th>Player(s)</th><th>Grad</th><th>Team</th><th>Email updates</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id}>
                  <td className="whitespace-nowrap text-gray-500">{fmt(m.created_at)}</td>
                  <td className="font-semibold whitespace-nowrap">{m.parent_name}</td>
                  <td><a href={`mailto:${m.parent_email}`} className="text-[var(--gh-green)]">{m.parent_email}</a></td>
                  <td className="whitespace-nowrap">{m.parent_phone}</td>
                  <td>{m.player_name}</td>
                  <td>{m.player_grad_year ?? '—'}</td>
                  <td className="whitespace-nowrap">{m.player_team ?? '—'}</td>
                  <td>{m.email_opt_in ? '✅' : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
