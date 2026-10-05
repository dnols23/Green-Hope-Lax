// Video templates for the Content Studio: what each one asks for, and how a
// template page plus its answers becomes one HyperFrames composition.
//
// No imports, so the render job on GitHub Actions can load this file with
// plain Node (scripts/render-video.mjs). The pages live in public/video/.

export type VideoFieldKind = 'text' | 'lines' | 'select' | 'photo'

export interface VideoField {
  key: string
  label: string
  kind: VideoFieldKind
  /** Characters per line (text, lines). */
  max?: number
  /** Most lines kept (lines). */
  rows?: number
  placeholder?: string
  initial?: string
  options?: { value: string; label: string }[]
  required?: boolean
  hint?: string
}

export interface VideoTemplate {
  key: string
  name: string
  blurb: string
  seconds: number
  fields: VideoField[]
  tracks: TrackKey[]
}

export type TrackKey = 'riff' | 'opening' | 'chorus' | 'voiceover' | 'none'

export interface VideoTrack {
  key: TrackKey
  label: string
  /** Under public/video/. */
  file?: string
}

export const VIDEO_TRACKS: VideoTrack[] = [
  { key: 'riff', label: 'Our anthem: guitar riff (no words)', file: 'assets/audio/anthem-riff.mp3' },
  { key: 'opening', label: 'Our anthem: riff into the first verse', file: 'assets/audio/anthem-opening.mp3' },
  { key: 'chorus', label: 'Our anthem: “Back in Black” chorus', file: 'assets/audio/anthem-chorus.mp3' },
  { key: 'voiceover', label: 'This video’s voiceover' },
  { key: 'none', label: 'No sound' },
]

export const ALL_TRACKS: TrackKey[] = ['riff', 'opening', 'chorus', 'voiceover', 'none']

const LEVEL: VideoField = {
  key: 'level',
  label: 'Team',
  kind: 'select',
  initial: 'Varsity',
  options: [
    { value: 'Varsity', label: 'Varsity' },
    { value: 'JV', label: 'JV' },
  ],
}
const HANDLE: VideoField = { key: 'handle', label: 'Handle', kind: 'text', max: 24, initial: '@ghlacrosse' }
const PHOTO: VideoField = {
  key: 'photo',
  label: 'Photo',
  kind: 'photo',
  hint: 'Optional. A tall action shot works best.',
}

export const VIDEO_TEMPLATES: VideoTemplate[] = [
  {
    key: 'game-day',
    name: 'Game Day',
    blurb: 'Opponent, time and place, slammed in over the riff.',
    seconds: 10,
    tracks: ALL_TRACKS,
    fields: [
      LEVEL,
      {
        key: 'vs',
        label: 'Home or away',
        kind: 'select',
        initial: 'vs',
        options: [
          { value: 'vs', label: 'Home (vs)' },
          { value: 'at', label: 'Away (at)' },
        ],
      },
      { key: 'opponent', label: 'Opponent', kind: 'text', max: 28, required: true, placeholder: 'Panther Creek' },
      { key: 'when', label: 'When', kind: 'text', max: 36, placeholder: 'Fri · Mar 13 · 7:00 PM' },
      { key: 'where', label: 'Where', kind: 'text', max: 36, placeholder: 'Green Hope Stadium' },
      PHOTO,
      HANDLE,
    ],
  },
  {
    key: 'final-score',
    name: 'Final Score',
    blurb: 'The score counts up, the winner lights up, then the standouts.',
    seconds: 10,
    tracks: ALL_TRACKS,
    fields: [
      LEVEL,
      { key: 'opponent', label: 'Opponent', kind: 'text', max: 28, required: true, placeholder: 'Panther Creek' },
      { key: 'us', label: 'Green Hope score', kind: 'text', max: 3, required: true, placeholder: '12' },
      { key: 'them', label: 'Their score', kind: 'text', max: 3, required: true, placeholder: '8' },
      {
        key: 'standouts',
        label: 'Standouts',
        kind: 'lines',
        max: 34,
        rows: 3,
        placeholder: 'J. Smith · 4G 1A\nT. Lee · 12 saves',
        hint: 'One per line, up to 3.',
      },
      PHOTO,
      HANDLE,
    ],
  },
  {
    key: 'spotlight',
    name: 'Player Spotlight',
    blurb: 'Photo, name, number and three lines about the player.',
    seconds: 10,
    tracks: ALL_TRACKS,
    fields: [
      { key: 'name', label: 'Player name', kind: 'text', max: 30, required: true, placeholder: 'Jake Smith' },
      { key: 'number', label: 'Number', kind: 'text', max: 3, placeholder: '23' },
      { key: 'position', label: 'Position', kind: 'text', max: 16, placeholder: 'Attack' },
      { key: 'year', label: 'Class', kind: 'text', max: 18, placeholder: 'Class of 2027' },
      {
        key: 'stats',
        label: 'About them',
        kind: 'lines',
        max: 34,
        rows: 3,
        placeholder: '42 goals last spring\nAll-Conference\nTeam captain',
        hint: 'One per line, up to 3.',
      },
      { ...PHOTO, hint: 'A clear shot of the player.' },
      HANDLE,
    ],
  },
  {
    key: 'commit',
    name: 'Commitment',
    blurb: 'COMMITTED stamps in, then the player and the college.',
    seconds: 10,
    tracks: ALL_TRACKS,
    fields: [
      { key: 'name', label: 'Player name', kind: 'text', max: 30, required: true, placeholder: 'Jake Smith' },
      { key: 'detail', label: 'Number · position · class', kind: 'text', max: 36, placeholder: '#23 · Attack · Class of 2027' },
      { key: 'college', label: 'College', kind: 'text', max: 32, required: true, placeholder: 'High Point University' },
      { ...PHOTO, hint: 'The player, ideally in the college gear.' },
      HANDLE,
    ],
  },
  {
    key: 'teaser',
    name: 'Back in Black teaser',
    blurb: 'The falcon turns gunmetal on the chorus. Timed to the song.',
    seconds: 16.6,
    tracks: ['chorus', 'none'],
    fields: [
      { key: 'kicker', label: 'Opening line', kind: 'text', max: 20, initial: 'Spring 2027' },
      { key: 'line1', label: 'Big line, top', kind: 'text', max: 12, initial: 'Back in' },
      { key: 'line2', label: 'Big line, bottom', kind: 'text', max: 8, initial: 'Black' },
      { key: 'tag', label: 'Tag line', kind: 'text', max: 32, initial: 'Green Hope Men’s Lacrosse' },
      HANDLE,
    ],
  },
]

