import { getTeamPosts } from '@/lib/queries'
import { upsertTeamPost, deleteTeamPost, setTeamPassword } from '@/lib/actions'
import { DeleteButton } from '@/components/admin/DeleteButton'
import { TEAM_CATEGORY_META, type TeamPost, type TeamPostCategory } from '@/lib/types'

export const metadata = { title: 'Manage Team Hub' }
export const dynamic = 'force-dynamic'

const CATEGORIES = Object.keys(TEAM_CATEGORY_META) as TeamPostCategory[]

function toLocalInput(iso: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function PostFields({ p }: { p?: TeamPost }) {
  return (
    <div className="space-y-3">
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <label className="field-label">Title *</label>
          <input name="title" required defaultValue={p?.title ?? ''} className="field" />
        </div>
        <div>
          <label className="field-label">Category *</label>
          <select name="category" defaultValue={p?.category ?? 'announcement'} className="field">
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{TEAM_CATEGORY_META[c].emoji} {TEAM_CATEGORY_META[c].label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label">Event date &amp; time (optional)</label>
          <input type="datetime-local" name="event_date" defaultValue={toLocalInput(p?.event_date ?? null)} className="field" />
        </div>
        <div>
          <label className="field-label">Pin to top?</label>
          <select name="pinned" defaultValue={String(p?.pinned ?? false)} className="field">
            <option value="false">No</option>
            <option value="true">Yes — pinned</option>
          </select>
        </div>
        <div>
          <label className="field-label">Published?</label>
          <select name="published" defaultValue={String(p?.published ?? true)} className="field">
            <option value="true">Published</option>
            <option value="false">Draft (hidden)</option>
          </select>
        </div>
      </div>
      <div>
        <label className="field-label">Message *</label>
        <textarea name="body" rows={4} defaultValue={p?.body ?? ''} className="field" />
      </div>
      <div>
        <label className="field-label">Attachments / links — one per line as “Label | https://link”</label>
        <textarea name="attachments" rows={2} defaultValue={p?.attachments ?? ''} className="field"
          placeholder="Physical Form | https://example.com/form.pdf" />
      </div>
      <div>
        <label className="field-label">Posted by</label>
        <input name="author" defaultValue={p?.author ?? 'Coach'} className="field" />
      </div>
    </div>
  )
}

export default async function AdminTeamPage() {
  const posts = await getTeamPosts(true) // include drafts

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-black mb-1">Team Hub</h1>
        <p className="text-gray-500 text-sm">
          Post to the private parent/player feed at{' '}
          <a href="/team" target="_blank" className="text-[var(--gh-green)] font-semibold">/team ↗</a>.
        </p>
      </div>

      {/* Team password */}
      <section className="card p-5">
        <h2 className="font-bold text-gray-700 mb-1">Team Login Password</h2>
        <p className="text-sm text-gray-500 mb-3">
          One shared password for all parents &amp; players. Share it with your team; change it here anytime
          (e.g. each season). Current password isn’t shown for security — setting a new one replaces it.
        </p>
        <form action={setTeamPassword} className="flex flex-wrap items-end gap-3">
          <div>
            <label className="field-label">New team password</label>
            <input name="team_password" minLength={4} required className="field" placeholder="e.g. GoFalcons2027" />
          </div>
          <button type="submit" className="btn btn-maroon">Update password</button>
        </form>
      </section>

      {/* Add post */}
      <section className="card p-5">
        <h2 className="font-bold text-gray-700 mb-4">New Post</h2>
        <form action={upsertTeamPost} className="space-y-4">
          <PostFields />
          <button type="submit" className="btn btn-primary">Post to team feed</button>
        </form>
      </section>

      {/* Existing posts */}
      <section>
        <h2 className="font-bold text-gray-700 mb-3">All Posts ({posts.length})</h2>
        <div className="space-y-2">
          {posts.map((p) => (
            <details key={p.id} className="card p-4">
              <summary className="flex items-center justify-between cursor-pointer list-none gap-3">
                <span className="font-semibold">
                  {p.pinned && '📌 '}
                  {TEAM_CATEGORY_META[p.category].emoji} {p.title}
                  <span className="ml-2 text-xs text-gray-400">
                    {new Date(p.created_at).toLocaleDateString()}{!p.published && ' · draft'}
                  </span>
                </span>
                <DeleteButton id={p.id} action={deleteTeamPost} />
              </summary>
              <form action={upsertTeamPost} className="mt-4 space-y-4">
                <input type="hidden" name="id" value={p.id} />
                <PostFields p={p} />
                <button type="submit" className="btn btn-primary">Save changes</button>
              </form>
            </details>
          ))}
        </div>
      </section>
    </div>
  )
}
