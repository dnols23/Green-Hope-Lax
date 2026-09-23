'use client'
import dynamic from 'next/dynamic'
import { inZOrder, isFree, type PlaybookPage, type SlideBlock } from '@/lib/playbook'
import { BlockArt, type SlidePlay } from './BlockArt'
import { Stage } from './Stage'
import type { Board } from '@/lib/planner'

/* The board is a heavy, browser-only component — it measures itself against the
   screen. Loaded on demand so a deck of twenty pages doesn't ship twenty
   copies of it before the first one is looked at. */
const FieldBoard = dynamic(
  () => import('@/components/planner/FieldBoard').then((m) => m.FieldBoard),
  { ssr: false, loading: () => <div className="aspect-[3/2] rounded-xl bg-gray-50" /> }
)

export type { SlidePlay }
export type { Board }

/**
 * One page of the playbook, as it is read.
 *
 * The same component draws the page in the editor's preview, in the deck's
 * thumbnails, on the projector and on a player's phone — so what the head coach
 * lines up is what everyone else gets, rather than three near-misses.
 */
type SlideProps = {
  page: PlaybookPage
  /** Every play the deck refers to, by id. */
  plays: Record<string, SlidePlay>
  /** 'thumb' shrinks the type for a card in the deck screen. */
  scale?: 'full' | 'thumb'
}

export function SlideView(props: SlideProps) {
  // A page is a page: white, like the slide it will be on the projector, even
  // when the coach reading it has the app in dark mode.
  return (
    <div className="keep-light h-full">
      <SlidePage {...props} />
    </div>
  )
}

function SlidePage({ page, plays, scale = 'full' }: SlideProps) {
  const thumb = scale === 'thumb'

  /* A page placed by hand is drawn on the stage, where every box keeps the
     spot it was put in. Everything else is laid out here, as it always was. */
  if (isFree(page)) {
    return (
      <Stage className="rounded-lg">
        {page.title && (
          <div style={{ position: 'absolute', left: 48, top: 28, right: 48, fontSize: 44, fontWeight: 900, lineHeight: 1.1 }}>
            {page.title}
          </div>
        )}
        {inZOrder(page.blocks).map((b) => (
          <div
            key={b.id}
            style={{ position: 'absolute', left: b.frame!.x, top: b.frame!.y, width: b.frame!.w, height: b.frame!.h }}
          >
            <BlockArt block={b} plays={plays} />
          </div>
        ))}
      </Stage>
    )
  }

  const boards = page.blocks.filter((b) => b.kind === 'play' || b.kind === 'shot')
  const words = page.blocks.filter((b) => b.kind !== 'play' && b.kind !== 'shot')

  // A page with nothing on it is a section divider — its title, big, centred.
  if (page.blocks.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-center px-6 py-10">
        <h2 className={thumb ? 'text-base font-black' : 'text-3xl sm:text-5xl font-black'}>
          {page.title || 'Untitled'}
        </h2>
      </div>
    )
  }

  const side = page.layout === 'split' && boards.length > 0 && words.length > 0

  return (
    <div className="h-full flex flex-col">
      {page.title && (
        <h2 className={thumb ? 'text-xs font-black mb-1 truncate' : 'text-xl sm:text-2xl font-black mb-3'}>
          {page.title}
        </h2>
      )}
      <div className={side ? 'flex-1 grid md:grid-cols-[1.35fr_1fr] gap-4 min-h-0' : 'flex-1 space-y-4 min-h-0'}>
        {boards.length > 0 && (
          <div className="space-y-3 min-w-0">
            {boards.map((b) => (
              <BlockView key={b.id} block={b} plays={plays} thumb={thumb} />
            ))}
          </div>
        )}
        {words.length > 0 && (
          <div className={thumb ? 'space-y-1 min-w-0' : 'space-y-3 min-w-0'}>
            {words.map((b) => (
              <BlockView key={b.id} block={b} plays={plays} thumb={thumb} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function BlockView({
  block,
  plays,
  thumb,
}: {
  block: SlideBlock
  plays: Record<string, SlidePlay>
  thumb: boolean
}) {
  switch (block.kind) {
    case 'play': {
      // The page's own field first, then the one it borrowed from the Library.
      const play = plays[block.playId]
      const board = block.board ?? play?.board
      if (!board) {
        return (
          <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50 px-4 py-6 text-center text-sm text-amber-900">
            That play is no longer in the Library. Pick another, or take this block off.
          </div>
        )
      }
      const caption = block.caption ?? (block.board ? '' : play?.name ?? '')
      return (
        <figure>
          <FieldBoard board={board} readOnly />
          {caption && (
            <figcaption className={thumb ? 'text-[0.6rem] text-gray-400 mt-1' : 'text-xs text-gray-500 mt-1'}>
              {caption}
            </figcaption>
          )}
        </figure>
      )
    }
    case 'shot':
      return (
        <figure>
          {/* A board screenshot, already sized by whoever took it. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={block.url} alt={block.caption ?? 'From the Library'} className="w-full rounded-xl border border-gray-200" />
          {block.caption && (
            <figcaption className={thumb ? 'text-[0.6rem] text-gray-400 mt-1' : 'text-xs text-gray-500 mt-1'}>
              {block.caption}
            </figcaption>
          )}
        </figure>
      )
    case 'text': {
      if (!block.body.trim()) return null
      const cls =
        block.size === 'heading'
          ? thumb ? 'text-[0.7rem] font-black' : 'text-lg font-black'
          : block.size === 'small'
            ? thumb ? 'text-[0.6rem] text-gray-500' : 'text-xs text-gray-500'
            : thumb ? 'text-[0.65rem] text-gray-700' : 'text-base text-gray-700'
      // Line breaks a coach typed are line breaks he meant.
      return <p className={`${cls} whitespace-pre-wrap`}>{block.body}</p>
    }
    // Shapes belong on a hand-placed page; on a laid-out one they get a box of
    // their own rather than disappearing.
    case 'shape':
      return (
        <div style={{ height: thumb ? 48 : 120 }}>
          <BlockArt block={block} plays={plays} />
        </div>
      )

    case 'list': {
      const items = block.items.filter((i) => i.trim())
      if (items.length === 0 && !block.heading) return null
      return (
        <div>
          {block.heading && (
            <div className={thumb ? 'text-[0.55rem] font-black uppercase tracking-wider text-gray-400' : 'section-label mb-1'}>
              {block.heading}
            </div>
          )}
          <ul className={thumb ? 'space-y-0.5' : 'space-y-1.5'}>
            {items.map((i, n) => (
              <li key={n} className={thumb ? 'text-[0.6rem] text-gray-700 flex gap-1' : 'text-base text-gray-700 flex gap-2'}>
                <span aria-hidden style={{ color: 'var(--gh-green)' }}>•</span>
                <span>{i}</span>
              </li>
            ))}
          </ul>
        </div>
      )
    }
  }
}
