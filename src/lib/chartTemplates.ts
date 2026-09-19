import type { ChartType } from './charts'
import type { NoteChart, NoteChartSeries } from './noteBlocks'
import { newId } from './planner'

/**
 * Charts a lacrosse staff actually keeps, ready to type into.
 *
 * Picking a chart type and naming the columns is work nobody wants to do at
 * eight on a Sunday night. Every template here arrives with the right kind of
 * chart, the columns named, the axis labelled and the rows laid out — punch in
 * the numbers and it is done.
 *
 * Where a stat is a percentage, the two numbers behind it are the columns you
 * type and the percentage is worked out. Shots and goals go in; shooting
 * percentage comes out. Nothing is on the chart twice and nothing needs a
 * second axis to make sense.
 */

export interface ChartTemplate {
  key: string
  name: string
  /** The handful worth keeping if you only keep a handful. */
  top?: boolean
  group: 'Offense' | 'Defense' | 'Ride and clear' | 'Goalie' | 'Specialty' | 'The game'
  blurb: string
  type: ChartType
  /** What the rows are — names the across axis. */
  axis: string
  /** What the numbers are — names the value axis. */
  unit: string
  series: NoteChartSeries[]
  /** Row labels laid out ready. Empty strings are rows waiting for a name. */
  rows: string[]
}

const blanks = (n: number) => Array.from({ length: n }, () => '')
const games = (n: number) => Array.from({ length: n }, (_, i) => `Game ${i + 1}`)
const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4']

/** Shots in, goals in, percentage out. */
const rate = (name: string, top: number, bottom: number): NoteChartSeries => ({
  name,
  percent: { top, bottom },
})
/** One number over another as it stands — 1.08 possessions for every one of theirs. */
const ratio = (name: string, top: number, bottom: number): NoteChartSeries => ({
  name,
  ratio: { top, bottom },
})
const input = (name: string): NoteChartSeries => ({ name, input: true })

