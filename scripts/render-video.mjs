#!/usr/bin/env node
// Renders one Content Studio video with HyperFrames and uploads the MP4.
//
// Run by .github/workflows/render-video.yml with the job as its workflow input (see RenderJob in
// src/lib/videoTemplates.ts). Uploads go to one-time signed Supabase URLs, so the
// workflow holds no secrets. On failure the error text goes to the error URL.
//
// Local try-out (no upload):
//   node scripts/render-video.mjs job.json --out game-day.mp4

import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { VIDEO_TRACKS, cleanVideoFields, composeVideo, videoTemplate } from '../src/lib/videoTemplates.ts'

const HYPERFRAMES = 'hyperframes@0.8.133'
const ROOT = resolve(import.meta.dirname, '..')
const PUBLIC = join(ROOT, 'public', 'video')

const args = process.argv.slice(2)
const outIdx = args.indexOf('--out')
const outPath = outIdx >= 0 ? resolve(args[outIdx + 1]) : null
const jobFile = args.find((a, i) => !a.startsWith('--') && i !== outIdx + 1)
const job = JSON.parse(
  jobFile
    ? readFileSync(jobFile, 'utf8')
    : process.env.GITHUB_EVENT_PATH
      ? JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8')).inputs?.job ?? 'null'
      : 'null',
)

async function download(url, to) {
  if (!/^https:\/\//.test(url) && !(outPath && /^http:\/\/127\.0\.0\.1[:/]/.test(url))) throw new Error(`Not an https URL: ${url.slice(0, 60)}`)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Couldn't download ${to.split('/').pop()} (${res.status})`)
  writeFileSync(to, Buffer.from(await res.arrayBuffer()))
}

async function put(url, body, type) {
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'content-type': type, 'x-upsert': 'true', apikey: job.upload.apikey },
    body,
  })
  if (!res.ok) throw new Error(`Upload failed (${res.status}): ${(await res.text()).slice(0, 300)}`)
}

async function render() {
  const t = videoTemplate(job?.template)
  if (!t) throw new Error(`Unknown template: ${job?.template}`)

  const work = mkdtempSync(join(tmpdir(), 'ghvideo-'))
  cpSync(join(PUBLIC, 'assets'), join(work, 'assets'), { recursive: true })
  const up = join(work, 'assets', 'upload')
  mkdirSync(up)

  const fields = cleanVideoFields(t, job.fields)
  const photos = {}
  for (const f of t.fields.filter((f) => f.kind === 'photo')) {
    delete fields[f.key]
    const url = job.photos?.[f.key]
    if (!url) {
      photos[f.key] = ''
      continue
    }
    await download(url, join(up, `${f.key}.img`))
    photos[f.key] = `assets/upload/${f.key}.img`
  }

  let audio = null
  if (job.audio && 'file' in job.audio) {
    if (!VIDEO_TRACKS.some((tr) => tr.file === job.audio.file)) throw new Error(`Unknown track: ${job.audio.file}`)
    audio = { src: job.audio.file }
  } else if (job.audio && 'url' in job.audio) {
    await download(job.audio.url, join(up, 'voiceover.mp3'))
    audio = { src: 'assets/upload/voiceover.mp3' }
  }

  const html = readFileSync(join(PUBLIC, `${t.key}.html`), 'utf8')
  writeFileSync(join(work, 'index.html'), composeVideo(html, { fields, photos, audio, seconds: t.seconds }))
  writeFileSync(
    join(work, 'hyperframes.json'),
    JSON.stringify({ paths: { blocks: 'compositions', components: 'compositions/components', assets: 'assets' }, media: { autoProxy: true } }),
  )
  writeFileSync(join(work, 'meta.json'), JSON.stringify({ id: t.key, name: t.key }))

  const out = join(work, 'renders', 'video.mp4')
  const run = spawnSync('npx', ['--yes', HYPERFRAMES, 'render', work, '-o', out, '--quality', 'delivery'], {
    cwd: work,
    stdio: 'inherit',
    env: { ...process.env, HYPERFRAMES_SKIP_SKILLS: '1', HYPERFRAMES_NO_TELEMETRY: '1', DO_NOT_TRACK: '1' },
  })
  if (run.status !== 0 || !existsSync(out)) {
    const made = existsSync(join(work, 'renders')) ? readdirSync(join(work, 'renders')).join(', ') : 'nothing'
    throw new Error(`HyperFrames render failed (exit ${run.status}; renders: ${made})`)
  }
  return out
}

try {
  const out = await render()
  if (outPath) cpSync(out, outPath)
  if (job.upload?.video) await put(job.upload.video, readFileSync(out), 'video/mp4')
  console.log(`Rendered ${job.template}${outPath ? ` → ${outPath}` : ''}${job.upload?.video ? ' and uploaded' : ''}`)
} catch (e) {
  const message = e instanceof Error ? e.message : String(e)
  console.error(message)
  if (job?.upload?.error) {
    await put(job.upload.error, message, 'text/plain').catch((err) => console.error(`Couldn't report the error: ${err.message}`))
  }
  process.exit(1)
}
