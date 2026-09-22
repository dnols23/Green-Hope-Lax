'use client'
import dynamic from 'next/dynamic'
import { SIZE_PT, type ShapeBlock, type SlideBlock } from '@/lib/playbook'
import type { Board } from '@/lib/planner'

const FieldBoard = dynamic(
  () => import('@/components/planner/FieldBoard').then((m) => m.FieldBoard),
  { ssr: false, loading: () => <div className="w-full h-full rounded-lg bg-gray-50" /> }
)

export interface SlidePlay {
  id: string
  name: string
  board: Board
}

/**
 * What one block looks like, filling whatever box it has been given.
 *
 * Nothing here knows where it is — the stage puts the box down, this draws
 * inside it. Same component in the editor, on the projector and on a phone.
 */
export function BlockArt({
  block,
  plays,
  editing = false,
}: {
  block: SlideBlock
  plays: Record<string, SlidePlay>
  /** In the editor an empty block still shows its outline, so it can be grabbed. */
  editing?: boolean
}) {
  switch (block.kind) {
    case 'play': {
      /* The page's own field wins over a borrowed one: a coach who took a copy
         off the shelf to change it means the copy. */
      const board = block.board ?? plays[block.playId]?.board
      if (!board) {
        return (
          <div className="w-full h-full rounded-lg border-2 border-dashed border-amber-300 bg-amber-50 flex items-center justify-center p-4 text-center"
            style={{ fontSize: 20, color: '#92400e' }}>
            {block.playId ? 'That play is no longer saved.' : 'Pick a play'}
          </div>
        )
      }
      const name = block.board ? '' : (plays[block.playId]?.name ?? '')
      const caption = block.caption ?? name
      return (
        <div className="w-full h-full flex flex-col">
          <div className="flex-1 min-h-0 [&_svg]:!h-full [&>*]:h-full">
            <FieldBoard board={board} readOnly />
          </div>
          {caption && (
            <div style={{ fontSize: 18, color: '#6b7280', marginTop: 4 }}>{caption}</div>
          )}
        </div>
      )
    }

    case 'shot':
      if (!block.url) {
        return (
          <div className="w-full h-full rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center"
            style={{ fontSize: 20, color: '#9ca3af' }}>
            Pick a picture
          </div>
        )
      }
      return (
        <div className="w-full h-full flex flex-col">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={block.url} alt={block.caption ?? ''} className="flex-1 min-h-0 w-full object-contain rounded-lg" />
          {block.caption && <div style={{ fontSize: 18, color: '#6b7280', marginTop: 4 }}>{block.caption}</div>}
        </div>
      )

    case 'text': {
      const pt = block.pt ?? SIZE_PT[block.size]
      if (!block.body.trim() && !editing) return null
      return (
        <div
          className="w-full h-full whitespace-pre-wrap break-words"
          style={{
            fontSize: pt,
            lineHeight: 1.25,
            color: block.color ?? '#111111',
            fontWeight: block.bold || block.size === 'heading' ? 900 : 400,
            fontStyle: block.italic ? 'italic' : undefined,
            textAlign: block.align ?? 'left',
            background: block.fill,
            borderRadius: block.fill ? 10 : undefined,
            padding: block.fill ? 12 : undefined,
          }}
        >
          {block.body || (editing ? 'Type here' : '')}
        </div>
      )
    }

    case 'list': {
      const pt = block.pt ?? SIZE_PT.body
      const items = block.items.filter((i) => i.trim())
      if (items.length === 0 && !block.heading && !editing) return null
      return (
        <div
          className="w-full h-full"
          style={{
            color: block.color ?? '#374151',
            background: block.fill,
            borderRadius: block.fill ? 10 : undefined,
            padding: block.fill ? 12 : undefined,
          }}
        >
          {block.heading && (
            <div style={{ fontSize: pt * 0.62, fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#9ca3af', marginBottom: 6 }}>
              {block.heading}
            </div>
          )}
          <ul style={{ display: 'grid', gap: pt * 0.3 }}>
            {(items.length ? items : editing ? ['One point per line'] : []).map((i, n) => (
              <li key={n} style={{ fontSize: pt, lineHeight: 1.25, display: 'flex', gap: pt * 0.4 }}>
                <span aria-hidden style={{ color: 'var(--gh-green)' }}>•</span>
                <span>{i}</span>
              </li>
            ))}
          </ul>
        </div>
      )
    }

    case 'shape':
      return <ShapeArt block={block} />
  }
}

/**
 * The drawing tools, as SVG that stretches with its box.
 *
 * A circle round a player and an arrow between two of them is most of what a
 * coach draws on top of a diagram, so those are the ones that exist.
 */
function ShapeArt({ block }: { block: ShapeBlock }) {
  const stroke = block.color ?? '#7A1F2B'
  const w = block.width ?? 6
  const id = `head-${block.id}`
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full overflow-visible">
      {block.shape === 'rect' && (
        <rect x={w / 2} y={w / 2} width={100 - w} height={100 - w} rx={4}
          fill={block.filled ? stroke : 'none'} stroke={stroke} strokeWidth={w} vectorEffect="non-scaling-stroke" />
      )}
      {block.shape === 'ellipse' && (
        <ellipse cx={50} cy={50} rx={50 - w / 2} ry={50 - w / 2}
          fill={block.filled ? stroke : 'none'} stroke={stroke} strokeWidth={w} vectorEffect="non-scaling-stroke" />
      )}
      {(block.shape === 'line' || block.shape === 'arrow') && (
        <>
          {block.shape === 'arrow' && (
            <defs>
              <marker id={id} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill={stroke} />
              </marker>
            </defs>
          )}
          <line x1={2} y1={98} x2={98} y2={2} stroke={stroke} strokeWidth={w} strokeLinecap="round"
            vectorEffect="non-scaling-stroke" markerEnd={block.shape === 'arrow' ? `url(#${id})` : undefined} />
        </>
      )}
    </svg>
  )
}
