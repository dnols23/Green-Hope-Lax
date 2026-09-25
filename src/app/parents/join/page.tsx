import { ParentRegister } from '@/components/hubs/ParentRegister'
import { rosterForSignup } from '@/lib/hubAccounts'

export const metadata = { title: 'Join the Parent Hub' }
export const dynamic = 'force-dynamic'

export default async function ParentRegisterPage() {
  const roster = await rosterForSignup()
  return (
    <div className="max-w-xl mx-auto">
      <h1 className="text-2xl font-black mb-4">Join the Parent Hub</h1>
      <ParentRegister roster={roster} />
    </div>
  )
}
