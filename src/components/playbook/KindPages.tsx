'use client'
import dynamic from 'next/dynamic'
import { firstOf, type PlaybookPage } from '@/lib/playbook'
import type { Board } from '@/lib/planner'
import type { SlidePlay } from './BlockArt'

/* Browser-only and heavy; see SlideView. */
const FieldBoard = dynamic(
  () => import('@/components/planner/FieldBoard').then((m) => m.FieldBoard),
  { ssr: false, loading: () => <div className="w-full h-full" style={{ background: GRASS }} /> }
)

const GRASS = '#4a7f52'

/**
 * The three kinds of page, drawn.
 *
 * Each is a 16:9 page and fills it edge to edge, and everything inside is sized
 * against the page's own width (cqw) rather than the screen — so a page reads
 * the same as a thumbnail on the deck, on a phone and on the projector.
 */

/** The field a page shows: its own, or the saved play it borrows. */
export function pageBoard(page: PlaybookPage, plays: Record<string, SlidePlay>): { board: Board | null; name: string } {
  const block = firstOf(page.blocks, 'play')
  if (!block) return { board: null, name: '' }
  const play = block.playId ? plays[block.playId] : undefined
  return { board: block.board ?? play?.board ?? null, name: play?.name ?? '' }
}

function Frame({ children, background }: { children: React.ReactNode; background: string }) {
  return (
    <div
      className="relative w-full overflow-hidden rounded-lg"
      style={{ aspectRatio: '16 / 9', background, containerType: 'inline-size' }}
    >
      {children}
    </div>
  )
}

/** The page's title, sat on the page — over the grass or a photo — without covering much of it. */
function TitleTag({ title }: { title: string }) {
  if (!title.trim()) return null
  return (
    <div
      className="absolute top-[2.5cqw] left-[2.5cqw] max-w-[70%] truncate rounded-[1.2cqw] font-black text-white pointer-events-none"
      style={{ fontSize: '2.6cqw', padding: '0.7cqw 1.6cqw', background: 'rgba(0,0,0,0.45)', lineHeight: 1.2 }}
    >
      {title}
    </div>
  )
}

export function FieldPageView({
  page,
  plays,
  zoomable = true,
}: {
  page: PlaybookPage
  plays: Record<string, SlidePlay>
  /** Off in the editor, where a tap on the page opens the field for drawing instead. */
  zoomable?: boolean
}) {
  const { board } = pageBoard(page, plays)
  return (
    <Frame background={GRASS}>
      {board ? (
        <div className="absolute inset-0">
          <FieldBoard board={board} readOnly fill zoomable={zoomable} title={page.title} />
        </div>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-white/80 font-bold text-center px-[6cqw]" style={{ fontSize: '2.4cqw' }}>
          That play is no longer saved. Open the page and draw it again, or pick another.
        </div>
      )}
      <TitleTag title={page.title} />
    </Frame>
  )
}

export function WordsPageView({ page }: { page: PlaybookPage }) {
  const text = firstOf(page.blocks, 'text')
  const list = firstOf(page.blocks, 'list')
  const body = text?.body.trim() ?? ''
  const items = list?.items.filter((i) => i.trim()) ?? []
  const onlyTitle = !body && items.length === 0
  return (
    <Frame background="#ffffff">
      <div
        className={`absolute inset-0 flex flex-col ${onlyTitle ? 'items-center justify-center text-center' : 'justify-center'} text-[#141414]`}
        style={{ padding: '6cqw 7cqw' }}
      >
        <div style={{ width: '8cqw', height: '0.7cqw', background: '#00693E', marginBottom: '2cqw', borderRadius: 999 }} aria-hidden />
        <h2 className="font-black tracking-tight" style={{ fontSize: onlyTitle ? '6.5cqw' : '4.6cqw', lineHeight: 1.05 }}>
          {page.title || 'Untitled'}
        </h2>
        {body && (
          <p className="whitespace-pre-wrap text-[#374151]" style={{ fontSize: '2.5cqw', lineHeight: 1.4, marginTop: '2cqw' }}>
            {body}
          </p>
        )}
        {items.length > 0 && (
          <ul style={{ marginTop: '1.6cqw', fontSize: '2.4cqw', lineHeight: 1.4 }} className="text-[#374151]">
            {items.map((item, i) => (
              <li key={i} className="flex" style={{ gap: '1cqw' }}>
                <span aria-hidden style={{ color: '#00693E' }}>•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Frame>
  )
}

export function PicturePageView({ page }: { page: PlaybookPage }) {
  const shot = firstOf(page.blocks, 'shot')
  return (
    <Frame background="#0e1116">
      {shot?.url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={shot.url} alt={shot.caption || page.title || 'Picture'} className="absolute inset-0 w-full h-full object-contain" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-white/60 font-bold" style={{ fontSize: '2.6cqw' }}>
          No picture yet
        </div>
      )}
      <TitleTag title={page.title} />
      {shot?.caption && (
        <div
          className="absolute inset-x-0 bottom-0 text-white font-semibold"
          style={{ fontSize: '2.2cqw', padding: '1.4cqw 2.5cqw', background: 'linear-gradient(transparent, rgba(0,0,0,0.65))' }}
        >
          {shot.caption}
        </div>
      )}
    </Frame>
  )
}
