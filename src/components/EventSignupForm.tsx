'use client'
import { useActionState, useState } from 'react'
import { submitEventSignup, type FormState } from '@/lib/actions'
import { SubmitButton } from './SubmitButton'
import { FalconBadge } from './Logo'
import { signupFee, type SignupEvent } from '@/lib/signups'

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
  followUp = 'Coach Nolan emails the details as soon as they are set.',
  events,
}: {
  event: string
  venmoHandle: string
  venmoUrl: string
  amount: number
  /** The one thing this event needs them to know after signing up. */
  followUp?: string
  /** A combined sign-up: the events to tick, priced per event. */
  events?: SignupEvent[]
}) {
  const [state, formAction] = useActionState(submitEventSignup, initial)
  const [picked, setPicked] = useState<string[]>([])
  // What he owes follows what he ticked, and so does the Venmo link.
  const total = events ? signupFee(event, picked.length) : amount
  const payUrl = (() => {
    try {
      const u = new URL(venmoUrl)
      u.searchParams.set('amount', String(total))
      return u.toString()
    } catch {
      return venmoUrl
    }
  })()

  if (state.ok) {
    return (
      <div className="card p-8 text-center">
        <FalconBadge size={88} variant="dark" className="mx-auto mb-4" />
        <h2 className="text-2xl font-black" style={{ color: 'var(--gh-green)' }}>
          You&rsquo;re signed up! 🥍
        </h2>
        <p className="text-gray-600 mt-2 max-w-md mx-auto">
          One more step: send the ${total} player fee to{' '}
          <span className="font-bold">{venmoHandle}</span> on Venmo with the player&rsquo;s name
          in the note. {followUp} Go Falcons!
        </p>
        <a
          href={payUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-maroon mt-4"
        >
          Pay ${total} on Venmo ↗
        </a>
      </div>
    )
  }

  return (
    <form action={formAction} className="card p-6 space-y-5">
      <input type="hidden" name="event" value={event} />
      {/* honeypot */}
      <input type="text" name="company" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />

      {events && (
        <fieldset>
          <legend className="field-label">Which event(s) can your player attend? *</legend>
          <div className="grid sm:grid-cols-2 gap-2">
            {events.map((e) => {
              const on = picked.includes(e.key)
              return (
                <label
                  key={e.key}
                  className="flex items-start gap-3 rounded-lg border-2 px-3 py-2.5 cursor-pointer"
                  style={{ borderColor: on ? 'var(--gh-green)' : 'var(--border)', background: on ? 'var(--gh-green-50, #ecf6f0)' : undefined }}
                >
                  <input
                    type="checkbox"
                    name="events"
                    value={e.key}
                    checked={on}
                    onChange={() => setPicked((p) => (on ? p.filter((k) => k !== e.key) : [...p, e.key]))}
                    className="mt-1 w-4 h-4 accent-[var(--gh-green)]"
                  />
                  <span>
                    <span className="block font-bold">{e.label}</span>
                    <span className="block text-sm text-gray-500">{e.when}</span>
                  </span>
                </label>
              )
            })}
          </div>
          <p className="text-sm mt-2" role="status">
            {picked.length ? (
              <>
                Total: <span className="font-black" style={{ color: 'var(--gh-green)' }}>${total}</span>
              </>
            ) : (
              <span className="text-gray-500">
                ${signupFee(event, 1)} for one event, ${signupFee(event, events.length)} for {events.length === 2 ? 'both' : 'all'}.
              </span>
            )}
          </p>
        </fieldset>
      )}

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
        <label className="field-label">Player school email (optional)</label>
        <input name="player_email" type="email" className="field" />
        <p className="text-xs text-gray-500 mt-1">The email their school gave them — not a personal Gmail or iCloud.</p>
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
