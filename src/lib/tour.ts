// The first-run welcome and the walk round the Coaches Hub.
//
// Pure — the component that draws it is a client component, but what the tour
// says lives here so it reads as one piece of writing rather than being buried
// in JSX.

export const TOUR_KEY = 'gh-hub-tour-v1'
export const TOUR_EVENT = 'gh-hub-tour-start'

export interface TourStep {
  key: string
  title: string
  body: string
  /**
   * What to put the spotlight on.
   *
   *   sidebar        a plain `data-tour` attribute
   *   mode:<key>     one row of the sidebar, matched exactly
   *   team:<key>     that row on whichever side of the program this coach
   *                  works on — the JV coach's JV planner, the head coach's
   *                  varsity one — because a tour pointing at a varsity row a
   *                  JV coach does not have would just skip the step.
   *
   * A step whose target isn't on the page is skipped, so a coach without the
   * playboard is never shown a hole where it would be.
   */
  target?: string
}

export const TOUR_STEPS: TourStep[] = [
  {
    key: 'sidebar',
    target: 'sidebar',
    title: 'It all lives here',
    body:
      'Every part of the job, down one side. What you teach, how you teach it, and what you do with ' +
      'what you find out — no folder on somebody’s laptop, no notebook in the truck. One place, and ' +
      'you’re in it.',
  },
  {
    key: 'warroom',
    target: 'team:warroom',
    title: 'Start in the War Room',
    body:
      'Today’s practice. The next one. Who we play next and the scout on them. You look once and you ' +
      'know where the program is — then you go to work.',
  },
  {
    key: 'rosters',
    target: 'mode:rosters',
    title: 'Your squad',
    body:
      'Build a roster, or paste one straight in off a spreadsheet. Keep as many as you need — ' +
      'tryouts, JV, the travel squad — and put a season away when it is over instead of deleting it. ' +
      'Point a practice plan at one and every block knows who is in it.',
  },
  {
    key: 'planner',
    target: 'team:planner',
    title: 'Build the practice',
    body:
      'Block by block. Tell it when you take the field and when you have to be off it and every ' +
      'minute fits itself. Open any drill on the plan and it tells you how it’s set up, what it’s ' +
      'teaching and where the video is — so the coach running it has coached it before he blows the ' +
      'whistle. Score it, and somebody wins practice. Game plans and scouting reports live here too.',
  },
  {
    key: 'drills',
    target: 'mode:drills',
    title: 'Every drill we run',
    body:
      'The whole bank — setup, the point of it, the film. This is the teaching. Pull one straight ' +
      'onto a plan and it takes all of that with it.',
  },
  {
    key: 'playboard',
    target: 'mode:playboard',
    title: 'Draw it up',
    body:
      'A real field. Drop a formation, draw the motion, record it and watch it back. What you drew ' +
      'at the kitchen table is on your phone at practice.',
  },
  {
    key: 'playbook',
    target: 'team:playbook',
    title: 'That’s the playbook',
    body:
      'The plays you drew, in the order we install them, with the reads and the coaching points ' +
      'around them. Publish it and the players are reading the same page you are. Teaching becomes ' +
      'coaching right here.',
  },
  {
    key: 'priorities',
    target: 'team:priorities',
    title: 'What you saw on Saturday',
    body:
      'Ten seconds on the sideline and it’s written down — ranked by how badly it matters. Sunday ' +
      'night it’s sitting in front of you while you write the plan. Nothing gets lost between the ' +
      'game and the next practice.',
  },
  {
    key: 'evaluate',
    target: 'mode:evaluate',
    title: 'Who’s playing',
    body:
      'Rate a player position by position on a sliding scale. Every coach sees every evaluation and ' +
      'the board compiles them, so the depth chart is something the staff arrived at together — not ' +
      'a hunch defended in a meeting.',
  },
  {
    key: 'library',
    target: 'mode:library',
    title: 'And everything is kept',
    body:
      'Plays, screenshots, looks, plans. A season’s work that’s still here next season. That’s it — ' +
      'go coach.',
  },
]

export type Platform = 'ios' | 'android' | 'desktop'

export interface InstallGuide {
  platform: Platform
  heading: string
  steps: string[]
}

/** Which set of directions this device needs. */
export function platformOf(ua: string, maxTouchPoints: number): Platform {
  const s = ua.toLowerCase()
  // iPadOS reports itself as a Mac, and only the touch count gives it away.
  if (/iphone|ipad|ipod/.test(s)) return 'ios'
  if (/macintosh/.test(s) && maxTouchPoints > 1) return 'ios'
  if (/android/.test(s)) return 'android'
  return 'desktop'
}

export const INSTALL_GUIDES: Record<Platform, InstallGuide> = {
  ios: {
    platform: 'ios',
    heading: 'On your iPhone or iPad',
    steps: [
      'Tap the Share button at the bottom of Safari — the square with an arrow coming out of it.',
      'Scroll the list and tap Add to Home Screen.',
      'Tap Add. The falcon lands on your home screen like any other app.',
    ],
  },
  android: {
    platform: 'android',
    heading: 'On your Android phone',
    steps: [
      'Tap the ⋮ menu at the top right of Chrome.',
      'Tap Install app, or Add to Home screen if that’s what it says.',
      'Tap Install. The falcon lands on your home screen like any other app.',
    ],
  },
  desktop: {
    platform: 'desktop',
    heading: 'On this computer',
    steps: [
      'Look for the install icon at the right-hand end of the address bar — a screen with an arrow.',
      'No icon? Open the ⋮ menu, then Cast, save and share → Install page as app.',
      'It opens in its own window, without the browser round the edges.',
    ],
  },
}
