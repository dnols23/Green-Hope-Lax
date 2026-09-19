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
  group: 'Offense' | 'Defense' | 'Goalie' | 'Specialty' | 'The game'
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
const input = (name: string): NoteChartSeries => ({ name, input: true })

export const CHART_TEMPLATES: ChartTemplate[] = [
  // ── Offense ──────────────────────────────────────────────────────────────
  {
    key: 'shooting-pct',
    name: 'Shooting %',
    group: 'Offense',
    blurb: 'Shots and goals per player. The percentage works itself out.',
    type: 'bar',
    axis: 'Player',
    unit: 'Shooting %',
    series: [input('Shots'), input('Goals'), rate('Shooting %', 1, 0)],
    rows: blanks(8),
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
  {
    key: 'clear-pct',
    name: 'Clearing %',
    group: 'Defense',
    blurb: 'Clears made out of clears tried, game by game.',
    type: 'column',
    axis: 'Game',
    unit: 'Clearing %',
    series: [input('Cleared'), input('Tried'), rate('Clearing %', 0, 1)],
    rows: games(10),
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
