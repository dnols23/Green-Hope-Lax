import type { Metadata } from 'next'
import Link from 'next/link'
import { VideoBoard } from '@/components/videoboard/VideoBoard'
import { FalconHead } from '@/components/Logo'

export const metadata: Metadata = {
  title: 'Film Room | Green Hope Falcons Lacrosse',
}

export default function VideoBoardPage() {
  return (
    <div className="flex flex-col h-svh overflow-hidden" style={{ background: '#0b0d0c' }}>
      {/* Header — dark chrome to match the board */}
      <header
        className="text-white shrink-0"
        style={{ background: '#141715', borderBottom: '1px solid #262b27' }}
      >
        <div className="px-4 h-14 flex items-center justify-between">
          <Link href="/team" className="flex items-center gap-2.5">
            <span className="inline-flex items-center justify-center bg-white rounded-lg px-1.5 py-1">
              <FalconHead size={24} />
            </span>
            <span className="flex flex-col leading-none">
              <span className="font-black">Film Room</span>
              <span className="text-[0.6rem] tracking-widest" style={{ color: '#18b877' }}>
                GREEN HOPE FALCONS
              </span>
            </span>
          </Link>
          <Link href="/team" className="text-xs hover:text-white" style={{ color: '#9aa39d' }}>
            ← Team Hub
          </Link>
        </div>
      </header>

      <VideoBoard />
    </div>
  )
}
