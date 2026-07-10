'use client'
import Link from 'next/link'
import { useActionState } from 'react'
import { registerTeamMember, type FormState } from '@/lib/actions'
import { SubmitButton } from '@/components/SubmitButton'
import { FalconBadge } from '@/components/Logo'

const initial: FormState = { ok: false }

export default function TeamJoinPage() {
  const [state, formAction] = useActionState(registerTeamMember, initial)

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 hero-gradient">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <FalconBadge size={88} className="mx-auto mb-4" />
          <h1 className="text-2xl font-black text-white">Join the Falcons Team Hub</h1>
          <p className="text-white/70 text-sm mt-1">
            Register once to access the private team feed. Already registered on this device?
            You’ll go straight in.
          </p>
        </div>

        <form action={formAction} className="bg-white rounded-xl p-6 space-y-4">
          <input type="text" name="company" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="parent_name" className="field-label">Parent/guardian name *</label>
              <input id="parent_name" name="parent_name" required className="field" />
            </div>
            <div>
              <label htmlFor="parent_phone" className="field-label">Phone *</label>
              <input id="parent_phone" name="parent_phone" type="tel" required className="field" placeholder="(919) 555-0123" />
            </div>
          </div>

          <div>
            <label htmlFor="parent_email" className="field-label">Email *</label>
            <input id="parent_email" name="parent_email" type="email" required className="field" />
          </div>

          <div>
            <label htmlFor="player_name" className="field-label">Player name(s) *</label>
            <input id="player_name" name="player_name" required className="field" placeholder="Separate multiple players with commas" />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="player_grad_year" className="field-label">Player grad year</label>
              <input id="player_grad_year" name="player_grad_year" className="field" placeholder="e.g. 2028" inputMode="numeric" />
            </div>
            <div>
              <label htmlFor="player_team" className="field-label">Team</label>
              <select id="player_team" name="player_team" defaultValue="" className="field">
                <option value="">— select —</option>
                <option value="Boys Varsity">Boys Varsity</option>
                <option value="Boys JV">Boys JV</option>
                <option value="Unsure">Not sure yet</option>
              </select>
            </div>
          </div>

          <label className="flex items-start gap-2.5 text-sm text-gray-700 bg-gray-50 rounded-lg p-3">
            <input type="checkbox" name="email_opt_in" defaultChecked className="mt-0.5 h-4 w-4" />
            <span>Email me when new posts are added to the Team Hub (practices, games, reminders).</span>
          </label>

          <hr className="border-gray-100" />

          <div>
            <label htmlFor="password" className="field-label">Team password *</label>
            <input id="password" name="password" type="password" required autoComplete="off" className="field" placeholder="Shared password from your coach" />
          </div>

          {state.error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
              {state.error}
            </div>
          )}

          <SubmitButton pendingText="Joining…">Join the Team Hub</SubmitButton>
          <p className="text-xs text-gray-400 text-center">
            Your info is private to the coaching staff and used only for team communication.
          </p>
        </form>

        <p className="text-center mt-4">
          <Link href="/" className="text-sm font-semibold text-white/80 hover:text-white">← Back to main site</Link>
        </p>
      </div>
    </div>
  )
}
