import { notFound } from 'next/navigation'
import { joinTokenValid } from '@/lib/parentAccess'
import { ParentJoinForm } from '@/components/parents/ParentJoinForm'

export const metadata = { title: 'Join the Parent Hub' }
export const dynamic = 'force-dynamic'

/**
 * The link from the team email.
 *
 * It asks for a name and an email and nothing else that isn't useful — the
 * point is that a parent reading a phone in a school pickup line is through it
 * in twenty seconds.
 */
export default async function ParentJoinPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  if (!(await joinTokenValid(token))) notFound()

  return (
    <div>
      <h1 className="text-2xl font-black mb-1">Falcons Parent Hub</h1>
      <p className="text-gray-600 mb-6">
        Sign-up sheets for game days, playdays and everything else the team needs hands for.
        Tell us who you are and you are in — no password, and you stay signed in on this device.
      </p>
      <ParentJoinForm token={token} />
    </div>
  )
}
