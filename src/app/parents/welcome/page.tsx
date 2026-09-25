import { HubSignIn } from '@/components/hubs/HubSignIn'

export const metadata = { title: 'Parent Hub' }

export default function ParentSignInPage() {
  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-2xl font-black mb-4">Parent Hub</h1>
      <HubSignIn kind="parent" joinHref="/parents/join" />
    </div>
  )
}
