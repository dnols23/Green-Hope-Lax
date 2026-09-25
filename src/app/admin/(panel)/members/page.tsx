import { getTeamMembers } from '@/lib/queries'
import { ExportCsvButton } from '@/components/admin/ExportCsvButton'
import { formatShortDate } from '@/lib/format'
import { requireSection } from '@/lib/permissions'
import { listHubAccounts } from '@/lib/hubAccounts'
import { createServiceClient } from '@/lib/supabase-server'
import { HubAccountsList } from '@/components/admin/HubAccountsList'

export const metadata = { title: 'Team Members' }
export const dynamic = 'force-dynamic'

const fmt = formatShortDate

export default async function AdminMembersPage() {
  await requireSection('members')
  const [members, accounts] = await Promise.all([getTeamMembers(), listHubAccounts()])
  const optedIn = members.filter((m) => m.email_opt_in).length
  const ids = [...new Set((accounts ?? []).flatMap((a) => a.playerIds))]
  const { data: kids } = ids.length
    ? await createServiceClient().from('players').select('id, name').in('id', ids)
    : { data: [] as { id: string; name: string }[] }
  const names = Object.fromEntries(((kids ?? []) as { id: string; name: string }[]).map((k) => [k.id, k.name]))

  return (
    <div>
      <h1 className="text-xl font-black mb-4">Team Hub &amp; Parent Hub</h1>
      {accounts === null ? (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-8">
          Run <code>supabase/migrations/0045_hub_accounts.sql</code> in the Supabase SQL editor to turn on sign-ups.
        </p>
      ) : (
        <div className="mb-10">
          <HubAccountsList accounts={accounts} names={names} />
        </div>
      )}
      {members.length > 0 && (
      <>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-2">
        <h2 className="text-lg font-black">Old sign-ups</h2>
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
      </>
      )}
    </div>
  )
}
