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
   * What to put the spotlight on. A `mode:` target is one row of the sidebar,
   * matched on its key; anything else is a plain `data-tour` attribute. A step
   * whose target isn't on the page is skipped — a coach who can't open the
   * playboard shouldn't be shown a hole where it would be.
   */
  target?: string
  /** Only shown in the War Room itself. */
  warRoomOnly?: boolean
}

export const TOUR_STEPS: TourStep[] = [
  {
    key: 'sidebar',
    target: 'sidebar',
    title: 'Everything you coach with',
    body:
      'Down this side is every tool you have. Drag a row by its ☰ handle to put the ones you use ' +
      'first at the top, and tap a heading — Varsity, JV, Program — to fold it away.',
  },
  {
    key: 'warroom',
    target: 'mode:varsity:warroom',
    title: 'The War Room',
    body:
      'Your day in one screen: today’s practice, what’s next, the games coming up. Varsity and JV ' +
      'each have their own, so the two staffs plan two different weeks without treading on each other.',
  },
  {
    key: 'panels',
    target: 'warroom-panels',
    warRoomOnly: true,
    title: 'Put it in your order',
    body:
      'Each of these panels moves. Drag one by its ☰ and the War Room lays itself out the way you ' +
      'think — the plan first, or the schedule, or the quote on the wall.',
  },
  {
    key: 'planner',
    target: 'mode:varsity:planner',
    title: 'The Planner',
    body:
      'Build a practice block by block. Say when you take the field and when you have to be off it, ' +
      'and every block’s time fits itself around that — no arithmetic.',
  },
  {
    key: 'playboard',
    target: 'mode:playboard',
    title: 'The Playboard',
    body:
      'Draw it up on a real field. Drop a formation, draw the motion, record the play and watch it ' +
      'back. Save it, or send a picture of it straight to the group.',
  },
  {
    key: 'drills',
    target: 'mode:drills',
    title: 'The Drill Bank',
    body:
      'Every drill the program runs, with the setup and the video. Pull one into a practice plan ' +
      'instead of writing it out again.',
  },
  {
    key: 'priorities',
    target: 'mode:varsity:priorities',
    title: 'Priorities',
    body:
      'What you notice on the sideline, written down in seconds while the game is still going. ' +
      'Then it’s waiting for you — colour-coded — the next time you sit down to plan. ' +
      'Varsity and JV keep separate lists, so nothing lands on the wrong staff’s desk.',
  },
  {
    key: 'evaluate',
    target: 'mode:evaluate',
    title: 'Evaluations',
    body:
      'Rate a player on a sliding scale, position by position. Every coach on staff reads every ' +
      'evaluation and the board compiles them, so the depth chart is a conversation, not a guess.',
  },
  {
    key: 'library',
    target: 'mode:library',
    title: 'The Library',
    body: 'Everything you’ve saved — plays, plans, looks — in one place you can search.',
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
