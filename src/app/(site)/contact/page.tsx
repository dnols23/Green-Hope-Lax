import type { Metadata } from 'next'
import { ContactForm } from '@/components/ContactForm'
import { SCHOOL } from '@/lib/brand'
import { assertPageVisible } from '@/lib/pages'

export const metadata: Metadata = { title: 'Contact' }

export default async function ContactPage() {
  await assertPageVisible('contact')
  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="section-label">Get in touch</div>
      <h1 className="page-title mb-2">Contact Us</h1>
      <p className="text-gray-600 mb-8">
        Questions about the program, schedule, or getting involved? Send us a message.
        Looking to play? Head to the <a href="/join" className="text-[var(--gh-green)] font-semibold">Join the Team</a> page instead.
      </p>

      <ContactForm />

      <div className="card p-6 mt-6">
        <h2 className="font-bold mb-2">Find us</h2>
        <p className="text-gray-600 text-sm">
          {SCHOOL.name}<br />
          2500 Carpenter Upchurch Rd, Cary, NC 27519
        </p>
        <a href={SCHOOL.mapsUrl} target="_blank" rel="noopener noreferrer" className="inline-block mt-2 text-sm font-bold" style={{ color: 'var(--gh-green)' }}>
          Open in Google Maps ↗
        </a>
      </div>
    </div>
  )
}
