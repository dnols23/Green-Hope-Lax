/**
 * Charts for a note: which kinds there are, which ones the data in front of you
 * can actually make, and the numbers a drawing of it needs.
 *
 * All pure. The drawing lives in the component; everything here — what fits,
 * what the axis runs from and to, where the ticks go, which colour a series
 * wears — is worked out where it can be checked.
 */

export type ChartType = 'column' | 'bar' | 'line' | 'stacked' | 'pie' | 'scatter'

export interface ChartKind {
  key: ChartType
  label: string
  /** What it is for, in a sentence a coach would say. */
  blurb: string
  /** How many columns of numbers it needs. */
  minSeries: number
  maxSeries: number
}

export const CHART_KINDS: ChartKind[] = [
  {
    key: 'column',
    label: 'Columns',
    blurb: 'Compare a number across a few things. The safe choice.',
    minSeries: 1,
    maxSeries: 8,
  },
  {
    key: 'bar',
    label: 'Bars',
    blurb: 'The same, lying down — better when the names are long.',
    minSeries: 1,
    maxSeries: 8,
  },
  {
    key: 'line',
    label: 'Line',
    blurb: 'How something moved, game by game. Needs the rows in order.',
    minSeries: 1,
    maxSeries: 8,
  },
  {
    key: 'stacked',
    label: 'Stacked',
    blurb: 'Parts of a whole — where the total went, category by category.',
    minSeries: 2,
    maxSeries: 8,
  },
  {
    key: 'pie',
    label: 'Pie',
    blurb: 'One set of numbers as shares of a whole. Six slices at most.',
    minSeries: 1,
    maxSeries: 1,
  },
  {
    key: 'scatter',
    label: 'Scatter',
    blurb: 'Two numbers for each player — does one track the other?',
    minSeries: 2,
    maxSeries: 2,
  },
]

/** Never more than the palette has hues for: a ninth is indistinguishable. */
export const MAX_SERIES = 8

export function chartKind(type: ChartType | undefined): ChartKind {
  return CHART_KINDS.find((k) => k.key === type) ?? CHART_KINDS[0]
}

/** Can this many columns of numbers make this kind of chart? */
export function fits(type: ChartType, series: number): boolean {
  const k = chartKind(type)
  return series >= k.minSeries && series <= k.maxSeries
}

/** Why not, in plain words, for the picker to show. */
export function whyNot(type: ChartType, series: number): string | null {
  const k = chartKind(type)
  if (series < k.minSeries) {
    return k.minSeries === 2 && k.maxSeries === 2
      ? 'Needs two columns of numbers — one for each axis'
      : `Needs at least ${k.minSeries} columns of numbers`
  }
  if (series > k.maxSeries) {
    return k.maxSeries === 1
      ? 'Only works with one column of numbers'
      : `Only works up to ${k.maxSeries} columns`
  }
  return null
}

/** The kinds this data can make right now. */
export function kindsFor(series: number): ChartType[] {
  return CHART_KINDS.filter((k) => fits(k.key, series)).map((k) => k.key)
}

// ── Colour ──────────────────────────────────────────────────────────────────

/**
 * One series is the program's own green: there is no second colour to tell it
 * apart from, so identity is not the job and the title already says what is
 * plotted.
 */
export const SERIES_ONE = '#00693E'

/**
 * More than one, and the colours are carrying identity. This order is the one
 * that passes the colourblind checks pair by pair — it is a fixed order, not a
 * palette to shuffle, and it stops at eight because a ninth hue is
 * indistinguishable from one already on the screen.
 */
export const SERIES_COLORS = [
  '#2a78d6', // blue
  '#eb6834', // orange
  '#1baf7a', // aqua
  '#eda100', // yellow
  '#e87ba4', // magenta
  '#008300', // green
  '#4a3aa7', // violet
  '#e34948', // red
]

export function seriesColor(index: number, total: number): string {
  if (total <= 1) return SERIES_ONE
  return SERIES_COLORS[Math.min(Math.max(index, 0), SERIES_COLORS.length - 1)]
}

// ── Scales ──────────────────────────────────────────────────────────────────

export interface ChartPoint {
  label: string
  values: number[]
}

const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0)

/**
 * What the value axis has to cover.
 *
 * Bars grow from a baseline, so the baseline is zero unless the data goes
 * negative — starting a bar axis anywhere else overstates the difference
 * between the bars, which is the oldest way to lie with a chart.
 */
export function valueRange(rows: ChartPoint[], type: ChartType, series: number): [number, number] {
  const all: number[] = []
  if (type === 'stacked') {
    for (const r of rows) {
      let up = 0
      let down = 0
      for (let i = 0; i < series; i++) {
        const v = num(r.values[i])
        if (v >= 0) up += v
        else down += v
      }
      all.push(up, down)
    }
  } else if (type === 'scatter') {
    for (const r of rows) all.push(num(r.values[1]))
  } else {
    for (const r of rows) for (let i = 0; i < series; i++) all.push(num(r.values[i]))
  }

  const lo = Math.min(0, ...all)
  const hi = Math.max(0, ...all)
  if (lo === 0 && hi === 0) return [0, 1]
  return [lo, hi]
}

/** The across-axis range for a scatter — the first column of numbers. */
export function scatterRange(rows: ChartPoint[]): [number, number] {
  const xs = rows.map((r) => num(r.values[0]))
  if (!xs.length) return [0, 1]
  const lo = Math.min(...xs)
  const hi = Math.max(...xs)
  if (lo === hi) return [lo - 1, hi + 1]
  // A little air either side, so no point sits on the frame.
  const pad = (hi - lo) * 0.08
  return [lo - pad, hi + pad]
}

/**
 * Round numbers to hang the gridlines on — 0, 5, 10 rather than 0, 4.7, 9.4.
 * Always includes the ends of the range it returns.
 */
export function niceTicks(lo: number, hi: number, want = 4): number[] {
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi === lo) return [lo, lo + 1]
  const raw = (hi - lo) / Math.max(1, want)
  const mag = Math.pow(10, Math.floor(Math.log10(raw)))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag

  const start = Math.floor(lo / step) * step
  const end = Math.ceil(hi / step) * step
  const out: number[] = []
  // Rounded as we go: 0.1 + 0.2 arithmetic leaves ticks like 0.30000000000000004.
  for (let t = start; t <= end + step / 1000; t += step) {
    out.push(Math.round(t * 1e6) / 1e6)
  }
  return out
}

/** "1,284" · "12.5" · "0" — enough precision to be honest, not enough to be noise. */
export function tickLabel(v: number): string {
  if (!Number.isFinite(v)) return ''
  if (Math.abs(v) >= 1000) return v.toLocaleString('en-US')
  const rounded = Math.round(v * 100) / 100
  return String(rounded)
}

/** Slices of a pie, biggest first, as fractions of the whole. */
export function slices(rows: ChartPoint[]): { label: string; value: number; share: number }[] {
  const kept = rows.map((r) => ({ label: r.label, value: Math.max(0, num(r.values[0])) }))
  const total = kept.reduce((n, r) => n + r.value, 0)
  if (total <= 0) return []
  return kept
    .filter((r) => r.value > 0)
    .map((r) => ({ ...r, share: r.value / total }))
}
