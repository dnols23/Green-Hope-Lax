import type { Metadata } from 'next'
import Link from 'next/link'
import { SCHOOL } from '@/lib/brand'
import { assertPageVisible } from '@/lib/pages'

export const metadata: Metadata = {
  title: 'Eligibility & DragonFly',
  description:
    'Step-by-step directions to get your student-athlete cleared to play Green Hope lacrosse — DragonFly account, sports physical, forms, and NCHSAA eligibility.',
}

// The four steps to get cleared, in order. Edit copy here as your process changes.
const STEPS = [
  {
    title: 'Create your DragonFly account',
    body: 'Download the DragonFly app (App Store or Google Play) or go to dragonflymax.com. Sign up as a parent/guardian, then add your athlete. Search for and connect to Green Hope High School, then select Lacrosse.',
  },
  {
    title: 'Get a sports physical',
    body: 'Schedule a Preparticipation Physical (PPE) with your doctor — it’s valid for 395 days and must stay current through the season. Bring the physical form to the appointment, then upload the completed, signed copy in DragonFly.',
  },
  {
    title: 'Complete and sign every form',
    body: 'In DragonFly, work through each form listed for Green Hope athletics (see the checklist). The parent/guardian and the athlete each sign where prompted. Nothing is missed when every item shows a green check.',
  },
  {
    title: 'Get the “Cleared” status',
    body: 'Once everything is submitted, the school reviews it and marks your athlete Cleared (green) in DragonFly. Check your status there. A player may not try out, practice, or compete until they are fully cleared.',
  },
]

// Forms handled inside DragonFly for Green Hope athletics.
const FORMS = [
  'Preparticipation Physical Evaluation (PPE)',
  'Parent/guardian consent & release',
  'Gfeller-Waller concussion information & statement',
  'Student-athlete & parent code of conduct',
  'Emergency information & medical history',
  'WCPSS athletic participation forms',
]

// General NCHSAA eligibility standards.
const ELIGIBILITY = [
  'Academics — pass the minimum number of courses required the previous semester and meet promotion standards.',
  'Attendance — meet the school’s attendance requirement.',
  'Age — must not turn 19 on or before August 31 of the school year.',
  'Enrollment & residence — enrolled at Green Hope with a valid domicile.',
  'Semesters — within the allowed window of consecutive semesters of eligibility.',
  'Amateur & medical — maintain amateur status and keep a current physical on file.',
]

export default async function EligibilityPage() {
  await assertPageVisible('eligibility')

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="section-label">New to the program? Start here</div>
      <h1 className="page-title mb-2">Eligibility &amp; DragonFly</h1>
      <p className="text-gray-600 mb-8">
        Every Falcon must be <strong>cleared</strong> before they can try out, practice, or step on
        the field. Wake County handles all of it online through <strong>DragonFly</strong>. Plan on
        about 20–30 minutes online plus a doctor’s visit for the physical — start early so your
        athlete is ready for day one.
      </p>

      <section className="card p-6 mb-6">
        <h2 className="font-black text-xl mb-4">Get cleared in 4 steps</h2>
        <ol className="space-y-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex gap-3">
              <span
                className="shrink-0 w-7 h-7 rounded-full text-white text-sm font-black flex items-center justify-center"
                style={{ background: 'var(--gh-green)' }}
              >
                {i + 1}
              </span>
              <div>
                <div className="font-bold">{s.title}</div>
                <p className="text-sm text-gray-600 mt-0.5">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
        <a
          href="https://www.dragonflymax.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-primary mt-5"
        >
          Start in DragonFly ↗
        </a>
      </section>

      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <section className="card p-6">
          <h2 className="font-black text-lg mb-3">Forms in DragonFly</h2>
          <ul className="space-y-1.5 text-sm text-gray-700 list-disc list-inside">
            {FORMS.map((f) => <li key={f}>{f}</li>)}
          </ul>
        </section>

        <section className="card p-6">
          <h2 className="font-black text-lg mb-3">NCHSAA eligibility</h2>
          <ul className="space-y-1.5 text-sm text-gray-700 list-disc list-inside">
            {ELIGIBILITY.map((e) => <li key={e}>{e}</li>)}
          </ul>
        </section>
      </div>

      <section className="card p-6 mb-6">
        <h2 className="font-black text-lg mb-3">Need help or have questions?</h2>
        <p className="text-sm text-gray-600 mb-4">
          A coach is happy to walk you through it — reach out any time and we’ll help you get cleared.
        </p>
        <ul className="space-y-2 text-sm">
          <li><Link href="/contact" className="font-semibold" style={{ color: 'var(--gh-green)' }}>Contact a Green Hope lacrosse coach →</Link></li>
          <li><a href="https://www.dragonflymax.com/" target="_blank" rel="noopener noreferrer" className="font-semibold" style={{ color: 'var(--gh-green)' }}>DragonFly — account &amp; forms ↗</a></li>
          <li><a href={SCHOOL.athleticsUrl} target="_blank" rel="noopener noreferrer" className="font-semibold" style={{ color: 'var(--gh-green)' }}>Green Hope HS Athletics ↗</a></li>
          <li><a href="https://www.nchsaa.org/" target="_blank" rel="noopener noreferrer" className="font-semibold" style={{ color: 'var(--gh-green)' }}>NCHSAA — eligibility rules ↗</a></li>
        </ul>
        <p className="text-xs text-gray-400 mt-4">
          Requirements can change year to year — if anything looks different in DragonFly, follow
          DragonFly and Green Hope Athletics.
        </p>
      </section>

      <div className="text-center">
        <p className="text-gray-600 mb-3">Cleared and ready to play?</p>
        <div className="flex flex-wrap gap-3 justify-center">
          <Link href="/join" className="btn btn-maroon">Join Green Hope Lacrosse</Link>
          <Link href="/join/green-machine" className="btn btn-maroon">Join the Green Machine</Link>
        </div>
      </div>
    </div>
  )
}
