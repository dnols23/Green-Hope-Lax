import type { Metadata } from 'next'
import Link from 'next/link'
import { VideoBoard } from '@/components/VideoBoard'
import { FalconHead } from '@/components/Logo'

export const metadata: Metadata = {
  title: 'Video Board | Green Hope Falcons Lacrosse',
}

export default function VideoBoardPage() {
  return (
    <div className="flex flex-col h-svh overflow-hidden">
      {/* Header */}
      <header className="text-white shrink-0" style={{ background: 'var(--gh-green-dk)' }}>
        <div className="px-4 h-14 flex items-center justify-between">
          <Link href="/team" className="flex items-center gap-2.5">
            <span className="inline-flex items-center justify-center bg-white rounded-lg px-1.5 py-1">
              <FalconHead size={24} />
            </span>
            <span className="flex flex-col leading-none">
              <span className="font-black">Video Board</span>
              <span className="text-[0.6rem] tracking-widest" style={{ color: '#f3c9cd' }}>GREEN HOPE FALCONS</span>
            </span>
          </Link>
          <Link href="/team" className="text-xs text-white/70 hover:text-white">← Team Hub</Link>
        </div>
      </header>

      <VideoBoard />
    </div>
  )
}
