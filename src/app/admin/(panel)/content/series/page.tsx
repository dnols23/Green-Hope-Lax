import { requireSection } from '@/lib/permissions'
import { listItems, listSeries, readVoiceSettings } from '@/lib/contentData'
import { createContentItem, saveContentSeries, saveVoiceSettings } from '@/lib/contentActions'
import { VO_MODES, VO_MODE_LABELS, shotsToText, shotsTotal, voicesToText, type ContentSeries } from '@/lib/content'
import { ContentTabs } from '../ContentTabs'

export const metadata = { title: 'Instagram · Series & Voices' }
export const dynamic = 'force-dynamic'

export default async function SeriesPage() {
  await requireSection('social')
  const [series, items, voice] = await Promise.all([listSeries(), listItems(), readVoiceSettings()])
  const countFor = (id: string) => items.filter((i) => i.series_id === id).length

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <ContentTabs active="series" />
        <h1 className="text-xl font-black mb-1">Series & Voices</h1>
        <p className="text-gray-500 text-sm">Each series is a recipe: hook, shots, caption, voice. A new video copies it.</p>
      </div>

      <section className="space-y-2">
        {series.map((s) => (
          <details key={s.id} className="card p-4" style={{ borderLeft: `4px solid ${s.color}` }}>
            <summary className="cursor-pointer list-none flex items-center gap-3 flex-wrap">
              <span className="caret text-sm text-gray-400">▸</span>
              <span className="font-bold">{s.name}</span>
              {!s.is_active && <span className="badge badge-sched">Off</span>}
              <span className="text-xs text-gray-400">
                {[s.cadence, s.target_length_s ? `${s.target_length_s}s` : null, VO_MODE_LABELS[s.vo_mode], `${countFor(s.id)} videos`]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
              <form action={createContentItem} className="ml-auto">
                <input type="hidden" name="series_id" value={s.id} />
                <button type="submit" className="btn btn-primary !py-1 text-xs">+ New video</button>
              </form>
            </summary>
            <div className="mt-4 pt-4 border-t border-gray-100">
              <SeriesForm s={s} />
            </div>
          </details>
        ))}
        <details className="card p-4">
          <summary className="cursor-pointer list-none font-bold text-[var(--gh-green)]">+ Add a series</summary>
          <div className="mt-4 pt-4 border-t border-gray-100">
            <SeriesForm />
          </div>
        </details>
      </section>

      <section className="card p-5 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="font-bold text-gray-700">ElevenLabs voices</h2>
          <span
            className={`text-xs font-bold px-2 py-1 rounded-full ${voice.keySet ? 'bg-[#DFEFE7] text-[#00512F]' : 'bg-amber-100 text-amber-900'}`}
          >
            {voice.keySet ? 'ELEVENLABS_API_KEY is set' : 'ELEVENLABS_API_KEY is not set'}
          </span>
        </div>
        <form action={saveVoiceSettings} className="space-y-3">
          <div>
            <label className="field-label">Voices — one per line: Label | voice_id</label>
            <textarea
              name="voices"
              rows={4}
              defaultValue={voicesToText(voice.voices)}
              placeholder={'Coach Nolan (clone) | 21m00Tcm4TlvDq8ikWAM\nStadium announcer | pNInz6obpgDQGcFmaJgB'}
              className="field font-mono text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">Voice clones: coach/adult voices only. Never clone a player’s voice.</p>
          </div>
          <div className="max-w-sm">
            <label className="field-label">Model id</label>
            <input name="model" defaultValue={voice.model} className="field font-mono text-sm" />
          </div>
          <button type="submit" className="btn btn-primary">Save voices</button>
        </form>
      </section>
    </div>
  )
}

function SeriesForm({ s }: { s?: ContentSeries }) {
  return (
    <form action={saveContentSeries} className="grid sm:grid-cols-6 gap-3">
      {s && <input type="hidden" name="id" value={s.id} />}
      <div className="sm:col-span-3">
        <label className="field-label">Name *</label>
        <input name="name" required maxLength={120} defaultValue={s?.name ?? ''} className="field" />
      </div>
      <div className="sm:col-span-2">
        <label className="field-label">Slug</label>
        <input name="slug" maxLength={80} defaultValue={s?.slug ?? ''} placeholder="from the name" className="field" />
      </div>
      <div>
        <label className="field-label">Color</label>
        <input type="color" name="color" defaultValue={s?.color ?? '#1f4d2b'} className="field !p-1 h-10" />
      </div>
      <div className="sm:col-span-6">
        <label className="field-label">Purpose</label>
        <textarea name="purpose" rows={2} defaultValue={s?.purpose ?? ''} className="field" />
      </div>
      <div className="sm:col-span-2">
        <label className="field-label">Cadence</label>
        <input name="cadence" defaultValue={s?.cadence ?? ''} placeholder="weekly" className="field" />
      </div>
      <div className="sm:col-span-2">
        <label className="field-label">Target length (s)</label>
        <input type="number" name="target_length_s" min={0} defaultValue={s?.target_length_s ?? ''} className="field" />
      </div>
      <div className="sm:col-span-2">
        <label className="field-label">Order</label>
        <input type="number" name="sort_order" defaultValue={s?.sort_order ?? 0} className="field" />
      </div>
      <div className="sm:col-span-6">
        <label className="field-label">Hook formula</label>
        <textarea name="hook_formula" rows={2} defaultValue={s?.hook_formula ?? ''} className="field" />
      </div>
      <div className="sm:col-span-6">
        <label className="field-label">
          Shot list — one per line: secs | shot{s?.shot_list.length ? ` (${shotsTotal(s.shot_list)}s total)` : ''}
        </label>
        <textarea
          name="shot_list"
          rows={Math.max(3, (s?.shot_list.length ?? 0) + 1)}
          defaultValue={s ? shotsToText(s.shot_list) : ''}
          placeholder={'2 | Wide establishing shot\n10 | 3-4 tight action clips'}
          className="field font-mono text-sm"
        />
      </div>
      <div className="sm:col-span-6">
        <label className="field-label">Canva template</label>
        <input type="url" name="canva_template_url" defaultValue={s?.canva_template_url ?? ''} placeholder="https://www.canva.com/design/…" className="field" />
      </div>
      <div className="sm:col-span-6">
        <label className="field-label">Caption formula</label>
        <textarea name="caption_formula" rows={4} defaultValue={s?.caption_formula ?? ''} className="field" />
      </div>
      <div className="sm:col-span-6">
        <label className="field-label">Default hashtags</label>
        <input name="default_hashtags" defaultValue={s?.default_hashtags ?? ''} className="field" />
      </div>
      <div className="sm:col-span-2">
        <label className="field-label">Voice</label>
        <select name="vo_mode" defaultValue={s?.vo_mode ?? 'none'} className="field">
          {VO_MODES.map((m) => (
            <option key={m} value={m}>{VO_MODE_LABELS[m]}</option>
          ))}
        </select>
      </div>
      <div className="sm:col-span-4">
        <label className="field-label">Voiceover template</label>
        <textarea name="vo_template" rows={2} defaultValue={s?.vo_template ?? ''} className="field" />
      </div>
      <div className="sm:col-span-2">
        <label className="field-label">In use</label>
        <select name="is_active" defaultValue={String(s?.is_active ?? true)} className="field">
          <option value="true">Active</option>
          <option value="false">Off</option>
        </select>
      </div>
      <div className="sm:col-span-6">
        <button type="submit" className="btn btn-primary">{s ? 'Save series' : 'Add series'}</button>
      </div>
    </form>
  )
}