export const CHART_TEMPLATES: ChartTemplate[] = [
  // ── Offense ──────────────────────────────────────────────────────────────
  {
    key: 'shooting-pct',
    name: 'Shooting %',
    top: true,
    group: 'Offense',
    blurb: 'Shots and goals per player. The percentage works itself out.',
    type: 'bar',
    axis: 'Player',
    unit: 'Shooting %',
    series: [input('Shots'), input('Goals'), rate('Shooting %', 1, 0)],
    rows: blanks(8),
  },
  {
    key: 'offensive-efficiency',
    name: 'Offensive efficiency',
    group: 'Offense',
    blurb: 'Goals per possession. What we did with the ball when we had it.',
    type: 'column',
    axis: 'Game',
    unit: 'Goals per possession',
    series: [input('Goals'), input('Possessions'), rate('Efficiency', 0, 1)],
    rows: games(10),
  },
  {
    key: 'quality-shots',
    name: 'Quality shot ratio',
    group: 'Offense',
    blurb: 'Scorable shots per possession — how often we got a real look, not just a shot.',
    type: 'column',
    axis: 'Game',
    unit: 'Scorable shots per possession',
    series: [input('Scorable shots'), input('Possessions'), rate('Quality shots', 0, 1)],
    rows: games(10),
  },
  {
    key: 'points',
    name: 'Points by player',
    group: 'Offense',
    blurb: 'Goals and assists stacked — the whole bar is his points.',
    type: 'stacked',
    axis: 'Player',
    unit: 'Points',
    series: [{ name: 'Goals' }, { name: 'Assists' }],
    rows: blanks(8),
  },
  {
    key: 'shots-per-game',
    name: 'Shots per game',
    group: 'Offense',
    blurb: 'How many we took and how many were on cage, game by game.',
    type: 'line',
    axis: 'Game',
    unit: 'Shots',
    series: [{ name: 'Shots' }, { name: 'On goal' }],
    rows: games(10),
  },
  {
    key: 'shot-result',
    name: 'Where the shots went',
    group: 'Offense',
    blurb: 'One game, every shot: in, saved, missed or off the pipe.',
    type: 'pie',
    axis: 'Result',
    unit: 'Shots',
    series: [{ name: 'Shots' }],
    rows: ['Goal', 'Saved', 'Missed', 'Post'],
  },

  // ── Defense ──────────────────────────────────────────────────────────────
  {
    key: 'goals-for-against',
    name: 'Goals for and against',
    group: 'Defense',
    blurb: 'The two lines that decide the season.',
    type: 'line',
    axis: 'Game',
    unit: 'Goals',
    series: [{ name: 'For' }, { name: 'Against' }],
    rows: games(10),
  },
  {
    key: 'opp-shooting-pct',
    name: 'Opponent shooting %',
    group: 'Defense',
    blurb: 'What they did with their shots. The other half of shooting percentage.',
    type: 'column',
    axis: 'Game',
    unit: 'Opponent shooting %',
    series: [input('Their goals'), input('Their shots'), rate('Opponent shooting %', 0, 1)],
    rows: games(10),
  },
  {
    key: 'opp-off-target',
    name: 'Their shots off target %',
    group: 'Defense',
    blurb: 'How many of their shots missed the cage entirely — pressure, not luck.',
    type: 'column',
    axis: 'Game',
    unit: 'Off target %',
    series: [input('Missed the cage'), input('Their shots'), rate('Off target %', 0, 1)],
    rows: games(10),
  },
  {
    key: 'ground-balls-split',
    name: 'Ground balls, face-offs apart',
    group: 'Defense',
    blurb: 'A face-off man hoovering up his own wins is not the same as winning it in the open.',
    type: 'stacked',
    axis: 'Player',
    unit: 'Ground balls',
    series: [{ name: 'In the open' }, { name: 'Off face-offs' }],
    rows: blanks(8),
  },
  {
    key: 'ground-balls',
    name: 'Ground balls by player',
    group: 'Defense',
    blurb: 'The stat that tells you who is playing.',
    type: 'bar',
    axis: 'Player',
    unit: 'Ground balls',
    series: [{ name: 'Ground balls' }],
    rows: blanks(8),
  },
  {
    key: 'turnovers',
    name: 'Turnovers by quarter',
    group: 'Defense',
    blurb: 'Caused and given away, quarter by quarter.',
    type: 'column',
    axis: 'Quarter',
    unit: 'Turnovers',
    series: [{ name: 'Caused' }, { name: 'Given away' }],
    rows: QUARTERS,
  },
  // ── Ride and clear ───────────────────────────────────────────────────────
  {
    key: 'clear-pct',
    name: 'Clearing %',
    group: 'Ride and clear',
    blurb: 'Clears made out of clears tried, game by game.',
    type: 'column',
    axis: 'Game',
    unit: 'Clearing %',
    series: [input('Cleared'), input('Tried'), rate('Clearing %', 0, 1)],
    rows: games(10),
  },
  {
    key: 'ride-pct',
    name: 'Riding %',
    group: 'Ride and clear',
    blurb: 'How often the ride got the ball back — stops out of their clear attempts.',
    type: 'column',
    axis: 'Game',
    unit: 'Riding %',
    series: [input('Stops'), input('They tried'), rate('Riding %', 0, 1)],
    rows: games(10),
  },
  {
    key: 'clear-vs-ride',
    name: 'Clearing against riding',
    group: 'Ride and clear',
    blurb: 'Both ends of the same fight on one chart — our clears out, their clears stopped.',
    type: 'line',
    axis: 'Game',
    unit: '%',
    series: [
      input('Cleared'),
      input('We tried'),
      input('Stops'),
      input('They tried'),
      rate('Clearing %', 0, 1),
      rate('Riding %', 2, 3),
    ],
    rows: games(10),
  },
  {
    key: 'clears-by-start',
    name: 'Clears by how they started',
    group: 'Ride and clear',
    blurb: 'Which kind of clear is the one breaking down.',
    type: 'column',
    axis: 'Started with',
    unit: 'Clearing %',
    series: [input('Cleared'), input('Tried'), rate('Clearing %', 0, 1)],
    rows: ['After a save', 'After a goal', 'Dead ball', 'Off a turnover'],
  },
  {
    key: 'clear-breakdown',
    name: 'Where clears broke down',
    group: 'Ride and clear',
    blurb: 'Every failed clear, by what actually went wrong.',
    type: 'pie',
    axis: 'What happened',
    unit: 'Failed clears',
    series: [{ name: 'Failed clears' }],
    rows: ['Bad pass', 'Dropped', 'Over the midline', 'Stalled out', 'Ran out of room'],
  },
  {
    key: 'ride-turnovers',
    name: 'Where the ride caused it',
    group: 'Ride and clear',
    blurb: 'Every ball the ride won back, by where on the field it happened.',
    type: 'pie',
    axis: 'Where',
    unit: 'Balls won',
    series: [{ name: 'Balls won' }],
    rows: ['Behind their cage', 'Their box', 'At the midline', 'Our box'],
  },

  // ── Goalie ───────────────────────────────────────────────────────────────
  {
    key: 'save-pct',
    name: 'Save %',
    group: 'Goalie',
    blurb: 'Saves out of shots faced. Type the two, read the one.',
    type: 'column',
    axis: 'Game',
    unit: 'Save %',
    series: [input('Saves'), input('Shots faced'), rate('Save %', 0, 1)],
    rows: games(10),
  },
  {
    key: 'saves-by-spot',
    name: 'Where they scored on us',
    group: 'Goalie',
    blurb: 'Every goal against, by where it came from.',
    type: 'pie',
    axis: 'From',
    unit: 'Goals against',
    series: [{ name: 'Goals against' }],
    rows: ['Up top', 'Wing', 'From X', 'Crease', 'Man-up'],
  },

  // ── Specialty ────────────────────────────────────────────────────────────
  {
    key: 'faceoff-pct',
    name: 'Face-off %',
    group: 'Specialty',
    blurb: 'Won out of taken, game by game.',
    type: 'column',
    axis: 'Game',
    unit: 'Face-off %',
    series: [input('Won'), input('Taken'), rate('Face-off %', 0, 1)],
    rows: games(10),
  },
  {
    key: 'man-up-pct',
    name: 'Man-up %',
    group: 'Specialty',
    blurb: 'Goals out of chances with the extra man.',
    type: 'column',
    axis: 'Game',
    unit: 'Man-up %',
    series: [input('Goals'), input('Chances'), rate('Man-up %', 0, 1)],
    rows: games(10),
  },
  {
    key: 'man-down-pct',
    name: 'Man-down kill %',
    group: 'Specialty',
    blurb: 'Kills out of times down a man.',
    type: 'column',
    axis: 'Game',
    unit: 'Kill %',
    series: [input('Killed'), input('Times down'), rate('Kill %', 0, 1)],
    rows: games(10),
  },
  {
    key: 'penalties',
    name: 'Penalty minutes by player',
    group: 'Specialty',
    blurb: 'Who is costing us the man-down.',
    type: 'bar',
    axis: 'Player',
    unit: 'Minutes',
    series: [{ name: 'Minutes' }],
    rows: blanks(8),
  },

  // ── The game ─────────────────────────────────────────────────────────────
  {
    key: 'scoring-by-quarter',
    name: 'Scoring by quarter',
    group: 'The game',
    blurb: 'Us and them, quarter by quarter. Where the game turned.',
    type: 'column',
    axis: 'Quarter',
    unit: 'Goals',
    series: [{ name: 'Us' }, { name: 'Them' }],
    rows: QUARTERS,
  },
  {
    key: 'possession-ratio',
    name: 'Possession ratio',
    top: true,
    group: 'The game',
    blurb: 'Our possessions for every one of theirs. Above 1 and we had the ball more.',
    type: 'column',
    axis: 'Game',
    unit: 'Possessions for every one of theirs',
    series: [input('Ours'), input('Theirs'), ratio('Possession ratio', 0, 1)],
    rows: games(10),
  },
  {
    key: 'shots-us-them',
    name: 'Shots, us and them',
    group: 'The game',
    blurb: 'Two lines. If ours is under theirs the possession numbers will say why.',
    type: 'line',
    axis: 'Game',
    unit: 'Shots',
    series: [{ name: 'Ours' }, { name: 'Theirs' }],
    rows: games(10),
  },
  {
    key: 'possession',
    name: 'Where the ball was',
    group: 'The game',
    blurb: 'One game: our end, their end, in transition.',
    type: 'pie',
    axis: 'Third',
    unit: 'Minutes',
    series: [{ name: 'Minutes' }],
    rows: ['Our offense', 'Our defense', 'In transition'],
  },
]

export const TEMPLATE_GROUPS: ChartTemplate['group'][] = [
  'Offense',
  'Defense',
  'Ride and clear',
  'Goalie',
  'Specialty',
  'The game',
]

/** Lay a template into a chart block, keeping the block's own id. */
export function applyTemplate(block: NoteChart, t: ChartTemplate): Partial<NoteChart> {
  return {
    label: block.label.trim() || t.name,
    type: t.type,
    axis: t.axis,
    unit: t.unit,
    series: t.series.map((s) => ({ ...s })),
    rows: t.rows.map((label) => ({ label, values: t.series.map(() => 0) })),
  }
}

/** A blank chart block, ready for a template to be dropped into it. */
export function templateBlock(t: ChartTemplate): NoteChart {
  const empty: NoteChart = { id: newId('n'), kind: 'chart', label: '', rows: [] }
  return { ...empty, ...applyTemplate(empty, t) } as NoteChart
}
