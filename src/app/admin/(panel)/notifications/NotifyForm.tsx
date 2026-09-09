'use client'
import { useActionState } from 'react'
import { saveNotifySettings, sendTestNotification } from '@/lib/actions'
import type { FormState } from '@/lib/actions'
import { NOTIFY_EVENTS, isEventOn, type NotifySettings } from '@/lib/notifyEvents'

const EMPTY: FormState = { ok: true }

function Result({ state }: { state: FormState }) {
  if (state.error)
    return (
      <div className="text-sm rounded-lg px-3 py-2 bg-red-50 border border-red-200 text-red-700">
        {state.error}
      </div>
    )
  if (state.message)
    return (
      <div className="text-sm rounded-lg px-3 py-2 bg-green-50 border border-green-200 text-green-800">
        {state.message}
      </div>
    )
  return null
}

export function NotifyForm({
  settings,
  fallback,
}: {
  settings: NotifySettings
  /** Addresses coming from COACH_NOTIFY_EMAIL, shown when nothing is saved yet. */
  fallback: string[]
}) {
  const [saveState, save, saving] = useActionState(saveNotifySettings, EMPTY)
  const [testState, test, testing] = useActionState(sendTestNotification, EMPTY)

  const current = settings.recipients.length ? settings.recipients : fallback

  return (
    <>
      <form action={save} className="card p-5 space-y-4">
        <div>
          <label className="field-label">Send notifications to</label>
          <textarea
            name="recipients"
            rows={2}
            defaultValue={current.join(', ')}
            placeholder="you@example.com, assistant@example.com"
            className="field"
          />
          <p className="text-xs text-gray-500 mt-1">
            One or more addresses, separated by commas. Saved here, so changing them takes effect
            straight away — no redeploy.
          </p>
        </div>

        <div>
          <div className="field-label mb-2">Email me when…</div>
          <div className="divide-y border rounded-lg" style={{ borderColor: '#e5e7eb' }}>
            {NOTIFY_EVENTS.map((e) => (
              <label key={e.key} className="flex items-start gap-3 p-3 cursor-pointer">
                <input
                  type="checkbox"
                  name={`on:${e.key}`}
                  defaultChecked={isEventOn(settings, e.key)}
                  className="mt-0.5 w-4 h-4 accent-[var(--gh-green)]"
                />
                <span>
                  <span className="font-semibold text-sm">{e.label}</span>
                  <span className="block text-xs text-gray-500">{e.description}</span>
                </span>
              </label>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Everything still gets saved to Submissions either way — this only controls the email.
          </p>
        </div>

        <Result state={saveState} />

        <button type="submit" disabled={saving} className="btn btn-primary disabled:opacity-60">
          {saving ? 'Saving…' : 'Save'}
        </button>
      </form>

      <form action={test} className="card p-5 mt-4 space-y-3">
        <div>
          <div className="font-bold text-gray-700">Send yourself a test</div>
          <p className="text-sm text-gray-500 mt-1">
            Sends one email to the addresses above so you can confirm it arrives — and that it
            doesn’t land in spam.
          </p>
        </div>
        <Result state={testState} />
        <button type="submit" disabled={testing} className="btn btn-ghost disabled:opacity-60">
          {testing ? 'Sending…' : 'Send test email'}
        </button>
      </form>
    </>
  )
}
