import Link from 'next/link'
import { FalconBadge } from './Logo'
import { SCHOOL } from '@/lib/brand'

export default function Footer() {
  return (
    <footer className="mt-16" style={{ background: 'var(--gh-green-darker)', color: 'rgba(255,255,255,0.8)' }}>
      <div className="max-w-screen-xl mx-auto px-4 py-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="flex items-center gap-3 mb-3">
            <FalconBadge size={56} variant="light" />
            <div className="leading-tight">
              <div className="text-white font-black">Green Hope Falcons</div>
              <div className="text-xs tracking-widest" style={{ color: '#f3c9cd' }}>LACROSSE</div>
            </div>
          </div>
          <p className="text-sm text-white/60">{SCHOOL.conference}</p>
        </div>

        <div>
          <h3 className="text-white font-bold text-sm mb-3">Explore</h3>
          <ul className="space-y-2 text-sm">
            <li><Link href="/schedule" className="hover:text-white">Schedule &amp; Results</Link></li>
            <li><Link href="/roster" className="hover:text-white">Roster</Link></li>
            <li><Link href="/coaches" className="hover:text-white">Coaches</Link></li>
            <li><Link href="/news" className="hover:text-white">News</Link></li>
            <li><Link href="/resources" className="hover:text-white">Resources</Link></li>
          </ul>
        </div>

        <div>
          <h3 className="text-white font-bold text-sm mb-3">Get Involved</h3>
          <ul className="space-y-2 text-sm">
            <li><Link href="/join" className="hover:text-white">Join Green Hope Lacrosse</Link></li>
            <li><Link href="/contact" className="hover:text-white">Contact Us</Link></li>
          </ul>
        </div>

        <div>
          <h3 className="text-white font-bold text-sm mb-3">Find Us</h3>
          <p className="text-sm text-white/70">{SCHOOL.name}<br />2500 Carpenter Upchurch Rd<br />Cary, NC 27519</p>
          <a href={SCHOOL.mapsUrl} target="_blank" rel="noopener noreferrer" className="inline-block mt-2 text-sm font-semibold hover:text-white" style={{ color: '#f3c9cd' }}>
            View on map ↗
          </a>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="max-w-screen-xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-white/50">
          <span>© {new Date().getFullYear()} Green Hope Falcons Lacrosse. Go Falcons!</span>
          <Link href="/admin" className="hover:text-white/80">Coach / Admin Login</Link>
        </div>
      </div>
    </footer>
  )
}
