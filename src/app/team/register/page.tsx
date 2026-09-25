import { FalconBadge } from '@/components/Logo'
import { PlayerRegister } from '@/components/hubs/PlayerRegister'
import { readHubRegistration, rosterForSignup } from '@/lib/hubAccounts'

export const metadata = { title: 'Join the Team Hub' }
export const dynamic = 'force-dynamic'

export default async function TeamRegisterPage() {
  const [roster, reg] = await Promise.all([rosterForSignup(), readHubRegistration()])
  return (
    <div className="min-h-screen px-4 py-10 hero-gradient">
      <div className="w-full max-w-xl mx-auto">
        <div className="text-center mb-6">
          <FalconBadge size={72} className="mx-auto mb-3" />
          <h1 className="text-2xl font-black text-white">Join the Falcons Team Hub</h1>
        </div>
        <PlayerRegister roster={roster} ackUrl={reg.ackUrl} conductUrl={reg.conductUrl} />
      </div>
    </div>
  )
}
