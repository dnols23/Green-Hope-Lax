'use client'
import { useActionState } from 'react'
import { submitSwfl, type FormState } from '@/lib/actions'
import { SubmitButton } from './SubmitButton'
import { FalconBadge } from './Logo'

const initial: FormState = { ok: false }

export function SwflForm() {
  const [state, formAction] = useActionState(submitSwfl, initial)

  if (state.ok) {
    return (
      <div className="card p-8 text-center">
        <FalconBadge size={88} variant="dark" className="mx-auto mb-4" />
        <h2 className="text-2xl font-black" style={{ color: 'var(--gh-green)' }}>
          You&rsquo;re signed up! 🥍
        </h2>
        <p className="text-gray-600 mt-2 max-w-md mx-auto">
          Thanks for signing up for fall league. One more step: pay the $50 player fee via
          Venmo (<span className="font-bold">@DanNolan21</span>) with the player&rsquo;s name in
          the note. The coaches will follow up at the email you provided with rosters, gear,
          and game-night details. Go Falcons!
        </p>
        <a
          href="https://venmo.com/DanNolan21?txn=pay&amount=50&note=SWFL%20Fall%20League"
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-maroon mt-4"
        >
          Pay $50 on Venmo ↗
        </a>
      </div>
    )
  }

  return (
    <form action={formAction} className="card p-6 space-y-5">
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
          <label className="field-label">Experience level *</label>
          <select name="experience" required defaultValue="experienced" className="field">
            <option value="new">New to lacrosse</option>
            <option value="some">Some experience</option>
            <option value="experienced">Experienced</option>
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
          <input name="parent_phone" type="tel" required className="field" placeholder="(919) 555-0123" />
        </div>
      </div>

      <div>
        <label className="field-label">Player email (optional)</label>
        <input name="player_email" type="email" className="field" />
      </div>

      <div>
        <label className="field-label">Notes / questions</label>
        <textarea
          name="notes"
          rows={4}
          className="field"
          placeholder="Dates you'd miss, position, anything the coaches should know…"
        />
      </div>

      {state.error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
          {state.error}
        </div>
      )}

      <SubmitButton pendingText="Sending…">Sign Up to Play</SubmitButton>
      <p className="text-xs text-gray-400 text-center">
        We only use this information to contact you about Falcons fall lacrosse.
      </p>
    </form>
  )
}
