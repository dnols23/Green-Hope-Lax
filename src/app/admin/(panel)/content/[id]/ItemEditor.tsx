'use client'

import { useRef, useState, useTransition } from 'react'
import { DeleteButton } from '@/components/admin/DeleteButton'
import {
  deleteContentItem,
  generateSfx,
  generateVoiceover,
  saveContentItem,
  toggleContentShot,
  type ContentItemInput,
} from '@/lib/contentActions'
import {
  CAPTION_LIMIT,
  CONTENT_FORMATS,
  CONTENT_STATUSES,
  FORMAT_LABELS,
  STATUS_LABELS,
  VO_MODE_LABELS,
  dayLabel,
  etYmd,
  fullCaption,
  shotsTotal,
  unfilledPlaceholders,
  type CaptionSnippet,
  type ContentItem,
  type ContentSeries,
  type Voice,
} from '@/lib/content'
import type { AudioLinks, ContentPlayer, GameOption, VideoRender } from '@/lib/contentData'
import { VideoPanel } from './VideoPanel'

const TEAM_LABELS: Record<string, string> = { boys_varsity: 'Varsity', boys_jv: 'JV', girls: 'Girls' }

/** Everything about one video, saved with one button; ticks and audio save on their own. */
export function ItemEditor({
  item,
  publishInput,
  series,
  snippets,
  players,
  games,
  drills,
  voices,
  voiceKeySet,
  voAudio,
  sfxAudio,
  video,
}: {
  item: ContentItem
  publishInput: string
  series: ContentSeries[]
  snippets: CaptionSnippet[]
  players: ContentPlayer[]
  games: GameOption[]
  drills: { id: string; name: string }[]
  voices: Voice[]
  voiceKeySet: boolean
  voAudio: AudioLinks | null
  sfxAudio: AudioLinks | null
  video: VideoRender
}) {
  const [f, setF] = useState<ContentItemInput>({
    id: item.id,
    title: item.title,
    series_id: item.series_id,
    status: item.status,
    format: item.format,
    shoot_date: item.shoot_date ?? '',
    publish_at: publishInput,
    game_id: item.game_id,
    drill_id: item.drill_id,
    featured_player_ids: item.featured_player_ids,
    drive_folder_url: item.drive_folder_url ?? '',
    canva_design_url: item.canva_design_url ?? '',
    final_video_url: item.final_video_url ?? '',
    instagram_url: item.instagram_url ?? '',
    audio_note: item.audio_note ?? '',
    caption: item.caption ?? '',
    hashtags: item.hashtags ?? '',
    vo_script: item.vo_script ?? '',
    vo_voice_id: item.vo_voice_id ?? voices[0]?.id ?? '',
    sfx_prompt: item.sfx_prompt ?? '',
    views: item.views == null ? '' : String(item.views),
    likes: item.likes == null ? '' : String(item.likes),
    shares: item.shares == null ? '' : String(item.shares),
    saves: item.saves == null ? '' : String(item.saves),
    notes: item.notes ?? '',
  })
  const set = <K extends keyof ContentItemInput>(k: K, v: ContentItemInput[K]) => setF((x) => ({ ...x, [k]: v }))
  const [say, setSay] = useState<{ ok: boolean; text: string } | null>(null)
  const [saving, start] = useTransition()

  const s = series.find((x) => x.id === f.series_id) ?? null

  function save() {
    setSay(null)
    start(async () => {
      const r = await saveContentItem(f)
      if (r.ok) {
        setF((x) => ({ ...x, caption: r.caption ?? '', vo_script: r.vo_script ?? '' }))
        setSay({ ok: true, text: 'Saved' })
      } else setSay({ ok: false, text: r.error })
    })
  }

  return (
    <div className="grid lg:grid-cols-3 gap-4 items-start pb-20">
      <div className="lg:col-span-2 space-y-4">
        <section className="card p-4 space-y-3">
          <input
            value={f.title}
            onChange={(e) => set('title', e.target.value)}
            maxLength={200}
            aria-label="Title"
            className="field text-lg font-black"
          />
          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <label className="field-label">Series</label>
              <select value={f.series_id ?? ''} onChange={(e) => set('series_id', e.target.value || null)} className="field">
                <option value="">No series</option>
                {series.map((x) => (
                  <option key={x.id} value={x.id}>{x.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label">Status</label>
              <select value={f.status} onChange={(e) => set('status', e.target.value)} className="field">
                {CONTENT_STATUSES.map((x) => (
                  <option key={x} value={x}>{STATUS_LABELS[x]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label">Format</label>
              <select value={f.format} onChange={(e) => set('format', e.target.value)} className="field">
                {CONTENT_FORMATS.map((x) => (
                  <option key={x} value={x}>{FORMAT_LABELS[x]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label">Shoot day</label>
              <input type="date" value={f.shoot_date} onChange={(e) => set('shoot_date', e.target.value)} className="field" />
            </div>
            <div>
              <label className="field-label">Post time (ET)</label>
              <input type="datetime-local" value={f.publish_at} onChange={(e) => set('publish_at', e.target.value)} className="field" />
            </div>
            <div>
              <label className="field-label">Posted</label>
              <p className="text-sm text-gray-500 pt-2">{item.posted_at ? dayLabel(etYmd(item.posted_at)) : '—'}</p>
            </div>
            <div className="sm:col-span-3 grid sm:grid-cols-2 gap-3">
              <div>
                <label className="field-label">Drill</label>
                <select value={f.drill_id ?? ''} onChange={(e) => set('drill_id', e.target.value || null)} className="field">
                  <option value="">None</option>
                  {drills.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="field-label">Game</label>
                <select value={f.game_id ?? ''} onChange={(e) => set('game_id', e.target.value || null)} className="field">
                  <option value="">None</option>
                  {games.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.game_date ? dayLabel(etYmd(g.game_date)) : '?'} · {g.home_away === 'away' ? '@' : 'vs'} {g.opponent}
                    </option>
                  ))}
                </select>
              </div>
              <p className="sm:col-span-2 text-xs text-gray-400 -mt-1">
                On save, [Drill name], [Opponent], [Time] and [Location] in the caption and script are filled in.
              </p>
            </div>
          </div>
        </section>

        <VideoPanel
          item={item}
          game={games.find((g) => g.id === f.game_id) ?? null}
          player={players.find((p) => f.featured_player_ids.includes(p.id)) ?? null}
          voAudio={voAudio}
          initialRender={video}
        />

        <section className="card p-4 space-y-3">
          <h2 className="font-bold text-gray-700">Links</h2>
          <LinkField label="Drive folder" value={f.drive_folder_url} onChange={(v) => set('drive_folder_url', v)} placeholder="IG/01_Inbox/…" />
          <LinkField label="Canva design" value={f.canva_design_url} onChange={(v) => set('canva_design_url', v)}>
            {s?.canva_template_url && (
              <a href={s.canva_template_url} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-[var(--gh-green)] whitespace-nowrap">
                Open series template ↗
              </a>
            )}
          </LinkField>
          <LinkField label="Final export" value={f.final_video_url} onChange={(v) => set('final_video_url', v)} placeholder="IG/03_Exports/…" />
          <LinkField label="Instagram post" value={f.instagram_url} onChange={(v) => set('instagram_url', v)} placeholder="https://www.instagram.com/reel/…" />
        </section>

        <CaptionBuilder
          caption={f.caption}
          hashtags={f.hashtags}
          snippets={snippets}
          onCaption={(v) => set('caption', v)}
          onHashtags={(v) => set('hashtags', v)}
        />

        <AudioPanel
          itemId={item.id}
          mode={s ? VO_MODE_LABELS[s.vo_mode] : null}
          script={f.vo_script}
          onScript={(v) => set('vo_script', v)}
          voiceId={f.vo_voice_id}
          onVoice={(v) => set('vo_voice_id', v)}
          voices={voices}
          keySet={voiceKeySet}
          voAudio={voAudio}
          sfxPrompt={f.sfx_prompt}
          onSfxPrompt={(v) => set('sfx_prompt', v)}
          sfxAudio={sfxAudio}
          audioNote={f.audio_note}
          onAudioNote={(v) => set('audio_note', v)}
        />

        <section className="card p-4 space-y-3">
          <h2 className="font-bold text-gray-700">How it did</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {(['views', 'likes', 'shares', 'saves'] as const).map((k) => (
              <div key={k}>
                <label className="field-label capitalize">{k}</label>
                <input type="number" min={0} inputMode="numeric" value={f[k]} onChange={(e) => set(k, e.target.value)} className="field" />
              </div>
            ))}
          </div>
          <div>
            <label className="field-label">Notes</label>
            <textarea rows={3} value={f.notes} onChange={(e) => set('notes', e.target.value)} className="field" />
          </div>
        </section>
      </div>

      <aside className="space-y-4">
        {s && (
          <section className="card p-4" style={{ borderTop: `4px solid ${s.color}` }}>
            <h2 className="font-bold" style={{ color: s.color }}>{s.name}</h2>
            <dl className="mt-2 space-y-2 text-sm">
              {s.purpose && <Recipe label="Purpose">{s.purpose}</Recipe>}
              {s.hook_formula && <Recipe label="Hook">{s.hook_formula}</Recipe>}
              <Recipe label="Target">
                {s.target_length_s ? `${s.target_length_s}s` : '—'}
                {s.cadence ? ` · ${s.cadence}` : ''} · {VO_MODE_LABELS[s.vo_mode]}
              </Recipe>
            </dl>
          </section>
        )}

        <Checklist itemId={item.id} shots={item.shot_checklist} />

        <section className="card p-4">
          <h2 className="font-bold text-gray-700 mb-2">Featured players</h2>
          <div className="max-h-80 overflow-y-auto space-y-0.5">
            {players
              .filter((p) => p.is_active || f.featured_player_ids.includes(p.id))
              .map((p) => {
                const on = f.featured_player_ids.includes(p.id)
                return (
                  <label key={p.id} className="flex items-center gap-2 text-sm min-h-8 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() =>
                        set('featured_player_ids', on ? f.featured_player_ids.filter((x) => x !== p.id) : [...f.featured_player_ids, p.id])
                      }
                      className="w-4 h-4 accent-[var(--gh-green)]"
                    />
                    <span className="flex-1 min-w-0 truncate">
                      {p.number ? <span className="text-gray-400">#{p.number} </span> : null}
                      {p.name}
                      <span className="text-xs text-gray-400"> · {TEAM_LABELS[p.team] ?? p.team}</span>
                    </span>
                  </label>
                )
              })}
          </div>
        </section>

        <div className="flex justify-end">
          <DeleteButton id={item.id} action={deleteContentItem} label="Delete video" />
        </div>
      </aside>

      <div className="fixed bottom-0 inset-x-0 z-30 border-t bg-white/95 backdrop-blur px-4 py-2.5" style={{ borderColor: 'var(--border)' }}>
        <div className="max-w-7xl mx-auto flex items-center gap-3">
          <button type="button" onClick={save} disabled={saving} className="btn btn-primary disabled:opacity-60">
            {saving ? 'Saving…' : 'Save video'}
          </button>
          {say && (
            <span className={`text-sm font-semibold ${say.ok ? 'text-[var(--gh-green)]' : 'text-red-700'}`} role="status">
              {say.text}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

function Recipe({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="section-label">{label}</dt>
      <dd className="text-gray-700">{children}</dd>
    </div>
  )
}

function LinkField({
  label,
  value,
  onChange,
  placeholder = 'https://',
  children,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  children?: React.ReactNode
}) {
  const live = /^https?:\/\//i.test(value.trim())
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <label className="field-label">{label}</label>
        {children}
      </div>
      <div className="flex items-center gap-2">
        <input type="url" inputMode="url" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="field" />
        {live && (
          <a href={value.trim()} target="_blank" rel="noopener noreferrer" className="btn btn-ghost !px-3 shrink-0" aria-label={`Open ${label}`}>
            ↗
          </a>
        )}
      </div>
    </div>
  )
}

function CaptionBuilder({
  caption,
  hashtags,
  snippets,
  onCaption,
  onHashtags,
}: {
  caption: string
  hashtags: string
  snippets: CaptionSnippet[]
  onCaption: (v: string) => void
  onHashtags: (v: string) => void
}) {
  const box = useRef<HTMLTextAreaElement>(null)
  const [copied, setCopied] = useState(false)
  const total = fullCaption(caption, hashtags).length
  const open = unfilledPlaceholders(caption)

  function insert(sn: CaptionSnippet) {
    if (sn.kind === 'hashtags') {
      const have = new Set(hashtags.split(/\s+/).filter(Boolean))
      const add = sn.body.split(/\s+/).filter((t) => t && !have.has(t))
      onHashtags([hashtags.trim(), add.join(' ')].filter(Boolean).join(' '))
      return
    }
    if (sn.kind === 'hook') {
      onCaption([sn.body, caption.trim()].filter(Boolean).join('\n\n'))
      return
    }
    // At the cursor if the box has one, else on the end.
    const el = box.current
    if (el && document.activeElement === el) {
      const at = el.selectionStart ?? caption.length
      onCaption(caption.slice(0, at) + sn.body + caption.slice(el.selectionEnd ?? at))
      return
    }
    onCaption([caption.trimEnd(), sn.body].filter(Boolean).join('\n\n'))
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(fullCaption(caption, hashtags))
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }

  return (
    <section className="card p-4 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="font-bold text-gray-700">Caption</h2>
        <button type="button" onClick={copy} className="btn btn-primary !py-1.5 text-sm">
          {copied ? 'Copied ✓' : 'Copy caption + hashtags'}
        </button>
      </div>
      {snippets.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {snippets.map((sn) => (
            <button
              key={sn.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => insert(sn)}
              title={sn.body}
              className="text-xs font-semibold px-2.5 min-h-8 rounded-full border bg-white hover:bg-gray-50"
              style={{ borderColor: 'var(--border)' }}
            >
              <span className="text-gray-400">{sn.kind === 'hashtags' ? '#' : sn.kind}</span> {sn.label}
            </button>
          ))}
        </div>
      )}
      <textarea ref={box} rows={7} value={caption} onChange={(e) => onCaption(e.target.value)} className="field" aria-label="Caption" />
      <div>
        <label className="field-label">Hashtags</label>
        <textarea rows={2} value={hashtags} onChange={(e) => onHashtags(e.target.value)} className="field" />
      </div>
      <div className="flex items-center gap-3 flex-wrap text-xs">
        <span className={`font-bold ${total > CAPTION_LIMIT ? 'text-red-700' : 'text-gray-500'}`}>
          {total.toLocaleString()} / {CAPTION_LIMIT.toLocaleString()}
        </span>
        {open.length > 0 && (
          <span className="font-semibold text-amber-700">⚠ Still to fill in: {open.join(' ')}</span>
        )}
      </div>
    </section>
  )
}

function Checklist({ itemId, shots }: { itemId: string; shots: ContentItem['shot_checklist'] }) {
  const [list, setList] = useState(shots)
  const [error, setError] = useState<string | null>(null)
  const done = list.filter((s) => s.done).length
  return (
    <section className="card p-4">
      <h2 className="font-bold text-gray-700 mb-2 flex items-center justify-between">
        Shot list
        <span className="text-xs font-semibold text-gray-400">
          {done}/{list.length} · {shotsTotal(list)}s
        </span>
      </h2>
      {list.length === 0 ? (
        <p className="text-sm text-gray-400">No shots — pick a series with a shot list when you add the video.</p>
      ) : (
        <ul className="space-y-1">
          {list.map((s, n) => (
            <li key={n}>
              <label className="flex items-start gap-2 text-sm cursor-pointer min-h-8">
                <input
                  type="checkbox"
                  checked={s.done}
                  onChange={async (e) => {
                    const done = e.target.checked
                    setError(null)
                    setList((l) => l.map((x, i) => (i === n ? { ...x, done } : x)))
                    const r = await toggleContentShot(itemId, n, done)
                    if (!r.ok) {
                      setList((l) => l.map((x, i) => (i === n ? { ...x, done: !done } : x)))
                      setError(r.error)
                    }
                  }}
                  className="w-4 h-4 mt-0.5 accent-[var(--gh-green)] shrink-0"
                />
                <span className={s.done ? 'line-through text-gray-400' : ''}>
                  {s.shot}
                  {s.secs ? <span className="text-xs text-gray-400"> · {s.secs}s</span> : null}
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="text-xs font-semibold text-red-700 mt-1">{error}</p>}
    </section>
  )
}

function AudioPanel({
  itemId,
  mode,
  script,
  onScript,
  voiceId,
  onVoice,
  voices,
  keySet,
  voAudio,
  sfxPrompt,
  onSfxPrompt,
  sfxAudio,
  audioNote,
  onAudioNote,
}: {
  itemId: string
  mode: string | null
  script: string
  onScript: (v: string) => void
  voiceId: string
  onVoice: (v: string) => void
  voices: Voice[]
  keySet: boolean
  voAudio: AudioLinks | null
  sfxPrompt: string
  onSfxPrompt: (v: string) => void
  sfxAudio: AudioLinks | null
  audioNote: string
  onAudioNote: (v: string) => void
}) {
  const [vo, setVo] = useState(voAudio)
  const [sfx, setSfx] = useState(sfxAudio)
  const [seconds, setSeconds] = useState('3')
  const [busy, setBusy] = useState<'vo' | 'sfx' | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function makeVo() {
    setBusy('vo')
    setError(null)
    const r = await generateVoiceover({ itemId, text: script, voiceId })
    if (r.ok) setVo(r.links)
    else setError(r.error)
    setBusy(null)
  }
  async function makeSfx() {
    setBusy('sfx')
    setError(null)
    const r = await generateSfx({ itemId, prompt: sfxPrompt, seconds: Number(seconds) })
    if (r.ok) setSfx(r.links)
    else setError(r.error)
    setBusy(null)
  }

  return (
    <section className="card p-4 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="font-bold text-gray-700">Audio</h2>
        {mode && <span className="text-xs text-gray-400">Series: {mode}</span>}
      </div>
      {!keySet && (
        <p className="text-xs rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
          ElevenLabs isn’t connected: set ELEVENLABS_API_KEY in Vercel, then redeploy.
        </p>
      )}
      <div>
        <label className="field-label">Voiceover script</label>
        <textarea rows={4} value={script} onChange={(e) => onScript(e.target.value)} className="field" />
      </div>
      <div className="flex items-end gap-2 flex-wrap">
        <div className="min-w-48 flex-1">
          <label className="field-label">Voice</label>
          <select value={voiceId} onChange={(e) => onVoice(e.target.value)} className="field">
            {voices.length === 0 && <option value="">Add voices on Series & Voices</option>}
            {voices.map((v) => (
              <option key={v.id} value={v.id}>{v.label}</option>
            ))}
          </select>
        </div>
        <button type="button" onClick={makeVo} disabled={!!busy || !script.trim() || !voiceId} className="btn btn-primary disabled:opacity-50">
          {busy === 'vo' ? 'Generating…' : vo ? 'Regenerate voiceover' : 'Generate voiceover'}
        </button>
      </div>
      {vo && <Player links={vo} label="Voiceover" />}
      <p className="text-xs text-gray-500">Voice clones: coach/adult voices only. Never clone a player’s voice.</p>

      <div className="border-t border-gray-100 pt-3 space-y-2">
        <label className="field-label">Sound effect</label>
        <div className="flex items-end gap-2 flex-wrap">
          <input
            value={sfxPrompt}
            onChange={(e) => onSfxPrompt(e.target.value)}
            placeholder="Crowd roar into a stick check, stadium echo"
            className="field flex-1 min-w-48"
          />
          <label className="flex items-center gap-1 text-xs text-gray-500">
            <input
              type="number"
              min={0.5}
              max={22}
              step={0.5}
              value={seconds}
              onChange={(e) => setSeconds(e.target.value)}
              className="field !py-1.5 !px-2 w-20"
              aria-label="Seconds"
            />
            sec
          </label>
          <button type="button" onClick={makeSfx} disabled={!!busy || !sfxPrompt.trim()} className="btn btn-ghost disabled:opacity-50">
            {busy === 'sfx' ? 'Generating…' : sfx ? 'Regenerate' : 'Generate'}
          </button>
        </div>
        {sfx && <Player links={sfx} label="Sound effect" />}
      </div>

      {error && (
        <p className="text-sm font-semibold text-red-700" role="alert">
          {error}
        </p>
      )}

      <div>
        <label className="field-label">Music / audio note</label>
        <input value={audioNote} onChange={(e) => onAudioNote(e.target.value)} placeholder="Trending sound, or the song to use in Canva" className="field" />
      </div>
    </section>
  )
}

function Player({ links, label }: { links: AudioLinks; label: string }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <audio key={links.play} controls preload="none" src={links.play} className="h-9 max-w-full" aria-label={label} />
      <a href={links.download} className="text-sm font-bold text-[var(--gh-green)]">
        Download mp3
      </a>
    </div>
  )
}
