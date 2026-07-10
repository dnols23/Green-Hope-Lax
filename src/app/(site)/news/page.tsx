import type { Metadata } from 'next'
import Link from 'next/link'
import { getNews } from '@/lib/queries'
import { assertPageVisible } from '@/lib/pages'
import { formatDate } from '@/lib/format'

export const metadata: Metadata = {
  title: 'News & Announcements',
  description: 'The latest news, announcements, and updates from Green Hope Falcons lacrosse.',
}

export default async function NewsPage() {
  await assertPageVisible('news')
  const news = await getNews()
  return (
    <div className="max-w-screen-xl mx-auto px-4 py-10">
      <div className="section-label">Stay in the loop</div>
      <h1 className="page-title mb-6">News &amp; Announcements</h1>

      {news.length === 0 ? (
        <p className="text-gray-500">No announcements yet.</p>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {news.map((post) => (
            <Link key={post.id} href={`/news/${post.slug}`} className="card overflow-hidden hover:shadow-md transition-shadow">
              {post.image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={post.image_url} alt={post.title} className="w-full h-40 object-cover" />
              )}
              <div className="p-5">
                <div className="text-xs font-semibold text-gray-500">{formatDate(post.published_at, { year: 'numeric' })}</div>
                <h2 className="font-bold text-lg mt-1 leading-snug">{post.title}</h2>
                <p className="text-sm text-gray-500 mt-2 line-clamp-3">{post.body}</p>
                <span className="inline-block mt-3 text-sm font-bold" style={{ color: 'var(--gh-maroon)' }}>Read more →</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
