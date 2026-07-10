import type { Metadata } from 'next'
import { getCoaches } from '@/lib/queries'
import { assertPageVisible } from '@/lib/pages'
import { FalconHead } from '@/components/Logo'

export const metadata: Metadata = {
  title: 'Coaches & Staff',
  description: 'Meet the coaches and staff behind the Green Hope Falcons lacrosse program in Cary, NC.',
}

export default async function CoachesPage() {
  await assertPageVisible('coaches')
  const coaches = await getCoaches()
  return (
    <div className="max-w-screen-xl mx-auto px-4 py-10">
      <div className="section-label">Leadership</div>
      <h1 className="page-title mb-6">Coaches &amp; Staff</h1>

      {coaches.length === 0 ? (
        <p className="text-gray-500">Coaching staff will be listed here soon.</p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {coaches.map((c) => (
            <div key={c.id} className="card p-5 flex gap-4">
              <div className="shrink-0 w-20 h-20 rounded-full overflow-hidden flex items-center justify-center" style={{ background: 'linear-gradient(160deg,#f0f4f1,#e4eae6)' }}>
                {c.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.photo_url} alt={c.name} className="w-full h-full object-cover" />
                ) : (
                  <FalconHead size={44} className="opacity-30" />
                )}
              </div>
              <div className="min-w-0">
                <div className="font-bold text-lg leading-tight">{c.name}</div>
                <div className="text-sm font-semibold" style={{ color: 'var(--gh-maroon)' }}>{c.role}</div>
                {c.bio && <p className="text-sm text-gray-500 mt-2">{c.bio}</p>}
                <div className="mt-2 text-sm space-y-0.5">
                  {c.email && <div><a href={`mailto:${c.email}`} className="text-[var(--gh-green)] font-semibold break-all">{c.email}</a></div>}
                  {c.phone && <div className="text-gray-500">{c.phone}</div>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
