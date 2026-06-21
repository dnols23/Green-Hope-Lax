'use client'
import { useActionState } from 'react'
import { submitContact, type FormState } from '@/lib/actions'
import { SubmitButton } from './SubmitButton'

const initial: FormState = { ok: false }

export function ContactForm() {
  const [state, formAction] = useActionState(submitContact, initial)

  if (state.ok) {
    return (
      <div className="card p-8 text-center">
        <h2 className="text-2xl font-black" style={{ color: 'var(--gh-green)' }}>Message sent! ✅</h2>
        <p className="text-gray-600 mt-2">Thanks for reaching out — we’ll get back to you soon.</p>
      </div>
    )
  }

  return (
    <form action={formAction} className="card p-6 space-y-5">
      <input type="text" name="company" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      <div>
        <label className="field-label">Your name *</label>
        <input name="name" required className="field" />
      </div>
      <div>
        <label className="field-label">Email *</label>
        <input name="email" type="email" required className="field" />
      </div>
      <div>
        <label className="field-label">Message *</label>
        <textarea name="message" rows={5} required className="field" />
      </div>
      {state.error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
          {state.error}
        </div>
      )}
      <SubmitButton pendingText="Sending…">Send Message</SubmitButton>
    </form>
  )
}
