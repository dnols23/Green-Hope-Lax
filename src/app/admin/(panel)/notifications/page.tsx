import Link from 'next/link'
import { requireOwner } from '@/lib/permissions'
import { notifyStatus } from '@/lib/notify'
import { NotifyForm } from './NotifyForm'

export const metadata = { title: 'Notifications' }

/**
 * Where form notifications go.
 *
 * Owner only — this decides who receives parents' names, emails and phone
 * numbers, which isn't a per-coach setting.
 */
export default async function AdminNotificationsPage() {
  await requireOwner()
  const status = await notifyStatus()
  const envRecipients = status.source === 'env' ? status.recipients : []

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-black mb-1">Notifications</h1>
      <p className="text-sm text-gray-500 mb-5">
        Get an email the moment someone fills out a form, so you don’t have to remember to check{' '}
        <Link href="/admin/submissions" className="font-semibold" style={{ color: 'var(--gh-green)' }}>
          Submissions
        </Link>
        . Every submission is saved either way — this is just the heads-up.
      </p>

      {status.connected ? (
        <div className="card p-4 mb-4 flex items-start gap-3">
          <span className="text-lg leading-none mt-0.5">✅</span>
          <div className="text-sm">
            <div className="font-bold text-gray-700">Email is connected</div>
            <div className="text-gray-500 mt-0.5">
              Sending as <span className="font-mono text-xs">{status.from}</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="card p-5 mb-4 border-l-4" style={{ borderLeftColor: 'var(--gh-maroon)' }}>
          <div className="font-bold text-gray-700">Email isn’t connected yet</div>
          <p className="text-sm text-gray-600 mt-1">
            Forms are still being saved to Submissions — nothing is being lost. To turn the emails
            on, this one-time setup is needed:
          </p>
          <ol className="text-sm text-gray-600 mt-3 space-y-2 list-decimal pl-5">
            <li>
              Create a free account at <span className="font-semibold">resend.com</span> and add{' '}
              <span className="font-semibold">greenhopelacrosse.com</span> as a domain, following
              their DNS steps.
            </li>
            <li>In Resend, create an API key and copy it.</li>
            <li>
              In Vercel → the site’s project → Settings → Environment Variables, add:
              <ul className="mt-1 space-y-0.5 font-mono text-xs">
                <li>RESEND_API_KEY {status.hasApiKey ? '✅ set' : '— missing'}</li>
                <li>EMAIL_FROM {status.from ? '✅ set' : '— missing'}</li>
              </ul>
              <span className="block mt-1">
                EMAIL_FROM looks like{' '}
                <span className="font-mono text-xs">Green Hope Falcons &lt;noreply@greenhopelacrosse.com&gt;</span>{' '}
                and must use the domain you verified.
              </span>
            </li>
            <li>Redeploy the site, then come back here and send yourself a test.</li>
          </ol>
        </div>
      )}

      <NotifyForm settings={status.settings} fallback={envRecipients} />

      {status.source === 'env' && (
        <p className="text-xs text-gray-500 mt-3">
          These addresses are currently coming from the COACH_NOTIFY_EMAIL setting in Vercel.
          Saving here takes over from it.
        </p>
      )}
    </div>
  )
}
