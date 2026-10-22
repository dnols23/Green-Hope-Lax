'use client'

import { useState } from 'react'
import { saveVolunteerSetup } from '@/lib/gameVolunteerActions'
import type { Position, VolLevel, VolSee, VolunteerSettings } from '@/lib/gameVolunteerModel'
import { PositionsEditor } from './PositionsEditor'

const SEE: { key: VolSee; label: string }[] = [
  { key: 'none', label: 'No' },
  { key: 'varsity', label: 'Varsity' },
  { key: 'jv', label: 'JV' },
  { key: 'all', label: 'Both' },
]

/**
 * The head coach's setup for game volunteers: the positions every home and
 * away game starts with, for each team; which coaches see sign-ups on their
 * calendar; and the switch that lets parents see them.
 */
export function VolunteerSetup({ initial, coaches }: { initial: VolunteerSettings; coaches: { email: string; name: string }[] }) {
  const [saved, setSaved] = useState(initial)
  const [s, setS] = useState(initial)
  const [level, setLevel] = useState<VolLevel>('varsity')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  const [confirm, setConfirm] = useState<string | null>(null)

  const dirty = JSON.stringify({ ...s, open: saved.open }) !== JSON.stringify(saved)
  const blank = (['varsity', 'jv'] as VolLevel[]).some((l) => [...s.lists[l].home, ...s.lists[l].away].some((p) => !p.label.trim()))

  const setList = (venue: 'home' | 'away', next: Position[]) =>
    setS((cur) => ({ ...cur, lists: { ...cur.lists, [level]: { ...cur.lists[level], [venue]: next } } }))

  /** Save. The parents switch saves at once and leaves any list edits as they are. */
  async function save(next = s, sure = false, onlyOpen = false) {
    setBusy(true)
    setMsg(null)
    try {
      const res = await saveVolunteerSetup({ settings: next, confirm: sure })
      if (!res.ok) {
        if (res.confirm) setConfirm(res.error)
        else setMsg({ tone: 'error', text: res.error })
        return
      }
      setSaved(next)
      setS(onlyOpen ? (cur) => ({ ...cur, open: next.open }) : next)
      setConfirm(null)
      setMsg({
        tone: 'ok',
        text: onlyOpen
          ? next.open
            ? 'Open — parents can sign up now.'
            : 'Hidden from parents.'
          : `Saved. ${res.games} upcoming ${res.games === 1 ? 'game is' : 'games are'} up to date.`,
      })
    } catch {
      setMsg({ tone: 'error', text: 'Couldn’t reach the server. Try again.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section id="volunteers" className="card p-5 scroll-mt-20">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="font-bold text-gray-700">🙋 Game volunteers</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Every game gets a sign-up from these lists. Parents tap a game in their calendar to sign up; they get a copy by
            email and a reminder the day before. To change one game, open its 🙋 Volunteers on your calendar.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={saved.open}
          disabled={busy}
          onClick={() => void save({ ...saved, open: !saved.open }, false, true)}
          className="shrink-0 min-h-9 pl-1.5 pr-3 rounded-full border text-sm font-bold inline-flex items-center gap-2"
          style={saved.open ? { background: '#e6f2ec', color: '#00512F', borderColor: '#6fbf8f' } : { color: 'var(--text-muted)', borderColor: 'var(--border)' }}
          title={saved.open ? 'Parents can see and take spots' : 'Parents don’t see sign-ups yet'}
        >
          <span aria-hidden className="relative w-8 h-[18px] rounded-full" style={{ background: saved.open ? '#00693E' : 'var(--color-gray-300, #d1d5db)' }}>
            <span className="absolute top-[3px] w-3 h-3 rounded-full bg-white transition-all" style={{ left: saved.open ? 17 : 3 }} />
          </span>
          {saved.open ? 'Open to parents' : 'Hidden from parents'}
        </button>
      </div>

      <div className="mt-4 inline-flex rounded-full border border-gray-200 bg-white p-0.5" role="tablist">
        {(['varsity', 'jv'] as VolLevel[]).map((l) => (
          <button
            key={l}
            type="button"
            role="tab"
            aria-selected={level === l}
            onClick={() => setLevel(l)}
            className="min-h-8 px-4 rounded-full text-sm font-bold"
            style={level === l ? { background: 'var(--gh-green)', color: '#fff' } : { color: 'var(--color-gray-600, #4b5563)' }}
          >
            {l === 'jv' ? 'JV' : 'Varsity'}
          </button>
        ))}
      </div>
      {level === 'jv' && (
        <button
          type="button"
          onClick={() => setS((cur) => ({ ...cur, lists: { ...cur.lists, jv: structuredClone(cur.lists.varsity) } }))}
          className="ml-3 text-sm font-semibold text-[var(--gh-green)]"
        >
          Copy varsity’s lists
        </button>
      )}

      <div className="mt-3 grid gap-4 md:grid-cols-2">
        {(['home', 'away'] as const).map((venue) => (
          <div key={venue}>
            <div className="text-[0.7rem] font-black tracking-[0.15em] uppercase text-gray-400 mb-1.5">
              {level === 'jv' ? 'JV' : 'Varsity'} · {venue} games
            </div>
            <PositionsEditor value={s.lists[level][venue]} onChange={(next) => setList(venue, next)} />
          </div>
        ))}
      </div>

      {coaches.length > 0 && (
        <div className="mt-5">
          <div className="text-[0.7rem] font-black tracking-[0.15em] uppercase text-gray-400 mb-1.5">On whose calendar</div>
          <p className="text-sm text-gray-500 mb-2">You see every sign-up. Pick who else does, and for which team.</p>
          <div className="rounded-xl border border-gray-200 divide-y divide-gray-100">
            {coaches.map((c) => {
              const cur = s.viewers[c.email] ?? 'none'
              return (
                <div key={c.email} className="flex flex-wrap items-center gap-2 px-3 py-2">
                  <span className="font-semibold text-sm flex-1 min-w-32">{c.name}</span>
                  <div className="inline-flex rounded-full border border-gray-200 p-0.5" role="group" aria-label={`Sign-ups for ${c.name}`}>
                    {SEE.map((o) => (
                      <button
                        key={o.key}
                        type="button"
                        aria-pressed={cur === o.key}
                        onClick={() =>
                          setS((x) => {
                            const viewers = { ...x.viewers }
                            if (o.key === 'none') delete viewers[c.email]
                            else viewers[c.email] = o.key
                            return { ...x, viewers }
                          })
                        }
                        className="min-h-7 px-2.5 rounded-full text-xs font-bold"
                        style={cur === o.key ? { background: 'var(--color-gray-900, #111827)', color: 'var(--surface, #fff)' } : { color: 'var(--color-gray-500, #6b7280)' }}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {confirm && (
        <div role="alert" className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5">
          <p className="text-sm font-semibold text-amber-900">{confirm}</p>
          <div className="mt-2 flex gap-2">
            <button type="button" disabled={busy} onClick={() => void save(s, true)} className="btn btn-maroon !py-1.5">
              Save anyway
            </button>
            <button type="button" onClick={() => setConfirm(null)} className="btn btn-ghost !py-1.5">
              Go back
            </button>
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" disabled={busy || !dirty || blank} onClick={() => void save()} className="btn btn-primary disabled:opacity-50">
          {busy ? 'Saving…' : 'Save'}
        </button>
        {dirty && (
          <button type="button" disabled={busy} onClick={() => setS(saved)} className="btn btn-ghost">
            Undo changes
          </button>
        )}
        {blank && <span className="text-sm text-gray-500">Every position needs a name.</span>}
        {msg && (
          <span role="status" className="text-sm font-semibold" style={{ color: msg.tone === 'ok' ? '#00512F' : 'var(--gh-maroon)' }}>
            {msg.text}
          </span>
        )}
      </div>
    </section>
  )
}
