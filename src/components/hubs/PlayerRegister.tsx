'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { checkHubCode, registerPlayerAccount } from '@/lib/hubAccountActions'
import { PLAYER_FAVORITES, PLAYER_GOALS, missingRequired, type Answers } from '@/lib/hubQuestions'
import { PasswordField } from '@/components/PasswordField'
import { QuestionField, RosterPicker, Steps, type RosterOption } from './HubFields'

const STEPS = ['Team code', 'Your account', 'Your favorites', 'Your season', 'Code of conduct']

/**
 * Joining the Team Hub, as a player: the team code, an account, the favorites,
 * the season's goals — and last, the athletics code of conduct.
 */
export function PlayerRegister({
  roster,
  ackUrl,
  conductUrl,
}: {
  roster: RosterOption[]
  ackUrl: string
  conductUrl: string
}) {
  const [step, setStep] = useState(0)
  const [code, setCode] = useState('')
  const [playerId, setPlayerId] = useState<string[]>([])
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [answers, setAnswers] = useState<Answers>({})
  const [conductRead, setConductRead] = useState(false)
  const [ackSubmitted, setAckSubmitted] = useState(false)
  const [signedName, setSignedName] = useState('')
  const [company, setCompany] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const me = roster.find((p) => p.id === playerId[0])
  const set = (key: string) => (v: string | string[]) => setAnswers((a) => ({ ...a, [key]: v }))

  function next() {
    setError(null)
    if (step === 0) {
      start(async () => {
        const res = await checkHubCode('player', code)
        if (res.ok) setStep(1)
        else setError(res.error)
      })
      return
    }
    if (step === 1) {
      if (!me) return setError('Pick your name from the roster.')
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError('Enter a real email address.')
      if (password.length < 8) return setError('Your password needs at least 8 characters.')
      if (password !== confirm) return setError('The two passwords don’t match.')
    }
    if (step === 2) {
      const miss = missingRequired(answers, PLAYER_FAVORITES)
      if (miss) return setError(`Answer “${miss.label}”.`)
    }
    if (step === 3) {
      const miss = missingRequired(answers, PLAYER_GOALS)
      if (miss) return setError(`Answer “${miss.label}”.`)
    }
    setStep((s) => s + 1)
    window.scrollTo({ top: 0 })
  }

  function finish() {
    setError(null)
    if (!conductRead || !ackSubmitted || !signedName.trim()) {
      setError('Check both boxes and sign with your full name.')
      return
    }
    start(async () => {
      const res = await registerPlayerAccount({
        code,
        playerId: playerId[0] ?? '',
        email,
        phone,
        password,
        answers,
        conductRead,
        ackSubmitted,
        signedName,
        company,
      })
      if (!res.ok) setError(res.error)
    })
  }

  return (
    <div className="card p-5 sm:p-6">
      <Steps at={step} of={STEPS.length} title={STEPS[step]} />

      {step === 0 && (
        <div className="space-y-3">
          <div>
            <label htmlFor="team-code" className="field-label">Team code</label>
            <input
              id="team-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoCapitalize="none"
              autoComplete="off"
              className="field"
              onKeyDown={(e) => e.key === 'Enter' && next()}
            />
          </div>
          <p className="text-sm text-gray-500">
            Already signed up? <Link href="/team/login" className="font-bold text-[var(--gh-green)]">Sign in</Link>
          </p>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <div>
            <div className="field-label">Find yourself on the roster</div>
            <RosterPicker roster={roster} picked={playerId} onPick={setPlayerId} blockTaken />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="p-email" className="field-label">Your email</label>
              <input id="p-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" className="field" />
            </div>
            <div>
              <label htmlFor="p-phone" className="field-label">Your cell</label>
              <input id="p-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" className="field" />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <PasswordField name="password" label="Make a password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" minLength={8} />
            <PasswordField name="confirm" label="Type it again" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" minLength={8} />
          </div>
          <input
            type="text"
            name="company"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            tabIndex={-1}
            autoComplete="off"
            aria-hidden
            className="hidden"
          />
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3">
          {PLAYER_FAVORITES.map((q) => (
            <QuestionField key={q.key} q={q} value={answers[q.key]} onChange={set(q.key)} />
          ))}
        </div>
      )}

      {step === 3 && (
        <div className="space-y-3">
          {PLAYER_GOALS.map((q) => (
            <QuestionField key={q.key} q={q} value={answers[q.key]} onChange={set(q.key)} />
          ))}
        </div>
      )}

      {step === 4 && (
        <div className="space-y-4">
          <div className="rounded-xl border-2 border-[var(--gh-maroon)] bg-[#fdf2f3] px-4 py-3 text-sm text-gray-900">
            <p className="font-bold">
              Every member of the team must complete the Athlete Acknowledgement form to compete in any contest.
              Athletes will not play until this form is submitted.
            </p>
            <p className="mt-1">Please don’t test me on this. You will not like the outcome.</p>
          </div>
          <ol className="space-y-3 text-sm">
            {conductUrl && (
              <li>
                <a href={conductUrl} target="_blank" rel="noreferrer" className="btn btn-ghost w-full justify-center">
                  Read the athletics code of conduct ↗
                </a>
              </li>
            )}
            <li>
              <a href={ackUrl} target="_blank" rel="noreferrer" className="btn btn-primary w-full justify-center">
                Open the Athlete Acknowledgement form ↗
              </a>
            </li>
          </ol>
          <label className="flex items-start gap-3 text-sm cursor-pointer">
            <input type="checkbox" checked={conductRead} onChange={(e) => setConductRead(e.target.checked)} className="mt-0.5 w-5 h-5 accent-[var(--gh-green)]" />
            <span>I have read the Green Hope athletics code of conduct and I will follow it.</span>
          </label>
          <label className="flex items-start gap-3 text-sm cursor-pointer">
            <input type="checkbox" checked={ackSubmitted} onChange={(e) => setAckSubmitted(e.target.checked)} className="mt-0.5 w-5 h-5 accent-[var(--gh-green)]" />
            <span>I submitted the Athlete Acknowledgement form.</span>
          </label>
          <div>
            <label htmlFor="sign" className="field-label">Sign with your full name</label>
            <input id="sign" value={signedName} onChange={(e) => setSignedName(e.target.value)} placeholder={me?.name ?? ''} className="field font-semibold" />
          </div>
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
