'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { checkHubCode, registerParentAccount } from '@/lib/hubAccountActions'
import { PARENT_QUESTIONS, type Answers } from '@/lib/hubQuestions'
import { PasswordField } from '@/components/PasswordField'
import { QuestionField, RosterPicker, Steps, type RosterOption } from './HubFields'

const STEPS = ['Parent code', 'You', 'Your player & contacts', 'A few questions']
const RELATIONSHIPS = ['Mother', 'Father', 'Guardian', 'Grandparent', 'Other']

/**
 * Joining the Parent Hub: the parent code, an account, who to call and when,
 * and a few quick questions.
 */
export function ParentRegister({ roster }: { roster: RosterOption[] }) {
  const [step, setStep] = useState(0)
  const [code, setCode] = useState('')
  const [f, setF] = useState({
    name: '',
    relationship: '',
    email: '',
    phone: '',
    preferred: 'text',
    password: '',
    confirm: '',
    address: '',
    g2name: '',
    g2rel: '',
    g2email: '',
    g2phone: '',
    emName: '',
    emPhone: '',
    emRel: '',
    company: '',
  })
  const [kids, setKids] = useState<string[]>([])
  const [answers, setAnswers] = useState<Answers>({})
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const put = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF((x) => ({ ...x, [k]: e.target.value }))
  const digits = (s: string) => s.replace(/\D/g, '').length

  function next() {
    setError(null)
    if (step === 0) {
      start(async () => {
        const res = await checkHubCode('parent', code)
        if (res.ok) setStep(1)
        else setError(res.error)
      })
      return
    }
    if (step === 1) {
      if (!f.name.trim()) return setError('Enter your name.')
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) return setError('Enter a real email address.')
      if (digits(f.phone) < 10) return setError('Enter your cell number.')
      if (f.password.length < 8) return setError('Your password needs at least 8 characters.')
      if (f.password !== f.confirm) return setError('The two passwords don’t match.')
    }
    if (step === 2) {
      if (!kids.length) return setError('Pick your player from the roster.')
      if (!f.emName.trim() || digits(f.emPhone) < 10) return setError('Add an emergency contact who isn’t you, with their phone.')
    }
    setStep((s) => s + 1)
    window.scrollTo({ top: 0 })
  }

  function finish() {
    setError(null)
    start(async () => {
      const res = await registerParentAccount({
        code,
        name: f.name,
        relationship: f.relationship,
        email: f.email,
        phone: f.phone,
        preferred: f.preferred,
        password: f.password,
        playerIds: kids,
        address: f.address,
        guardian2: { name: f.g2name, email: f.g2email, phone: f.g2phone, relationship: f.g2rel },
        emergency: { name: f.emName, phone: f.emPhone, relation: f.emRel },
        answers,
        company: f.company,
      })
      if (!res.ok) setError(res.error)
    })
  }

  const field = (k: keyof typeof f, label: string, type = 'text', auto?: string) => (
    <div>
      <label htmlFor={`pr-${k}`} className="field-label">{label}</label>
      <input id={`pr-${k}`} type={type} value={f[k]} onChange={put(k)} autoComplete={auto} className="field" />
    </div>
  )

  return (
    <div className="card p-5 sm:p-6">
      <Steps at={step} of={STEPS.length} title={STEPS[step]} />

      {step === 0 && (
        <div className="space-y-3">
          <div>
            <label htmlFor="parent-code" className="field-label">Parent code</label>
            <input
              id="parent-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoCapitalize="none"
              autoComplete="off"
              className="field"
              onKeyDown={(e) => e.key === 'Enter' && next()}
            />
          </div>
          <p className="text-sm text-gray-500">
            Already signed up? <Link href="/parents/welcome" className="font-bold text-[var(--gh-green)]">Sign in</Link>
          </p>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            {field('name', 'Your name', 'text', 'name')}
            <div>
              <label htmlFor="pr-rel" className="field-label">You are the player’s</label>
              <select id="pr-rel" value={f.relationship} onChange={put('relationship')} className="field">
                <option value="">—</option>
                {RELATIONSHIPS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            {field('email', 'Email', 'email', 'email')}
            {field('phone', 'Cell', 'tel', 'tel')}
          </div>
          <div>
            <label htmlFor="pr-pref" className="field-label">Best way to reach you</label>
            <select id="pr-pref" value={f.preferred} onChange={put('preferred')} className="field">
              <option value="text">Text</option>
              <option value="call">Call</option>
              <option value="email">Email</option>
            </select>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <PasswordField name="password" label="Make a password" value={f.password} onChange={(e) => setF((x) => ({ ...x, password: e.target.value }))} autoComplete="new-password" minLength={8} />
            <PasswordField name="confirm" label="Type it again" value={f.confirm} onChange={(e) => setF((x) => ({ ...x, confirm: e.target.value }))} autoComplete="new-password" minLength={8} />
          </div>
          <input type="text" value={f.company} onChange={put('company')} tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
        </div>
      )}

      {step === 2 && (
        <div className="space-y-5">
          <div>
            <div className="field-label">Your player (pick more than one if you have more than one)</div>
            <RosterPicker roster={roster} picked={kids} onPick={setKids} multi />
          </div>
          {field('address', 'Home address')}
          <fieldset className="space-y-3">
            <legend className="font-bold text-gray-700 mb-1">Second parent or guardian</legend>
            <div className="grid sm:grid-cols-2 gap-3">
              {field('g2name', 'Name')}
              {field('g2rel', 'Relationship')}
              {field('g2email', 'Email', 'email')}
              {field('g2phone', 'Cell', 'tel')}
            </div>
          </fieldset>
          <fieldset className="space-y-3">
            <legend className="font-bold text-gray-700 mb-1">Emergency contact (not you)</legend>
            <div className="grid sm:grid-cols-3 gap-3">
              {field('emName', 'Name')}
              {field('emPhone', 'Phone', 'tel')}
              {field('emRel', 'Relationship')}
            </div>
          </fieldset>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-3">
          {PARENT_QUESTIONS.map((q) => (
            <QuestionField key={q.key} q={q} value={answers[q.key]} onChange={(v) => setAnswers((a) => ({ ...a, [q.key]: v }))} />
          ))}
        </div>
      )}

      {error && <p className="text-sm font-semibold text-red-700 mt-4" role="alert">{error}</p>}

      <div className="flex items-center gap-3 mt-5">
        {step > 0 && (
          <button type="button" onClick={() => { setError(null); setStep((s) => s - 1) }} className="btn btn-ghost">
            Back
          </button>
        )}
        {step < STEPS.length - 1 ? (
          <button type="button" onClick={next} disabled={pending} className="btn btn-primary ml-auto">
            {pending ? 'Checking…' : 'Next'}
          </button>
        ) : (
          <button type="button" onClick={finish} disabled={pending} className="btn btn-primary ml-auto">
            {pending ? 'Signing you up…' : 'Finish'}
          </button>
        )}
      </div>
    </div>
  )
}
