/**
 * The editor's little pictures, drawn rather than emoji so they look the same
 * on every phone and in both themes — they are all currentColor.
 */

const PATHS: Record<string, string> = {
  grip: 'M9 6h.01M9 12h.01M9 18h.01M15 6h.01M15 12h.01M15 18h.01',
  plus: 'M12 5v14M5 12h14',
  todo: 'M4 5h6v6H4zM5.5 8l1.3 1.3L9 7M13 8h7M4 14h6v6H4zM13 17h7',
  bullet: 'M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01',
  number: 'M10 6h10M10 12h10M10 18h10M4 5l1.5-1v5M3.5 14.5c.5-1 2.5-1 2.5.3 0 1-2.5 2-2.5 3.2h2.5',
  toggle: 'M5 5l5 4-5 4zM13 9h7M8 17h12',
  quote: 'M5 5v14M9 8h10M9 12h10M9 16h6',
  callout: 'M4 5h16v11H9l-4 3v-3H4zM12 8v3M12 13.5h.01',
  divider: 'M3 12h18M7 7h10M7 17h10',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  image: 'M4 5h16v14H4zM4 16l5-5 4 4 2-2 5 5M15.5 9h.01',
  table: 'M4 5h16v14H4zM4 10h16M4 15h16M10 5v14',
  field: 'M3 6h18v12H3zM12 6v12M3 10h3v4H3M21 10h-3v4h3M12 11.5v1',
  chart: 'M5 19V11M10 19V6M15 19v-9M20 19V4M3 19h18',
  trash: 'M5 7h14M10 11v6M14 11v6M6 7l1 12h10l1-12M9 7V4h6v3',
  copy: 'M8 8h11v11H8zM5 16V5h11',
  up: 'M12 19V5M6 11l6-6 6 6',
  down: 'M12 5v14M6 13l6 6 6-6',
  indent: 'M4 6h16M10 10h10M10 14h10M4 18h16M4 9l3 3-3 3',
  outdent: 'M4 6h16M10 10h10M10 14h10M4 18h16M7 9l-3 3 3 3',
  details: 'M5 4h14v16H5zM8 8h8M8 12h8M8 16h5',
  color: 'M6 19L11 5h2l5 14M8 14h8',
  turn: 'M4 8h13l-3-3M20 16H7l3 3',
  undo: 'M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3',
  redo: 'M15 14l5-5-5-5M20 9H10a6 6 0 0 0 0 12h3',
  below: 'M12 4v10M7 9l5 5 5-5M5 20h14',
  hide: 'M4 8h16v8H4zM7 11h.01M10 11h.01M13 11h.01M16 11h.01M8 13.5h8M9 19l3 2 3-2',
  back: 'M15 6l-6 6 6 6',
  chevron: 'M9 6l6 6-6 6',
  open: 'M14 4h6v6M20 4l-9 9M18 14v6H4V6h6',
  upload: 'M12 16V4M7 9l5-5 5 5M4 20h16',
  edit: 'M4 20h4L19 9l-4-4L4 16zM13 7l4 4',
  video: 'M4 6h12v12H4zM16 10l4-2v8l-4-2',
  bold: 'M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z',
  italic: 'M10 5h8M6 19h8M14 5l-4 14',
  underline: 'M7 4v7a5 5 0 0 0 10 0V4M5 20h14',
  strike: 'M4 12h16M16 7a4 3 0 0 0-8 0c0 4 8 2 8 6a4 3 0 0 1-8 0',
  code: 'M9 7l-5 5 5 5M15 7l5 5-5 5',
  x: 'M6 6l12 12M18 6L6 18',
}

export function NoteIcon({ name, size = 18, className = '' }: { name: string; size?: number; className?: string }) {
  const bold = name === 'grip'
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={bold ? 3.2 : 1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={`shrink-0 ${className}`}
    >
      <path d={PATHS[name] ?? PATHS.plus} />
    </svg>
  )
}
