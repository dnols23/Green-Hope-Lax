export const metadata = { title: 'Parent Hub' }

export default function ParentWelcomePage() {
  return (
    <div className="card p-8 text-center">
      <h1 className="text-2xl font-black mb-2">Parent Hub</h1>
      <p className="text-gray-600">
        The Parent Hub opens from the link Coach Nolan sends in the team email. Follow that
        link once on this phone or computer and you will stay signed in.
      </p>
      <p className="text-sm text-gray-400 mt-4">
        Can&rsquo;t find it? Email{' '}
        <a href="mailto:info@greenhopelacrosse.com" className="font-semibold text-[var(--gh-green)]">
          info@greenhopelacrosse.com
        </a>{' '}
        and we will send it again.
      </p>
    </div>
  )
}
