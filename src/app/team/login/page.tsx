import { FalconBadge } from '@/components/Logo'
import { HubSignIn } from '@/components/hubs/HubSignIn'

export const metadata = { title: 'Team Hub' }

export default function TeamSignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 hero-gradient">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <FalconBadge size={88} className="mx-auto mb-4" />
          <h1 className="text-2xl font-black text-white">Falcons Team Hub</h1>
        </div>
        <HubSignIn kind="player" joinHref="/team/register" />
      </div>
    </div>
  )
}
