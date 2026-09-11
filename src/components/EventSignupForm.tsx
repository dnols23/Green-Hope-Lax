'use client'
import { useActionState } from 'react'
import { submitEventSignup, type FormState } from '@/lib/actions'
import { SubmitButton } from './SubmitButton'
import { FalconBadge } from './Logo'

const initial: FormState = { ok: false }

/**
 * Sign up for a one-day event.
 *
 * Shorter than the league form on purpose: a playday is for players the coaches
 * already know, so it asks what they need to build a roster and take a payment,
 * and nothing else.
 */
export function EventSignupForm({
  event,
  venmoHandle,
  venmoUrl,
  amount,
}: {
  event: string
  venmoHandle: string
  venmoUrl: string
  amount: number
}) {
  const [state, formAction] = useActionState(submitEventSignup, initial)

  if (state.ok) {
    return (
      <div className="card p-8 text-center">
        <FalconBadge size={88} variant="dark" className="mx-auto mb-4" />
        <h2 className="text-2xl font-black" style={{ color: 'var(--gh-green)' }}>
          You&rsquo;re signed up! 🥍
        </h2>
        <p className="text-gray-600 mt-2 max-w-md mx-auto">
          One more step: send the ${amount} player fee to{' '}
          <span className="font-bold">{venmoHandle}</span> on Venmo with the player&rsquo;s name
          in the note. Coach Nolan will email the schedule and travel details as soon as they
          come out. Go Falcons!
        </p>
        <a
          href={venmoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-maroon mt-4"
        >
          Pay ${amount} on Venmo ↗
        </a>
      </div>
    )
  }

  return (
    <form action={formAction} className="card p-6 space-y-5">
      <input type="hidden" name="event" value={event} />
      {/* honeypot */}
      <input type="text" name="company" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="field-label">Player first name *</label>
          <input name="player_first" required className="field" />
        </div>
        <div>
          <label className="field-label">Player last name *</label>
          <input name="player_last" required className="field" />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="field-label">Graduation year</label>
          <input name="grad_year" placeholder="e.g. 2028" className="field" inputMode="numeric" />
        </div>
        <div>
          <label className="field-label">Position</label>
          <select name="position" defaultValue="" className="field">
            <option value="">Choose one</option>
            <option value="Attack">Attack</option>
            <option value="Midfield">Midfield</option>
            <option value="Defense">Defense</option>
            <option value="LSM">LSM</option>
            <option value="FOGO">FOGO</option>
            <option value="Goalie">Goalie</option>
          </select>
        </div>
      </div>

      <hr className="border-gray-100" />

      <div>
        <label className="field-label">Parent / guardian name *</label>
        <input name="parent_name" required className="field" />
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="field-label">Parent email *</label>
          <input name="parent_email" type="email" required className="field" />
        </div>
        <div>
          <label className="field-label">Parent phone *</label>
          <input name="parent_phone" type="tel" required className="field" />
        </div>
      </div>

      <div>
        <label className="field-label">Player email (optional)</label>
        <input name="player_email" type="email" className="field" />
      </div>

      <div>
        <label className="field-label">Anything the coaches should know?</label>
        <textarea name="notes" rows={3} className="field" placeholder="Conflicts, injuries, carpool plans…" />
      </div>

      {state.error && <p className="text-sm font-semibold text-[var(--gh-maroon)]">{state.error}</p>}

      <SubmitButton>Sign up to play</SubmitButton>
    </form>
  )
}
