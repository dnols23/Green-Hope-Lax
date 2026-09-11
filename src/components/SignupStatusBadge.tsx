import { SIGNUP_STATUS_META, statusLabel, type SignupStatus } from '@/lib/signups'

/**
 * Whether a sign-up is live, at a glance.
 *
 * The dot pulses when the thing is happening — open for entries, or a league
 * already being played — because "closed" and "ongoing" are both "you cannot
 * sign up", and only one of them means the Falcons are out there on Mondays.
 */
export function SignupStatusBadge({
  signupKey,
  status,
  className = '',
}: {
  signupKey: string
  status: SignupStatus
  className?: string
}) {
  const { live } = SIGNUP_STATUS_META[status]
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold ${className}`}
      style={
        live
          ? { background: '#dcfce7', color: '#15803d', borderColor: '#86efac' }
          : { background: '#f3f4f6', color: '#6b7280', borderColor: '#d1d5db' }
      }
    >
      <span className={live ? 'status-dot status-dot-live' : 'status-dot'} aria-hidden />
      {statusLabel(signupKey, status)}
    </span>
  )
}
