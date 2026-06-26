import type { Metadata } from 'next'
import Link from 'next/link'
import { SCHOOL } from '@/lib/brand'
import { assertPageVisible } from '@/lib/pages'

export const metadata: Metadata = { title: 'Resources & Info' }

// Downloadable forms: drop PDFs into /public/forms and list them here.
const FORMS = [
  { label: 'Parent Info Packet (sample)', href: '/forms/parent-info-packet.pdf' },
  { label: 'Physical / Medical Form (sample)', href: '/forms/physical-form.pdf' },
  { label: 'Player Code of Conduct (sample)', href: '/forms/code-of-conduct.pdf' },
]

export default async function ResourcesPage() {
  await assertPageVisible('resources')
  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="section-label">Everything you need</div>
      <h1 className="page-title mb-8">Resources &amp; Info</h1>

      <div className="space-y-8">
        <section className="card p-6">
          <h2 className="font-black text-xl mb-3">Practice Info</h2>
          <ul className="space-y-1.5 text-gray-600 text-sm list-disc list-inside">
            <li>In-season practices are held at Green Hope HS — exact times posted before each season.</li>
            <li>Arrive 15 minutes early, dressed and ready with all gear.</li>
            <li>Check the <Link href="/news" className="text-[var(--gh-green)] font-semibold">News</Link> page for weather cancellations.</li>
          </ul>
        </section>

        <section className="card p-6">
          <h2 className="font-black text-xl mb-3">What to Bring</h2>
          <ul className="space-y-1.5 text-gray-600 text-sm list-disc list-inside">
            <li>Stick, helmet, shoulder pads, arm pads, gloves, mouthguard, cleats.</li>
            <li>Water bottle (label it!) and weather-appropriate layers.</li>
            <li>Any medications and a fully completed physical on file.</li>
          </ul>
        </section>

        <section className="card p-6">
          <h2 className="font-black text-xl mb-3">Fees &amp; Forms</h2>
          <p className="text-gray-600 text-sm mb-4">
            Download and complete the forms below before the first practice. (These are
            placeholders — replace the PDFs in <code>/public/forms</code> with your real documents.)
          </p>
          <ul className="space-y-2">
            {FORMS.map((f) => (
              <li key={f.href}>
                <a href={f.href} className="btn btn-ghost w-full sm:w-auto justify-start" target="_blank" rel="noopener noreferrer">
                  📄 {f.label}
                </a>
              </li>
            ))}
          </ul>
        </section>

        <section className="card p-6">
          <h2 className="font-black text-xl mb-3">Important Dates</h2>
          <p className="text-gray-600 text-sm">
            Tryout, season, and banquet dates are announced each year on the{' '}
            <Link href="/news" className="text-[var(--gh-green)] font-semibold">News</Link> page and the{' '}
            <Link href="/schedule" className="text-[var(--gh-green)] font-semibold">Schedule</Link>.
          </p>
        </section>

        <section className="card p-6">
          <h2 className="font-black text-xl mb-3">Links</h2>
          <ul className="space-y-2 text-sm">
            <li><a href={SCHOOL.athleticsUrl} target="_blank" rel="noopener noreferrer" className="text-[var(--gh-green)] font-semibold">Green Hope HS Athletics ↗</a></li>
          </ul>
        </section>
      </div>
    </div>
  )
}
