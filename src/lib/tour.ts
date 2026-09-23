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

/**
 * Who is being shown round.
 *
 * Two questions: which side of the program he works on, and whether he runs a
 * team or helps run one. They are different jobs — a head coach is being shown
 * the tools he will use to decide things, an assistant the tools he will use to
 * coach his group — so they get different walk-rounds rather than one written
 * for the middle.
 */
export type Audience = 'varsity-head' | 'varsity-assistant' | 'jv-head' | 'jv-assistant'

export const AUDIENCE_LABELS: Record<Audience, string> = {
  'varsity-head': 'Varsity head coach',
  'varsity-assistant': 'Varsity assistant',
  'jv-head': 'JV head coach',
  'jv-assistant': 'JV assistant',
}

export function audienceOf(opts: {
  isOwner: boolean
  role: 'head' | 'jv-head' | 'assistant'
  team: 'all' | 'varsity' | 'jv'
}): Audience {
  // Whoever runs the program is the varsity head coach, whatever else is set.
  if (opts.isOwner) return 'varsity-head'
  /* The role says which team he runs, and it beats the team switch: a JV head
     coach who also helps with varsity is still a JV head coach, and the
     walk-round he wants is the one about running JV. */
  if (opts.role === 'jv-head') return 'jv-head'
  const side = opts.team === 'jv' ? 'jv' : 'varsity'
  const rank = opts.role === 'head' ? 'head' : 'assistant'
  return `${side}-${rank}` as Audience
}

/** Every stop that exists. A tour is a list of these, in order. */
const STOPS: Record<string, TourStep> = {
  here: {
    key: 'here',
    target: 'sidebar',
    title: 'It all lives here',
    body:
      'Every part of the job, down one side. What you teach, how you teach it, and what you do with ' +
      'what you find out — no folder on somebody’s laptop, no notebook in the truck. One place, and ' +
      'you’re in it.',
  },
  hereJv: {
    key: 'here',
    target: 'sidebar',
    title: 'This is the JV program',
    body:
      'All of it, down one side, and all of it yours. JV keeps its own week, its own plans, its own ' +
      'shed and its own list of what needs work — nothing here is the varsity staff’s to move.',
  },
  warroom: {
    key: 'warroom',
    target: 'team:warroom',
    title: 'Start in the War Room',
    body:
      'Today’s practice. The next one. Who we play next and the scout on them. You look once and you ' +
      'know where the program is — then you go to work.',
  },
  warroomAssistant: {
    key: 'warroom',
    target: 'team:warroom',
    title: 'Start in the War Room',
    body:
      'Today’s plan, the next one, and who we play next. Open it before you walk out and you already ' +
      'know what you’re running and what your group is doing.',
  },
  calendar: {
    key: 'calendar',
    target: 'mode:calendar',
    title: 'The whole season, one calendar',
    body:
      'Day, week, month, the whole year. Put anything on it — a practice, film, the team dinner, the ' +
      'bus time — and pick who sees it: just the staff, the players, the parents, or everyone. And ' +
      'before you plan a thing, see which coaches are out, so you find out now and not at practice.',
  },
  calendarAssistant: {
    key: 'calendar',
    target: 'mode:calendar',
    title: 'Tell us when you can’t be there',
    body:
      'Set your availability — the Tuesday you work late, the weekend you’re away — and the head ' +
      'coach plans around you instead of finding out at practice. Everything coming up is on the same ' +
      'calendar: games, practices, meetings, by the day, the week or the month.',
  },
  rosters: {
    key: 'rosters',
    target: 'mode:rosters',
    title: 'Your squad',
    body:
      'Build a roster, or paste one straight in off a spreadsheet. Keep as many as you need — ' +
      'tryouts, JV, the travel squad — and put a season away when it is over instead of deleting it. ' +
      'Point a practice plan at one and every block knows who is in it.',
  },
  rostersAssistant: {
    key: 'rosters',
    target: 'mode:rosters',
    title: 'Who is on the team',
    body:
      'Every squad the program keeps — this season’s, tryouts, last season’s put away. You can build ' +
      'one yourself too, and a plan pointed at a roster tells every block who is in it.',
  },
  planner: {
    key: 'planner',
    target: 'team:planner',
    title: 'Build the practice',
    body:
      'Block by block. Tell it when you take the field and when you have to be off it and every ' +
      'minute fits itself. Open any drill on the plan and it tells you how it’s set up, what it’s ' +
      'teaching and where the video is — so the coach running it has coached it before he blows the ' +
      'whistle. Score it, and somebody wins practice. Game plans and scouting reports live here too.',
  },
  plannerAssistant: {
    key: 'planner',
    target: 'team:planner',
    title: 'The practice plan',
    body:
      'Every practice, block by block, with your name on the ones you’re running. Open a drill on ' +
      'the plan and it tells you how it goes out, what it’s teaching and where the video is — so you ' +
      'have coached it before you blow the whistle. Write your own plans here too.',
  },
  drills: {
    key: 'drills',
    target: 'mode:drills',
    title: 'Every drill we run',
    body:
      'The whole bank — setup, the point of it, the film. This is the teaching. Pull one straight ' +
      'onto a plan and it takes all of that with it.',
  },
  playboard: {
    key: 'playboard',
    target: 'mode:playboard',
    title: 'Draw it up',
    body:
      'A real field. Drop a formation, draw the motion, record it and watch it back. What you drew ' +
      'at the kitchen table is on your phone at practice.',
  },
  playbook: {
    key: 'playbook',
    target: 'team:playbook',
    title: 'That’s the playbook',
    body:
      'The plays you drew, in the order we install them, with the reads and the coaching points ' +
      'around them. Publish it and the players are reading the same page you are. Teaching becomes ' +
      'coaching right here.',
  },
  playbookAssistant: {
    key: 'playbook',
    target: 'team:playbook',
    title: 'What we run',
    body:
      'The playbook, page by page, in the order we install it — every play drawn up with the reads ' +
      'and the coaching points beside it. The head coach writes it; you and the players read the ' +
      'same pages.',
  },
  priorities: {
    key: 'priorities',
    target: 'team:priorities',
    title: 'What you saw on Saturday',
    body:
      'Ten seconds on the sideline and it’s written down — ranked by how badly it matters. Sunday ' +
      'night it’s sitting in front of you while you write the plan. Nothing gets lost between the ' +
      'game and the next practice.',
  },
  prioritiesAssistant: {
    key: 'priorities',
    target: 'team:priorities',
    title: 'Say what you saw',
    body:
      'You will see something on Saturday that nobody else does. Ten seconds, written down, ranked ' +
      'by how badly it matters — and it is in front of the staff when the next practice is written. ' +
      'This is how what you notice turns into what we work on.',
  },
  evaluate: {
    key: 'evaluate',
    target: 'mode:evaluate',
    title: 'Who’s playing',
    body:
      'Rate a player position by position on a sliding scale. Every coach sees every evaluation and ' +
      'the board compiles them, so the depth chart is something the staff arrived at together — not ' +
      'a hunch defended in a meeting.',
  },
  evaluateAssistant: {
    key: 'evaluate',
    target: 'mode:evaluate',
    title: 'Your say on the depth chart',
    body:
      'Rate a player position by position. Your evaluations carry the same weight as anybody’s, the ' +
      'whole staff reads them and the board compiles them — so if you think a kid is ready, this is ' +
      'where you say so.',
  },
  library: {
    key: 'library',
    target: 'mode:library',
    title: 'Your own shelf',
    body:
      'Plays, screenshots, looks — yours, not the staff’s pile. Anything on it drops straight into a ' +
      'practice plan or a game plan, and it’s still here next season. That’s it — go coach.',
  },
  libraryHead: {
    key: 'library',
    target: 'mode:library',
    title: 'Your own shelf',
    body:
      'Plays, screenshots, looks. Every coach keeps his own, and you can look at any of theirs — ' +
      'handy for knowing who is actually building something. That’s it — go coach.',
  },
}

