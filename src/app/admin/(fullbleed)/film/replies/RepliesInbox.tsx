'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import type { ClipMessage, ReplyThread } from '@/lib/clipShareData'
import { answerReply, readReplies } from '@/lib/clipShareActions'

const keyOf = (t: Pick<ReplyThread, 'clipId' | 'viewer'>) => `${t.clipId}|${t.viewer}`

function when(iso: string): string {
  const d = new Date(iso)
  if (isNaN(+d)) return ''
  return d.toLocaleString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

const kindLabel = (viewer: string) => (viewer.startsWith('player:') ? 'Player' : viewer.startsWith('parent:') ? 'Parent' : 'Coach')

/**
 * The head coach's replies: one conversation per clip per person. Unread
 * ones first; opening one reads it, and the answer goes straight back to the
 * person's own Film Room under that clip.
 */
export function RepliesInbox({ threads: initial }: { threads: ReplyThread[] }) {
  const [threads, setThreads] = useState(initial)
  const [openKey, setOpenKey] = useState<string | null>(initial[0] ? keyOf(initial[0]) : null)
  // Conversations opened here, which therefore count as read.
  const [readKeys, setReadKeys] = useState<Set<string>>(() => new Set(initial[0] ? [keyOf(initial[0])] : []))
  const open = threads.find((t) => keyOf(t) === openKey) ?? null
  const unreadOf = (t: ReplyThread) => (readKeys.has(keyOf(t)) ? 0 : t.unread)
  const unread = threads.reduce((n, t) => n + unreadOf(t), 0)

  // The one open when the page loads is read by being open.
  useEffect(() => {
    const first = initial[0]
    if (first?.unread) void readReplies({ clipId: first.clipId, viewer: first.viewer })
  }, [initial])

  function pick(t: ReplyThread) {
    const k = keyOf(t)
    setOpenKey(k)
    if (t.unread && !readKeys.has(k)) {
      setReadKeys((cur) => new Set(cur).add(k))
      void readReplies({ clipId: t.clipId, viewer: t.viewer })
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <h1 className="text-xl font-black">
          Film replies {unread > 0 && <span className="ml-1 text-sm font-black px-2 py-0.5 rounded-full text-white" style={{ background: '#228b22' }}>{unread} new</span>}
        </h1>
        <Link href="/admin/film" className="btn btn-ghost !py-1.5 text-sm">
          Back to the board
        </Link>
      </div>

      {threads.length === 0 ? (
        <div className="card p-8 text-center max-w-lg mx-auto">
          <div className="text-3xl" aria-hidden>💬</div>
          <p className="font-black mt-2">No replies yet</p>
          <p className="text-sm text-gray-500 mt-1">
            When a player, parent or coach writes back about a clip you sent — a question, or an answer to yours — it shows up here.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-[320px_minmax(0,1fr)] items-start">
          <ul className="card p-2 flex flex-col gap-1 md:sticky md:top-2">
            {threads.map((t) => {
              const on = keyOf(t) === openKey
              const last = t.messages[t.messages.length - 1]
              return (
                <li key={keyOf(t)}>
                  <button
                    type="button"
                    onClick={() => pick(t)}
                    className="w-full text-left rounded-lg px-3 py-2.5 flex items-start gap-3 transition-colors"
                    style={{ background: on ? 'var(--surface-2)' : 'transparent', boxShadow: on ? 'inset 3px 0 0 var(--gh-green)' : undefined }}
                  >
                    <span className="flex-1 min-w-0">
                      <span className="flex items-center gap-2">
                        <span className={`truncate ${unreadOf(t) ? 'font-black' : 'font-bold'}`}>{t.viewerName}</span>
                        <span className="text-[0.6rem] font-black uppercase tracking-wide text-gray-400">{kindLabel(t.viewer)}</span>
                      </span>
                      <span className="block text-xs text-gray-500 truncate">{t.clipName}</span>
                      <span className={`block text-sm truncate mt-0.5 ${unreadOf(t) ? 'text-gray-900' : 'text-gray-500'}`}>
                        {last?.fromCoach ? 'You: ' : ''}
                        {last?.body}
                      </span>
                    </span>
                    {unreadOf(t) > 0 && (
                      <span className="mt-1 shrink-0 text-[0.65rem] font-black text-white rounded-full px-1.5 min-w-5 text-center" style={{ background: '#228b22' }}>
                        {unreadOf(t)}
                      </span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
          {open && <Conversation key={keyOf(open)} thread={open} onSent={(m) => setThreads((ts) => ts.map((x) => (keyOf(x) === keyOf(open) ? { ...x, messages: [...x.messages, m], lastAt: m.createdAt } : x)))} />}
        </div>
      )}
    </div>
  )
}

function Conversation({ thread, onSent }: { thread: ReplyThread; onSent: (m: ClipMessage) => void }) {
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' })
  }, [thread.messages.length])

  async function send() {
    const body = draft.trim()
    if (!body || sending) return
    setSending(true)
    setError('')
    const r = await answerReply({ clipId: thread.clipId, viewer: thread.viewer, body })
    setSending(false)
    if (!r.ok) {
      setError(r.error)
      return
    }
    setDraft('')
    onSent(r.message)
  }

  const thumb = thread.film ? `${thread.film.thumb.split('?')[0]}?time=${Math.round(thread.start)}s&height=180` : null
  return (
    <section className="card p-4 sm:p-5">
      <div className="flex items-start gap-3 pb-3 border-b" style={{ borderColor: 'var(--border)' }}>
        <Link href={`/admin/film?clip=${thread.clipId}`} className="shrink-0 relative rounded-lg overflow-hidden bg-black w-36 aspect-video" title="Watch the clip on the board">
          {thumb && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumb} alt="" className="w-full h-full object-cover opacity-90" />
          )}
          <span className="absolute inset-0 flex items-center justify-center text-white text-lg" aria-hidden>▶</span>
        </Link>
        <div className="min-w-0">
          <div className="font-black leading-snug">{thread.clipName}</div>
          <div className="text-sm text-gray-500">
            {thread.viewerName} · {kindLabel(thread.viewer)}
          </div>
          {thread.prompt && (
            <p className="mt-2 text-sm font-semibold rounded-lg px-3 py-2" style={{ background: 'rgba(34,139,34,.1)', borderLeft: '4px solid #228b22' }}>
              You asked: {thread.prompt}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2 py-4 max-h-[50vh] overflow-y-auto">
        {thread.messages.map((m) => (
          <div
            key={m.id}
            className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm ${m.fromCoach ? 'self-end text-white rounded-br-md' : 'self-start rounded-bl-md border'}`}
            style={m.fromCoach ? { background: '#0e7a50' } : { background: 'var(--surface-2)', borderColor: 'var(--border)' }}
          >
            <div className="text-[0.65rem] font-black uppercase tracking-wide opacity-70">
              {m.fromCoach ? 'You' : thread.viewerName} · {when(m.createdAt)}
            </div>
            <div className="whitespace-pre-wrap break-words">{m.body}</div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <div className="flex gap-2 items-end">
        <textarea
          className="field flex-1 text-sm"
          rows={2}
          value={draft}
          maxLength={4000}
          placeholder={`Answer ${thread.viewerName.split(' ')[0]}…`}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void send()
          }}
        />
        <button type="button" className="btn btn-primary !py-2" disabled={!draft.trim() || sending} onClick={() => void send()}>
          {sending ? 'Sending…' : 'Send'}
        </button>
      </div>
      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
      <p className="text-xs text-gray-400 mt-2">Your answer shows up under the clip in {thread.viewerName.split(' ')[0]}’s Film Room.</p>
    </section>
  )
}
