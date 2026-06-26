import type { Metadata } from 'next'
import Link from 'next/link'
import { SCHOOL } from '@/lib/brand'
import { assertPageVisible } from '@/lib/pages'

export const metadata: Metadata = {
  title: 'Eligibility & DragonFly',
  description:
    'What a student-athlete must complete — DragonFly clearance, physical, forms, and NCHSAA eligibility — before practicing or playing for Green Hope lacrosse.',
}

// Steps to get cleared, in order. Edit the copy here as your process changes.
const STEPS = [
  {
    title: 'Create a DragonFly account',
    body: 'Parent/guardian and student-athlete each set up a free account at dragonflymax.com or in the DragonFly Health app. Connect to Green Hope High School and select the lacrosse program.',
  },
  {
    title: 'Get a current sports physical',
    body: 'A Preparticipation Physical (PPE) signed by a licensed provider is required and is good for 395 days. Upload it in DragonFly. Your athlete cannot be cleared without a valid physical on file.',
  },
  {
    title: 'Complete & e-sign all required forms',
    body: 'Work through every form DragonFly lists for Green Hope athletics (see the checklist below). Both the parent and the athlete sign where required.',
  },
  {
    title: 'Wait to be marked “Cleared”',
    body: 'The school reviews everything and marks the athlete cleared (green) in DragonFly. A player may NOT practice, try out, or compete until they are fully cleared.',
  },
]

// Typical NCHSAA / WCPSS forms handled inside DragonFly. Confirm the exact,
// current list in DragonFly or with the Athletic Director.
const FORMS = [
  'Preparticipation Physical Evaluation (PPE)',
  'Parent/guardian consent & release',
  'Gfeller-Waller concussion information & statement',
  'Student-athlete & parent code of conduct',
  'Emergency information & medical history',
  'WCPSS athletic participation / eligibility forms',
]

// General NCHSAA eligibility standards. Always verify the current rules with
// Green Hope Athletics — they can change year to year.
const ELIGIBILITY = [
  'Academics: pass the minimum number of courses required the previous semester and meet promotion standards.',
  'Attendance: meet the school attendance requirement.',
  'Age: must not turn 19 on or before August 31 of the school year.',
  'Enrollment & domicile: be enrolled at Green Hope and live within a valid residence/domicile.',
  'Semesters: within the allowed window of consecutive semesters of eligibility.',
  'Amateur & medical: maintain amateur status and have a valid physical on file.',
]

export default async function EligibilityPage() {
  await assertPageVisible('eligibility')

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="section-label">New to the program? Start here</div>
      <h1 className="page-title mb-2">Eligibility &amp; DragonFly</h1>
      <p className="text-gray-600 mb-8">
        Before a student-athlete can try out, practice, or step on the field with Green Hope
        lacrosse, they must be <strong>cleared</strong>. Everything below is handled online
        through <strong>DragonFly</strong>, the system Wake County uses for athletic eligibility
        and forms. Knock these out early so your athlete is ready for day one.
      </p>

      <section className="card p-6 mb-6">
        <h2 className="font-black text-xl mb-4">Get cleared — step by step</h2>
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
      </section>

      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <section className="card p-6">
          <h2 className="font-black text-lg mb-1">Forms in DragonFly</h2>
          <p className="text-sm text-gray-500 mb-3">Typical required forms — confirm the exact list in DragonFly:</p>
          <ul className="space-y-1.5 text-sm text-gray-700 list-disc list-inside">
            {FORMS.map((f) => <li key={f}>{f}</li>)}
          </ul>
        </section>

        <section className="card p-6">
          <h2 className="font-black text-lg mb-1">NCHSAA eligibility</h2>
          <p className="text-sm text-gray-500 mb-3">To be eligible for a varsity/JV team, a student generally must meet:</p>
          <ul className="space-y-1.5 text-sm text-gray-700 list-disc list-inside">
            {ELIGIBILITY.map((e) => <li key={e}>{e}</li>)}
          </ul>
        </section>
      </div>

      <section className="card p-6 mb-6">
        <h2 className="font-black text-lg mb-3">Helpful links</h2>
        <ul className="space-y-2 text-sm">
          <li><a href="https://www.dragonflymax.com/" target="_blank" rel="noopener noreferrer" className="font-semibold" style={{ color: 'var(--gh-green)' }}>DragonFly — create an account &amp; complete forms ↗</a></li>
          <li><a href={SCHOOL.athleticsUrl} target="_blank" rel="noopener noreferrer" className="font-semibold" style={{ color: 'var(--gh-green)' }}>Green Hope HS Athletics ↗</a></li>
          <li><a href="https://www.nchsaa.org/" target="_blank" rel="noopener noreferrer" className="font-semibold" style={{ color: 'var(--gh-green)' }}>NCHSAA — eligibility rules ↗</a></li>
        </ul>
      </section>

      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 mb-8">
        <strong>Please confirm before you rely on this.</strong> Requirements and forms can change
        each year. This page is a starting guide — verify the current steps with Green Hope Athletics
        and inside DragonFly. Questions? <Link href="/contact" className="font-semibold underline">Contact us</Link> and a coach will help.
      </div>

      <div className="text-center">
        <p className="text-gray-600 mb-3">Ready to join once you’re cleared?</p>
        <div className="flex flex-wrap gap-3 justify-center">
          <Link href="/join" className="btn btn-maroon">Join the Team</Link>
          <Link href="/join/green-machine" className="btn btn-maroon">Join the Green Machine</Link>
        </div>
      </div>
    </div>
  )
}