/** The four walk-rounds. */
export const TOURS: Record<Audience, TourStep[]> = {
  'varsity-head': [
    STOPS.here, STOPS.warroom, STOPS.calendar, STOPS.rosters, STOPS.planner, STOPS.drills,
    STOPS.playboard, STOPS.playbook, STOPS.priorities, STOPS.evaluate, STOPS.libraryHead,
  ],
  'jv-head': [
    STOPS.hereJv, STOPS.warroom, STOPS.calendar, STOPS.rosters, STOPS.planner, STOPS.drills,
    STOPS.playboard, STOPS.playbookAssistant, STOPS.priorities, STOPS.evaluate, STOPS.library,
  ],
  'varsity-assistant': [
    STOPS.here, STOPS.warroomAssistant, STOPS.calendarAssistant, STOPS.plannerAssistant, STOPS.drills,
    STOPS.playbookAssistant, STOPS.playboard, STOPS.rostersAssistant,
    STOPS.prioritiesAssistant, STOPS.evaluateAssistant, STOPS.library,
  ],
  'jv-assistant': [
    STOPS.hereJv, STOPS.warroomAssistant, STOPS.calendarAssistant, STOPS.plannerAssistant, STOPS.drills,
    STOPS.playbookAssistant, STOPS.playboard, STOPS.rostersAssistant,
    STOPS.prioritiesAssistant, STOPS.evaluateAssistant, STOPS.library,
  ],
}

/** Kept for anything that still asks for "the tour" without saying whose. */
export const TOUR_STEPS: TourStep[] = TOURS['varsity-head']

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