export function videoTemplate(key: string | null | undefined): VideoTemplate | null {
  return VIDEO_TEMPLATES.find((t) => t.key === key) ?? null
}

export function videoTrack(key: string | null | undefined): VideoTrack | null {
  return VIDEO_TRACKS.find((t) => t.key === key) ?? null
}

/** The answers a template keeps: trimmed, clipped, select values checked. Photos
 *  keep whatever reference was stored (a storage path or a public URL). */
export function cleanVideoFields(t: VideoTemplate, raw: unknown): Record<string, string> {
  const src = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const out: Record<string, string> = {}
  for (const f of t.fields) {
    const v = typeof src[f.key] === 'string' ? (src[f.key] as string) : f.initial ?? ''
    if (f.kind === 'select') {
      out[f.key] = f.options?.some((o) => o.value === v) ? v : f.initial ?? f.options?.[0]?.value ?? ''
    } else if (f.kind === 'lines') {
      out[f.key] = v
        .replace(/\r\n?/g, '\n')
        .split('\n')
        .map((l) => l.trim().slice(0, f.max ?? 60))
        .filter(Boolean)
        .slice(0, f.rows ?? 3)
        .join('\n')
    } else if (f.kind === 'photo') {
      out[f.key] = v.trim().slice(0, 2000)
    } else {
      out[f.key] = v.replace(/\s+/g, ' ').trim().slice(0, f.max ?? 60)
    }
  }
  return out
}

/** Required answers still empty, by label. */
export function missingVideoFields(t: VideoTemplate, fields: Record<string, string>): string[] {
  return t.fields.filter((f) => f.required && !fields[f.key]?.trim()).map((f) => f.label)
}

export function defaultVideoTrack(t: VideoTemplate): TrackKey {
  return t.tracks[0]
}

export interface ComposeOptions {
  /** Text answers, as the page's script reads them. */
  fields: Record<string, string>
  /** Photo field key → a URL the page can load (or '' for none). */
  photos: Record<string, string>
  /** The sound bed, or null for silence. */
  audio: { src: string } | null
  seconds: number
  /** <base href> for the preview; the render job works beside the assets instead. */
  base?: string
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Fill a template page: answers as JSON for its script, photos and the audio
 *  clip written straight into the markup (the renderer reads those from the HTML). */
export function composeVideo(html: string, o: ComposeOptions): string {
  const json = JSON.stringify({ ...o.fields, ...o.photos }).replace(/</g, '\\u003c')
  const audio = o.audio
    ? `<audio id="track" class="clip" src="${esc(o.audio.src)}" data-start="0" data-duration="${o.seconds}" data-track-index="9" data-volume="0.95" data-fade-out="0.8"></audio>`
    : ''
  return html
    .replace('<!--HF:BASE-->', o.base ? `<base href="${esc(o.base)}" />` : '')
    .replace('<!--HF:FIELDS-->', `<script>window.__FIELDS = ${json};</script>`)
    .replace('<!--HF:AUDIO-->', audio)
    .replace(/\{\{photo:([a-z]+)\}\}/g, (_, k: string) => esc(o.photos[k] ?? ''))
}

/** What the Content Studio sends the render job (a workflow_dispatch input). */
export interface RenderJob {
  template: string
  fields: Record<string, string>
  /** Photo field key → a signed or public https URL. */
  photos: Record<string, string>
  /** A track file under public/video/, or an https URL (the voiceover), or null. */
  audio: { file: string } | { url: string } | null
  upload: { video: string; error: string; apikey: string }
}
