import { requireOwner } from '@/lib/permissions'
import { createServiceClient } from '@/lib/supabase-server'
import { decryptTeamCode } from '@/lib/teamCode'
import { setTeamPassword } from '@/lib/actions'
import { newJoinLink, setSigninSwitch } from '@/lib/joinActions'
import { ensureJoinLink, JOIN_KINDS, readSigninSettings } from '@/lib/joinLinks'
import { JoinLinkPanel } from '@/components/parents/JoinLinkPanel'
import { PasswordField } from '@/components/PasswordField'

export const metadata = { title: 'Sign-in' }
export const dynamic = 'force-dynamic'

function Switch({ what, on, label }: { what: string; on: boolean; label: string }) {
  return (
    <form action={setSigninSwitch}>
      <input type="hidden" name="what" value={what} />
      <input type="hidden" name="on" value={String(!on)} />
      <button
        type="submit"
        aria-pressed={on}
        title={on ? `${label} is on — click to switch it off` : `${label} is off — click to switch it on`}
        className="text-xs font-bold px-3 py-1.5 rounded-full border transition-colors"
        style={
          on
            ? { background: '#dcfce7', color: '#15803d', borderColor: '#86efac' }
            : { background: '#f3f4f6', color: '#6b7280', borderColor: '#d1d5db' }
        }
      >
        {on ? '● On' : '○ Off'}
      </button>
    </form>
  )
}

/**
 * Every way into the site, on one screen.
 *
 * Four doors — the shared team code and a link each for players, parents and
 * coaches — each with a switch, because the question "who can get in right now"
 * should have one place to look and one click to change.
 */
export default async function SigninSettingsPage() {
  await requireOwner()

  const settings = await readSigninSettings()
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://greenhopelacrosse.com'

  const links = await Promise.all(
    JOIN_KINDS.map(async (j) => ({
      ...j,
      on: settings.links[j.kind],
      url: `${base}${j.path}/${(await ensureJoinLink(j.kind)) ?? ''}`,
    }))
  )

  const { data: codeRow } = await createServiceClient()
    .from('app_settings')
    .select('value')
    .eq('key', 'team_code_enc')
    .maybeSingle()
  const teamCode = await decryptTeamCode(codeRow?.value as string | undefined)

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-xl font-black mb-1">Sign-in</h1>
        <p className="text-gray-500 text-sm">
          Who can get in, and how. Switching a link off does not sign anybody out — it stops the
          next person using it.
        </p>
      </div>

      {/* ── The links ── */}
      <section className="space-y-3">
        {links.map((l) => (
          <div key={l.kind} className="card p-5">
            <div className="flex items-center justify-between gap-3 mb-1">
              <h2 className="font-bold text-gray-700">{l.label}</h2>
              <Switch what={l.kind} on={l.on} label={`The ${l.label.toLowerCase()} link`} />
            </div>
            <p className="text-sm text-gray-500 mb-3">{l.blurb}</p>

            {l.on ? (
              <>
                <JoinLinkPanel joinUrl={l.url} audience={l.kind} />
                <form action={newJoinLink} className="mt-3">
                  <input type="hidden" name="kind" value={l.kind} />
                  <button type="submit" className="btn btn-ghost !py-1.5 text-sm">
                    Make a new link
                  </button>
                </form>
              </>
            ) : (
              <p className="text-sm text-gray-400">
                Switched off. The old link stops working the moment you switch it back on and make a
                new one — anyone already in stays in either way.
              </p>
            )}
          </div>
        ))}
      </section>

      {/* ── The shared code ── */}
      <section className="card p-5">
        <div className="flex items-center justify-between gap-3 mb-1">
          <h2 className="font-bold text-gray-700">Team password</h2>
          <Switch what="code" on={settings.codeOn} label="The team password" />
        </div>
        <p className="text-sm text-gray-500 mb-3">
          The one password families type at <code className="font-mono text-xs">/team/login</code>.
          The links above are better — they know who is on the other end, and this does not. Switch
          it off once everyone is through.
        </p>

        {settings.codeOn ? (
          <>
            {teamCode ? (
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 mb-3">
                <div className="field-label mb-1">Current password</div>
                <code className="text-lg font-bold tracking-wide" style={{ color: 'var(--gh-green-dk)' }}>
                  {teamCode}
                </code>
              </div>
            ) : (
              <p className="text-sm text-gray-500 mb-3">
                The current password was saved as a one-way hash and can&rsquo;t be shown. Set a new
                one and it appears here from then on.
              </p>
            )}
            <form action={setTeamPassword} className="flex flex-wrap items-end gap-3">
              <PasswordField
                name="team_password"
                label="New team password"
                placeholder="Type a new team password"
                required
                minLength={4}
                autoComplete="new-password"
              />
              <button type="submit" className="btn btn-maroon">Update password</button>
            </form>
          </>
        ) : (
          <p className="text-sm text-gray-400">
            Switched off. Nobody can get in with a password — only the links above.
          </p>
        )}
      </section>
    </div>
  )
}
