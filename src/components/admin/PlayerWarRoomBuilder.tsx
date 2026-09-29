'use client'

import { useState, useTransition } from 'react'
import { SlideList, type SlideGrip } from './SlideList'
import { savePlayerWarRoom } from '@/lib/playerWarRoomActions'
import { PLAYER_PANELS, type Leader, type PlayerPanelKey, type PlayerWarRoom, type QuoteChoice } from '@/lib/playerWarRoom'
import { newId } from '@/lib/planner'
import type { Team } from '@/lib/teams'

export interface BuilderQuote {
  id: string
  line: string
  who: string | null
}
export interface BuilderPlaylist {
  id: string
  name: string
  count: number
}
export interface BuilderList {
  id: string
  name: string
  team: Team
  open: number
}

/**
 * Building the players' War Room: which panels show and in what order, the
 * quote, whose practice shows as today's, which priority lists the players may
 * read, and the leadership roles.
 */
export function PlayerWarRoomBuilder({
  initial,
  quotes,
  playlists,
  lists,
}: {
  initial: PlayerWarRoom
  quotes: BuilderQuote[]
  playlists: BuilderPlaylist[]
  lists: BuilderList[]
}) {
  const [w, setW] = useState<PlayerWarRoom>(initial)
  const [saving, startSaving] = useTransition()
  const [said, setSaid] = useState<{ ok: boolean; text: string } | null>(null)

  const change = (next: Partial<PlayerWarRoom>) => {
    setW((x) => ({ ...x, ...next }))
    setSaid(null)
  }
  const setQuote = (q: QuoteChoice) => change({ quote: q })
  const patchLeader = (id: string, next: Partial<Leader>) =>
    change({ leaders: w.leaders.map((l) => (l.id === id ? { ...l, ...next } : l)) })

  function save() {
    startSaving(async () => {
      const res = await savePlayerWarRoom(w)
      setSaid(res.ok ? { ok: true, text: 'Saved. The players see it now.' } : { ok: false, text: res.error })
    })
  }

  const mode = w.quote.mode
  const seg = (on: boolean) =>
    `min-h-9 px-3.5 rounded-full text-sm font-bold transition-colors ${on ? 'text-white' : 'text-gray-600'}`
  const segStyle = (on: boolean) => (on ? { background: 'var(--gh-green)' } : undefined)

  return (
    <div className="space-y-4">
      {/* ── Panels ── */}
      <section className="card p-5">
        <h2 className="font-bold text-gray-700 mb-1">Panels</h2>
        <p className="text-xs text-gray-500 mb-3">Slide to reorder. Switch off what they shouldn&rsquo;t see.</p>
        <SlideList
          items={w.order.map((k) => ({ id: k }))}
          onReorder={(ids) => change({ order: ids as PlayerPanelKey[] })}
          label={(p) => PLAYER_PANELS.find((x) => x.key === p.id)?.label ?? p.id}
          className="space-y-1.5"
          renderItem={(p, grip) => {
            const meta = PLAYER_PANELS.find((x) => x.key === p.id)!
            const on = !w.off.includes(meta.key)
            return (
              <div className="flex items-center gap-3 rounded-lg border px-3 min-h-11" style={{ borderColor: 'var(--border)' }}>
                <Grip grip={grip} />
                <span aria-hidden>{meta.icon}</span>
                <span className={`flex-1 text-sm font-semibold ${on ? '' : 'text-gray-400 line-through'}`}>{meta.label}</span>
                <Switch
                  on={on}
                  label={`Show ${meta.label}`}
                  onChange={(v) => change({ off: v ? w.off.filter((k) => k !== meta.key) : [...w.off, meta.key] })}
                />
              </div>
            )
          }}
        />
      </section>

      {/* ── Quote ── */}
      <section className="card p-5">
        <h2 className="font-bold text-gray-700 mb-3">💬 Quote</h2>
        <div className="inline-flex flex-wrap rounded-full border border-gray-200 bg-white p-0.5 mb-3" role="radiogroup" aria-label="Where the quote comes from">
          <button type="button" role="radio" aria-checked={mode === 'rotate'} className={seg(mode === 'rotate')} style={segStyle(mode === 'rotate')}
            onClick={() => setQuote({ mode: 'rotate', source: 'all' })}>
            New each day
          </button>
          <button type="button" role="radio" aria-checked={mode === 'pick'} className={seg(mode === 'pick')} style={segStyle(mode === 'pick')}
            onClick={() => setQuote({ mode: 'pick', quoteId: quotes[0]?.id ?? '' })}>
            One quote
          </button>
          <button type="button" role="radio" aria-checked={mode === 'custom'} className={seg(mode === 'custom')} style={segStyle(mode === 'custom')}
            onClick={() => setQuote({ mode: 'custom', line: '', who: '' })}>
            Write my own
          </button>
        </div>

        {w.quote.mode === 'rotate' && (
          <label className="block max-w-md">
            <span className="field-label">From</span>
            <select value={w.quote.source} onChange={(e) => setQuote({ mode: 'rotate', source: e.target.value })} className="field">
              <option value="all">Every quote on the Wall ({quotes.length})</option>
              {playlists.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.count})
                </option>
              ))}
            </select>
          </label>
        )}
        {w.quote.mode === 'pick' && (
          <label className="block">
            <span className="field-label">Quote</span>
            <select value={w.quote.quoteId} onChange={(e) => setQuote({ mode: 'pick', quoteId: e.target.value })} className="field">
              {quotes.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.line.length > 90 ? `${q.line.slice(0, 88)}…` : q.line}
                  {q.who ? ` — ${q.who}` : ''}
                </option>
              ))}
            </select>
          </label>
        )}
        {w.quote.mode === 'custom' && (
          <div className="space-y-2">
            <textarea
              value={w.quote.line}
              onChange={(e) => setQuote({ ...(w.quote as Extract<QuoteChoice, { mode: 'custom' }>), line: e.target.value })}
              rows={2}
              maxLength={600}
              placeholder="The quote"
              aria-label="The quote"
              className="field"
            />
            <input
              value={w.quote.who}
              onChange={(e) => setQuote({ ...(w.quote as Extract<QuoteChoice, { mode: 'custom' }>), who: e.target.value })}
              maxLength={120}
              placeholder="Who said it (optional)"
              aria-label="Who said it"
              className="field max-w-md"
            />
          </div>
        )}
      </section>

      {/* ── Today's practice ── */}
      <section className="card p-5">
        <h2 className="font-bold text-gray-700 mb-1">📋 Today&rsquo;s practice</h2>
        <p className="text-xs text-gray-500 mb-3">Shows a plan dated today with Players ticked.</p>
        <div className="flex gap-2">
          {(['varsity', 'jv'] as Team[]).map((t) => {
            const on = w.planTeams.includes(t)
            return (
              <button
                key={t}
                type="button"
                aria-pressed={on}
                onClick={() => change({ planTeams: on ? w.planTeams.filter((x) => x !== t) : [...w.planTeams, t] })}
                className="min-h-9 px-4 rounded-full border text-sm font-bold"
                style={on ? { background: 'var(--gh-green)', borderColor: 'var(--gh-green)', color: '#fff' } : { borderColor: 'var(--border)', color: 'var(--text-muted)' }}
              >
                {t === 'varsity' ? 'Varsity' : 'JV'}
              </button>
            )
          })}
        </div>
      </section>

      {/* ── Priorities ── */}
      <section className="card p-5">
        <h2 className="font-bold text-gray-700 mb-1">🎯 Priorities</h2>
        <p className="text-xs text-gray-500 mb-3">
          Players see the open items on the lists you tick — never your notes — and can&rsquo;t change anything.
        </p>
        {lists.length === 0 ? (
          <p className="text-sm text-gray-500">No priority lists yet.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {(['varsity', 'jv'] as Team[]).map((t) => {
              const mine = lists.filter((l) => l.team === t)
              if (!mine.length) return null
              return (
                <div key={t}>
                  <div className="text-xs font-black uppercase tracking-wide text-gray-500 mb-1.5">{t === 'varsity' ? 'Varsity' : 'JV'}</div>
                  <ul className="space-y-1">
                    {mine.map((l) => {
                      const on = w.priorityLists.includes(l.id)
                      return (
                        <li key={l.id}>
                          <label className="flex items-center gap-2.5 text-sm min-h-9 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={on}
                              onChange={() =>
                                change({ priorityLists: on ? w.priorityLists.filter((x) => x !== l.id) : [...w.priorityLists, l.id] })
                              }
                              className="w-4 h-4 accent-[var(--gh-green)]"
                            />
                            <span className="flex-1">{l.name}</span>
                            <span className="text-xs text-gray-400">{l.open} open</span>
                          </label>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* ── Leadership ── */}
      <section className="card p-5">
        <h2 className="font-bold text-gray-700 mb-3">🦅 Leadership</h2>
        <SlideList
          items={w.leaders}
          onReorder={(ids) => change({ leaders: ids.map((id) => w.leaders.find((l) => l.id === id)!).filter(Boolean) })}
          label={(l) => l.title || 'role'}
          className="space-y-2"
          renderItem={(l, grip) => (
            <div className="rounded-lg border p-3 flex gap-2" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
              <Grip grip={grip} />
              <div className="flex-1 min-w-0 grid gap-2 sm:grid-cols-[12rem_1fr]">
                <input
                  value={l.title}
                  onChange={(e) => patchLeader(l.id, { title: e.target.value })}
                  maxLength={60}
                  placeholder="Role — e.g. Captains"
                  aria-label="Role"
                  className="field !py-1.5 font-bold"
                />
                <input
                  value={l.who}
                  onChange={(e) => patchLeader(l.id, { who: e.target.value })}
                  maxLength={300}
                  placeholder="Who — e.g. #12 Jake Smith, #7 Luke Ortiz"
                  aria-label="Who"
                  className="field !py-1.5"
                />
                <textarea
                  value={l.duties}
                  onChange={(e) => patchLeader(l.id, { duties: e.target.value })}
                  maxLength={600}
                  rows={1}
                  placeholder="What the job is (optional)"
                  aria-label="What the job is"
                  className="field !py-1.5 text-sm sm:col-span-2"
                />
              </div>
              <button
                type="button"
                onClick={() => change({ leaders: w.leaders.filter((x) => x.id !== l.id) })}
                className="shrink-0 w-9 h-9 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                aria-label={`Remove ${l.title || 'this role'}`}
              >
                ×
              </button>
            </div>
          )}
        />
        {w.leaders.length < 20 && (
          <button
            type="button"
            onClick={() => change({ leaders: [...w.leaders, { id: newId('l'), title: '', who: '', duties: '' }] })}
            className="btn btn-ghost !py-1.5 text-sm mt-2"
          >
            + Add a role
          </button>
        )}
      </section>

      {/* ── Save ── */}
      <div
        className="sticky bottom-0 z-20 rounded-xl border p-3 flex items-center gap-3 flex-wrap shadow-[0_-4px_24px_rgba(0,0,0,.08)]"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <a href="/team" target="_blank" className="text-sm font-bold text-[var(--gh-green)]">
          Open it ↗
        </a>
        {said && (
          <span role={said.ok ? 'status' : 'alert'} className={`text-sm font-semibold ${said.ok ? 'text-green-700' : 'text-red-700'}`}>
            {said.text}
          </span>
        )}
        <button type="button" onClick={save} disabled={saving} className="btn btn-primary !py-1.5 ml-auto disabled:opacity-60">
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}

function Grip({ grip }: { grip: SlideGrip | null }) {
  if (!grip) return null
  return (
    <span {...grip} className="shrink-0 w-6 grid place-items-center text-gray-400 select-none self-center">
      <svg aria-hidden width="12" height="16" viewBox="0 0 12 16" fill="currentColor">
        <circle cx="3" cy="3" r="1.5" /><circle cx="9" cy="3" r="1.5" />
        <circle cx="3" cy="8" r="1.5" /><circle cx="9" cy="8" r="1.5" />
        <circle cx="3" cy="13" r="1.5" /><circle cx="9" cy="13" r="1.5" />
      </svg>
    </span>
  )
}

function Switch({ on, label, onChange }: { on: boolean; label: string; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} className="min-h-9 px-1">
      <span
        aria-hidden
        className="relative block w-10 h-6 rounded-full transition-colors"
        style={{ background: on ? 'var(--gh-green)' : 'var(--color-gray-300, #d1d5db)' }}
      >
        <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all" style={{ left: on ? '1.125rem' : '0.125rem' }} />
      </span>
    </button>
  )
}
