import Link from 'next/link'
import { FalconHead } from '@/components/Logo'

// Branded 404. Rendered whenever notFound() fires — a bad news slug, or any page
// an admin has toggled Hidden (assertPageVisible). Standalone (no site nav), so
// it works for every route.
export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center px-4 py-16">
      <FalconHead size={72} className="mb-6 opacity-90" />
      <div className="section-label">Error 404</div>
      <h1 className="page-title mt-1 mb-3">Page not found</h1>
      <p className="text-gray-600 max-w-md mb-8">
        The page you’re looking for doesn’t exist or may have been moved. Let’s get you back on the field.
      </p>
      <div className="flex flex-wrap gap-3 justify-center">
        <Link href="/" className="btn btn-primary">Back to home</Link>
        <Link href="/schedule" className="btn btn-ghost">View schedule</Link>
      </div>
    </div>
  )
}
