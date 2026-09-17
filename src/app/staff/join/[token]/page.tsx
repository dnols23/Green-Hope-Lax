import { notFound } from 'next/navigation'
import { joinLinkValid } from '@/lib/joinLinks'
import { CoachJoinForm } from '@/components/admin/CoachJoinForm'
import { FalconHead } from '@/components/Logo'

export const metadata = { title: 'Coach sign-in', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

/** The coaches' link. Makes a real account; the head coach grants the rest. */
export default async function CoachJoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!(await joinLinkValid('coach', token))) notFound()

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10" style={{ background: 'var(--gh-green-darker)' }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-6 text-white">
          <FalconHead size={52} className="mx-auto mb-3" />
          <h1 className="text-2xl font-black">Falcons Coaches</h1>
          <p className="text-white/70 text-sm mt-1">
            Set yourself up. You will land in the Coaches Hub; the head coach opens up the rest.
          </p>
        </div>
        <CoachJoinForm token={token} />
      </div>
    </div>
  )
}
