import { requireSection } from '@/lib/permissions'
import { ContentTabs } from '../ContentTabs'

export const metadata = { title: 'Instagram · Process' }

const WEEK: { day: string; what: string; detail: string }[] = [
  { day: 'Sun', what: 'Plan', detail: 'Pick the two videos for the week on the Board. Check the shot lists and that everyone featured has a media release. Post at 7pm.' },
  { day: 'Tue', what: 'Shoot', detail: 'Shoot at practice off the checklist. Tick shots as you get them.' },
  { day: 'Tue night', what: 'Dump', detail: 'Everything off the phone into Drive → IG/01_Inbox/<date>. Paste the folder link on the video.' },
  { day: 'Wed', what: 'Edit', detail: 'Cut in Canva from the series template. Best clips to 02_Selects; export to 03_Exports. Status → Editing, then Ready.' },
  { day: 'Thu', what: 'Shoot + post', detail: 'Shoot the second video at practice. Post Tuesday’s at 7pm ET — copy the caption from the video page.' },
  { day: 'Fri/Sat', what: 'Edit', detail: 'Cut Thursday’s video for Sunday. Status → Ready.' },
  { day: 'Sun', what: 'Post', detail: 'Post at 7pm ET, paste the Instagram link on the video, status → Posted. Plan next week.' },
]

export default async function ContentProcessPage() {
  await requireSection('social')
  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <ContentTabs active="playbook" />
        <h1 className="text-xl font-black mb-1">Process</h1>
        <p className="text-gray-500 text-sm">Two Reels a week, one coach, one phone.</p>
      </div>

      <section className="card p-5">
        <h2 className="font-bold text-gray-700 mb-3">The weekly loop</h2>
        <ol className="space-y-2.5">
          {WEEK.map((w, n) => (
            <li key={n} className="flex gap-3">
              <span className="w-20 shrink-0 text-xs font-black uppercase tracking-wider text-[var(--gh-green)] pt-0.5">{w.day}</span>
              <span className="text-sm">
                <b>{w.what}.</b> {w.detail}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <div className="grid sm:grid-cols-2 gap-4">
        <Rules
          title="📱 Shooting on the phone"
          items={[
            'Vertical, 4K at 60fps. Slow-mo at 120/240 for the one money shot.',
            'Get 3× the clips you think you need — 2–4 seconds each.',
            'The hook lands in the first 1.5 seconds: the loudest, fastest moment first. No title cards.',
            'Lock exposure on bright days; wipe the lens.',
            'Shoot from low and close. Over shoulders for huddles.',
            'Only players with a media release on screen and identifiable.',
          ]}
        />
        <Rules
          title="🎨 Canva"
          items={[
            '1080 × 1920, from the series template.',
            'Keep text inside the safe zone: clear of the top ~250px and the bottom ~400px, where Instagram’s buttons and caption sit.',
            'Burn the captions in — most people watch muted.',
            'Team colors only: green, white, black. The falcon on the end card.',
            'Export MP4 to Drive → IG/03_Exports.',
          ]}
        />
        <Rules
          title="🎙 Where ElevenLabs fits"
          items={[
            'Narration for Drill of the Week; announcer for Game Day and Back in Black. Each series says which.',
            'Write the script on the video page, pick a voice, generate, download the mp3, drop it into Canva.',
            'Sound effects for transitions and hits: describe it, set the seconds (½–22).',
            'Voice clones: coach/adult voices only. Never clone a player’s voice.',
          ]}
        />
        <Rules
          title="🗂 Drive layout"
          items={[
            'IG/01_Inbox — raw dumps, one folder per shoot day.',
            'IG/02_Selects — the clips that made the cut.',
            'IG/03_Exports — finished videos, named date + title.',
            'IG/Brand — logos, fonts, end cards, the uniform shots.',
          ]}
        />
      </div>

      <section className="card p-5">
        <h2 className="font-bold text-gray-700 mb-2">📊 Monthly review</h2>
        <ul className="list-disc pl-5 space-y-1 text-sm text-gray-700">
          <li>First Sunday of the month: fill in views, likes, shares and saves on last month’s posted videos.</li>
          <li>Rank by <b>shares + saves</b> — they’re the ones that travel and get kept. Views follow them.</li>
          <li>Make more of the top series next month; rework or drop the bottom one.</li>
          <li>Note what the best hook was, on the video, so the next one starts from it.</li>
        </ul>
      </section>
    </div>
  )
}

function Rules({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="card p-5">
      <h2 className="font-bold text-gray-700 mb-2">{title}</h2>
      <ul className="list-disc pl-5 space-y-1 text-sm text-gray-700">
        {items.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
    </section>
  )
}
