import { createClient } from '@/lib/supabase-server'
import { upsertNews, deleteNews } from '@/lib/actions'
import { DeleteButton } from '@/components/admin/DeleteButton'
import type { NewsPost } from '@/lib/types'

export const metadata = { title: 'Manage News' }

function toLocalInput(iso: string) {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function NewsFields({ n }: { n?: NewsPost }) {
  return (
    <div className="space-y-3">
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="field-label">Title *</label>
          <input name="title" required defaultValue={n?.title ?? ''} className="field" />
        </div>
        <div>
          <label className="field-label">Slug (auto if blank)</label>
          <input name="slug" defaultValue={n?.slug ?? ''} placeholder="leave blank to auto-generate" className="field" />
        </div>
        <div>
          <label className="field-label">Publish date</label>
          <input type="datetime-local" name="published_at" defaultValue={n ? toLocalInput(n.published_at) : ''} className="field" />
        </div>
        <div>
          <label className="field-label">Published?</label>
          <select name="published" defaultValue={String(n?.published ?? true)} className="field">
            <option value="true">Published</option>
            <option value="false">Draft (hidden)</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="field-label">Image URL (optional)</label>
          <input name="image_url" defaultValue={n?.image_url ?? ''} className="field" />
        </div>
      </div>
      <div>
        <label className="field-label">Body *</label>
        <textarea name="body" rows={5} required defaultValue={n?.body ?? ''} className="field" />
      </div>
    </div>
  )
}

export default async function AdminNewsPage() {
  const supabase = await createClient()
  const { data } = await supabase.from('news_posts').select('*').order('published_at', { ascending: false })
  const posts = (data as NewsPost[]) ?? []

  return (
    <div>
      <h1 className="text-xl font-black mb-4">News &amp; Announcements</h1>

      <div className="card p-5 mb-6">
        <h2 className="font-bold text-gray-700 mb-4">Add Post</h2>
        <form action={upsertNews} className="space-y-4">
          <NewsFields />
          <button type="submit" className="btn btn-primary">Add post</button>
        </form>
      </div>

      <div className="space-y-2">
        {posts.map((n) => (
          <details key={n.id} className="card p-4">
            <summary className="flex items-center justify-between cursor-pointer list-none gap-3">
              <span className="font-semibold">
                {n.title}
                <span className="ml-2 text-xs text-gray-400">
                  {new Date(n.published_at).toLocaleDateString()}{!n.published && ' · draft'}
                </span>
              </span>
              <DeleteButton id={n.id} action={deleteNews} />
            </summary>
            <form action={upsertNews} className="mt-4 space-y-4">
              <input type="hidden" name="id" value={n.id} />
              <NewsFields n={n} />
              <button type="submit" className="btn btn-primary">Save changes</button>
            </form>
          </details>
        ))}
      </div>
    </div>
  )
}
