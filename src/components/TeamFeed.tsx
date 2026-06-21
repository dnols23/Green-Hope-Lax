'use client'
import { useState } from 'react'
import type { TeamPost, TeamPostCategory } from '@/lib/types'
import { TEAM_CATEGORY_META, parseAttachments } from '@/lib/types'
import { formatDate, formatTime } from '@/lib/format'

const FILTERS: ('all' | TeamPostCategory)[] = [
  'all', 'announcement', 'practice', 'game', 'forms', 'event', 'gear', 'general',
]

function PostCard({ post }: { post: TeamPost }) {
  const meta = TEAM_CATEGORY_META[post.category]
  const attachments = parseAttachments(post.attachments)
  return (
    <article className="card p-5">
      <div className="flex items-center justify-between gap-3 mb-2">
        <span className={`badge ${meta.cls}`}>{meta.emoji} {meta.label}</span>
        <span className="text-xs text-gray-400">{formatDate(post.created_at, { year: 'numeric' })}</span>
      </div>

      {post.pinned && (
        <div className="text-[0.65rem] font-bold tracking-wide uppercase mb-1" style={{ color: 'var(--gh-maroon)' }}>
          📌 Pinned
        </div>
      )}

      <h3 className="font-black text-lg leading-snug">{post.title}</h3>

      {post.event_date && (
        <div className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold" style={{ color: 'var(--gh-green)' }}>
          🗓 {formatDate(post.event_date, { weekday: 'long', year: 'numeric' })} · {formatTime(post.event_date)}
        </div>
      )}

      {post.body && <p className="prose-body mt-2 text-[0.95rem]">{post.body}</p>}

      {attachments.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {attachments.map((a, i) => (
            <a
              key={i}
              href={a.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-semibold rounded-lg px-3 py-1.5 border"
              style={{ borderColor: 'var(--border)', color: 'var(--gh-green)' }}
            >
              🔗 {a.label}
            </a>
          ))}
        </div>
      )}

      <div className="mt-3 text-xs text-gray-400">Posted by {post.author}</div>
    </article>
  )
}

export function TeamFeed({ posts }: { posts: TeamPost[] }) {
  const [filter, setFilter] = useState<'all' | TeamPostCategory>('all')
  const shown = filter === 'all' ? posts : posts.filter((p) => p.category === filter)

  return (
    <div>
      {/* Category filter chips */}
      <div className="flex flex-wrap gap-2 mb-5">
        {FILTERS.map((f) => {
          const label = f === 'all' ? 'All' : TEAM_CATEGORY_META[f].label
          const active = filter === f
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="px-3 py-1.5 rounded-full text-xs font-bold border transition-colors"
              style={
                active
                  ? { background: 'var(--gh-green)', color: '#fff', borderColor: 'var(--gh-green)' }
                  : { background: '#fff', color: '#374151', borderColor: 'var(--border)' }
              }
            >
              {label}
            </button>
          )
        })}
      </div>

      {shown.length === 0 ? (
        <div className="card p-8 text-center text-gray-500">
          {posts.length === 0 ? 'No posts yet — check back soon!' : 'Nothing in this category yet.'}
        </div>
      ) : (
        <div className="space-y-4">
          {shown.map((p) => <PostCard key={p.id} post={p} />)}
        </div>
      )}
    </div>
  )
}
