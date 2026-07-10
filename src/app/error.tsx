'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { FalconHead } from '@/components/Logo'

// Branded runtime-error boundary for the whole app. Catches unexpected errors in
// any route and offers a retry instead of the raw Next.js error screen.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center px-4 py-16">
      <FalconHead size={72} className="mb-6 opacity-90" />
      <div className="section-label">Something went wrong</div>
      <h1 className="page-title mt-1 mb-3">We hit a snag</h1>
      <p className="text-gray-600 max-w-md mb-8">
        An unexpected error occurred on our end. Try again, or head back to the home page.
      </p>
      <div className="flex flex-wrap gap-3 justify-center">
        <button onClick={reset} className="btn btn-primary">Try again</button>
        <Link href="/" className="btn btn-ghost">Back to home</Link>
      </div>
    </div>
  )
}
