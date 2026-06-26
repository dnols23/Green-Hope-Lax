import type { Metadata } from 'next'
import Link from 'next/link'
import { InterestForm } from '@/components/InterestForm'

export const metadata: Metadata = {
  title: 'Join the Middle School Team',
  description: 'Middle schoolers — start playing lacrosse with the Green Hope Falcons feeder program.',
}

export default function JoinMiddleSchoolPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="section-label">Future Falcons · Middle school</div>
      <h1 className="page-title mb-2">Join the Middle School Team</h1>
      <p className="text-gray-600 mb-8">
        Lacrosse starts before high school! Our middle school program is where Future Falcons
        learn the game, build skills, and get ready to play for Green Hope. New to the sport?
        Perfect — most of our players started right here. Fill out the form and a coach will
        reach out with practice, season, and gear details.
      </p>
      <InterestForm level="middle" />
      <p className="text-sm text-gray-500 mt-6 text-center">
        Looking for the high school program instead?{' '}
        <Link href="/join" className="font-semibold" style={{ color: 'var(--gh-green)' }}>Join the high school team →</Link>
      </p>
    </div>
  )
}
