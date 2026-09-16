'use client'
import dynamic from 'next/dynamic'

/**
 * The board is a browser-only thing.
 *
 * Its plays live in this device's storage, so rendering it on the server would
 * paint an empty field and then swap it for the saved one — a flash, and a
 * hydration mismatch. Loading it in the browser only means what appears is
 * already right.
 */
const QuickBoard = dynamic(() => import('./QuickBoard'), {
  ssr: false,
  loading: () => (
    <div className="flex-1 min-h-0 flex items-center justify-center text-sm text-gray-400">
      Opening the board…
    </div>
  ),
})

export function PlayboardClient() {
  return <QuickBoard />
}
