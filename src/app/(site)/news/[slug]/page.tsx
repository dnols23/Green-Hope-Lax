import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getNewsBySlug } from '@/lib/queries'
import { assertPageVisible } from '@/lib/pages'
import { formatDate } from '@/lib/format'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const post = await getNewsBySlug(slug)
  return { title: post?.title ?? 'News' }
}

export default async function NewsPostPage({ params }: { params: Promise<{ slug: string }> }) {
  await assertPageVisible('news')
  const { slug } = await params
  const post = await getNewsBySlug(slug)
  if (!post) notFound()

  return (
    <article className="max-w-2xl mx-auto px-4 py-10">
      <Link href="/news" className="text-sm font-bold" style={{ color: 'var(--gh-green)' }}>← All news</Link>
      <div className="text-xs font-semibold text-gray-500 mt-4">{formatDate(post.published_at, { year: 'numeric' })}</div>
      <h1 className="page-title mt-1">{post.title}</h1>
      {post.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.image_url} alt={post.title} className="w-full rounded-xl mt-6" />
      )}
      <div className="prose-body mt-6">{post.body}</div>
    </article>
  )
}
