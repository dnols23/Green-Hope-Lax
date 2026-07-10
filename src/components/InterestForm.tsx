'use client'
import { useActionState } from 'react'
import { submitInterest, type FormState } from '@/lib/actions'
import { SubmitButton } from './SubmitButton'
import { FalconBadge } from './Logo'

const initial: FormState = { ok: false }

// `level` distinguishes the high school program (default) from the middle school
// team so the coach knows which one the player is interested in.
export function InterestForm({ level = 'high' }: { level?: 'high' | 'middle' }) {
  const [state, formAction] = useActionState(submitInterest, initial)

  if (state.ok) {
    return (
      <div className="card p-8 text-center">
        <FalconBadge size={88} variant="dark" className="mx-auto mb-4" />
        <h2 className="text-2xl font-black" style={{ color: 'var(--gh-green)' }}>You’re on our radar! 🥍</h2>
        <p className="text-gray-600 mt-2 max-w-md mx-auto">
          Thanks for your interest in Falcons lacrosse. A coach will be in touch soon at the
          email you provided. Go Falcons!
        </p>
      </div>
    )
  }

  return (
    <form action={formAction} className="card p-6 space-y-5">
      {/* honeypot */}
      <input type="text" name="company" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      <input type="hidden" name="level" value={level} />

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="player_first" className="field-label">Player first name *</label>
          <input id="player_first" name="player_first" required className="field" />
        </div>
        <div>
          <label htmlFor="player_last" className="field-label">Player last name *</label>
          <input id="player_last" name="player_last" required className="field" />
        </div>
      </div>

      <div>
        <label htmlFor="grad_year" className="field-label">Graduation year</label>
        <input id="grad_year" name="grad_year" placeholder="e.g. 2028" className="field" inputMode="numeric" />
      </div>

      <div>
        <label htmlFor="experience" className="field-label">Experience level *</label>
        <select id="experience" name="experience" required defaultValue="new" className="field">
          <option value="new">New to lacrosse</option>
          <option value="some">Some experience</option>
          <option value="experienced">Experienced</option>
        </select>
      </div>

      <hr className="border-gray-100" />

      <div>
        <label htmlFor="parent_name" className="field-label">Parent / guardian name *</label>
        <input id="parent_name" name="parent_name" required className="field" />
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="parent_email" className="field-label">Parent email *</label>
          <input id="parent_email" name="parent_email" type="email" required className="field" />
        </div>
        <div>
          <label htmlFor="parent_phone" className="field-label">Parent phone *</label>
          <input id="parent_phone" name="parent_phone" type="tel" required className="field" placeholder="(919) 555-0123" />
        </div>
      </div>

      <div>
        <label htmlFor="player_email" className="field-label">Player email (optional)</label>
        <input id="player_email" name="player_email" type="email" className="field" />
      </div>

      <div>
        <label htmlFor="notes" className="field-label">Notes / questions</label>
        <textarea id="notes" name="notes" rows={4} className="field" placeholder="Anything you'd like the coaches to know?" />
      </div>

      {state.error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
          {state.error}
        </div>
      )}

      <SubmitButton pendingText="Sending…">Submit Interest</SubmitButton>
      <p className="text-xs text-gray-400 text-center">
        We only use this information to contact you about Falcons lacrosse.
      </p>
    </form>
  )
}
