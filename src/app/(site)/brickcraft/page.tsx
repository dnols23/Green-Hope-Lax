import type { Metadata } from 'next'
import Link from 'next/link'
import BrickCraft from '@/components/brickcraft/BrickCraft'
import { assertPageVisible } from '@/lib/pages'

export const metadata: Metadata = {
  title: 'BrickCraft — Falcons Arcade',
  description:
    'BrickCraft: a Green Hope Falcons brick-breaker. Six levels, three balls, power-ups. Play free in your browser on phone or desktop.',
}

const HOW_TO = [
  ['Move the stick', 'Slide your finger or mouse across the field, or use ← → (or A / D).'],
  ['Shoot', 'Tap the field or press Space to send the ball off the stick head.'],
  ['Angle it', 'Where the ball hits the head sets the angle — the middle sends it straight back, the edges cut it hard.'],
  ['Keep it alive', 'Let the ball cross the endline and you lose one. Three balls, six levels.'],
]

const BRICKS = [
  { color: '#12b06a', name: 'Green', note: 'One hit — 50 points.' },
  { color: '#b8394a', name: 'Maroon', note: 'Two hits — 80 points.' },
  { color: '#c9a227', name: 'Steel', note: 'Three hits — 120 points.' },
  { color: '#5a6a60', name: 'Wall', note: 'Never breaks. Play around it.' },
]

const POWERS = [
  ['↔ Wide stick', 'A bigger head for nine seconds.'],
  ['⁝⁝ Multi-ball', 'Splits into three balls at once.'],
  ['◷ Slow-mo', 'Takes the pace off for nine seconds.'],
  ['+1 Extra ball', 'One more ball in the bag.'],
]

export default async function BrickCraftPage() {
  await assertPageVisible('brickcraft')

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="section-label">Falcons Arcade</div>
      <h1 className="page-title mb-2">BrickCraft</h1>
      <p className="text-gray-600 mb-6">
        Six levels of bricks, one lacrosse ball, and a crosse to keep it off the endline. Clear the
        board to move on — every level comes at you faster than the last. Free, no sign-in, and your
        best score is saved right in this browser.
      </p>

      <BrickCraft />

      <div className="grid md:grid-cols-2 gap-6 mt-8">
        <section className="card p-6">
          <h2 className="font-black text-lg mb-3">How to play</h2>
          <ol className="space-y-3">
            {HOW_TO.map(([title, body], i) => (
              <li key={title} className="flex gap-3">
                <span
                  className="shrink-0 w-6 h-6 rounded-full text-white text-xs font-black flex items-center justify-center"
                  style={{ background: 'var(--gh-green)' }}
                >
                  {i + 1}
                </span>
                <div>
                  <div className="font-bold text-sm">{title}</div>
                  <p className="text-sm text-gray-600 mt-0.5">{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <div className="space-y-6">
          <section className="card p-6">
            <h2 className="font-black text-lg mb-3">The bricks</h2>
            <ul className="space-y-2">
              {BRICKS.map((b) => (
                <li key={b.name} className="flex items-center gap-3 text-sm">
                  <span
                    className="shrink-0 w-8 h-4 rounded"
                    style={{ background: b.color }}
                    aria-hidden="true"
                  />
                  <span>
                    <strong>{b.name}</strong>{' '}
                    <span className="text-gray-600">— {b.note}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="card p-6">
            <h2 className="font-black text-lg mb-3">Power-ups</h2>
            <ul className="space-y-2 text-sm">
              {POWERS.map(([name, note]) => (
                <li key={name}>
                  <strong>{name}</strong> <span className="text-gray-600">— {note}</span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-gray-400 mt-3">
              They drop from broken bricks — catch them with the stick head.
            </p>
          </section>
        </div>
      </div>

      <div className="text-center mt-10">
        <p className="text-gray-600 mb-3">Rather play the real thing?</p>
        <div className="flex flex-wrap gap-3 justify-center">
          <Link href="/join" className="btn btn-maroon">Join Green Hope Lacrosse</Link>
          <Link href="/schedule" className="btn btn-ghost">See the schedule</Link>
        </div>
      </div>
    </div>
  )
}
