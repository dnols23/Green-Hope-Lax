import type { Metadata } from 'next'
import Link from 'next/link'
import { InterestForm } from '@/components/InterestForm'

export const metadata: Metadata = {
  title: 'Join the Team',
  description: 'New or experienced — tell the Green Hope Falcons lacrosse coaches you’re interested in playing.',
}

export default function JoinPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="section-label">New &amp; experienced players welcome</div>
      <h1 className="page-title mb-2">Join the Team</h1>
      <p className="text-gray-600 mb-8">
        Interested in playing lacrosse for the Falcons? Fill out the form below and a coach
        will reach out with tryout, offseason, and gear information. Brand-new to the sport?
        Even better — we’d love to have you.
      </p>
      <InterestForm />
      <p className="text-sm text-gray-500 mt-6 text-center">
        In middle school?{' '}
        <Link href="/join/green-machine" className="font-semibold" style={{ color: 'var(--gh-green)' }}>Join the Green Machine →</Link>
      </p>
    </div>
  )
}
