import Link from 'next/link'
import { setSignupStatus } from '@/lib/actions'
import { SignupStatusBadge } from '@/components/SignupStatusBadge'
import { SIGNUPS, SIGNUP_STATUS_META, statusOf, type SignupStatus } from '@/lib/signups'

const CHOICES: SignupStatus[] = ['open', 'ongoing', 'closed']

/**
 * Open or close a sign-up without anybody deploying anything.
 *
 * Sat at the top of Submissions because that is the screen a coach is already
 * on when the roster fills up — and "stop taking names" is the next thing they
 * want after reading the last one.
 */
export function SignupStatusControls({ statuses }: { statuses: Record<string, SignupStatus> }) {
  return (
    <section className="card p-5 mb-6">
      <h2 className="font-bold text-gray-700 mb-1">Sign-up status</h2>
      <p className="text-xs text-gray-500 mb-4">
        What the page says, and whether it still takes entries. <strong>Ongoing</strong> closes
        the form but keeps the badge green — the season is being played.
      </p>
      <div className="space-y-3">
        {SIGNUPS.map((s) => {
          const current = statusOf(statuses, s.key)
          return (
            <div key={s.key} className="flex flex-wrap items-center gap-3">
              <div className="min-w-52 flex-1">
                <Link href={s.href} target="_blank" className="font-semibold hover:underline">
                  {s.label} ↗
                </Link>
                <div className="mt-1">
                  <SignupStatusBadge signupKey={s.key} status={current} />
                </div>
              </div>
              <form action={setSignupStatus} className="flex items-center gap-2">
                <input type="hidden" name="key" value={s.key} />
                <select name="status" defaultValue={current} className="field !py-1.5 !w-auto">
                  {CHOICES.map((c) => (
                    <option key={c} value={c}>
                      {SIGNUP_STATUS_META[c].label}
                      {c === 'ongoing' && s.ongoingLabel ? ` (${s.ongoingLabel})` : ''}
                    </option>
                  ))}
                </select>
                <button type="submit" className="btn btn-ghost">Save</button>
              </form>
            </div>
          )
        })}
      </div>
    </section>
  )
}
