/*
 * The board's toolbar pictures. Drawn here rather than pulled from an icon
 * package: forty small strokes are not worth a dependency, and these match the
 * board's own shapes (the cone is the board's cone, the goal its goal).
 */

const PATHS = {
  select: 'M5 3l13 7.5-5.5 1.5 3.5 6-2.5 1.5-3.5-6L6 17z',
  players: 'M12 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5',
  cone: 'M12 3l6.5 15h-13zM3.5 20.5h17',
  lines: 'M4 20L19 5M19 5h-7M19 5v7',
  line: 'M4 20L20 4',
  arrow: 'M4 20L19 5M19 5h-7M19 5v7',
  arrow2: 'M5 19L19 5M19 5h-6M19 5v6M5 19h6M5 19v-6',
  poly: 'M3 18l5-11 6 8 7-10',
  curve: 'M3 19C6 5 12 5 13 12s6 7 8-7',
  scribble: 'M3 15c3-9 5-9 5-4s-1 8 3 3 4-9 6-5-1 7 4 3',
  shapes: 'M3 3h9v9H3zM17 12.5a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9z',
  rect: 'M3.5 5.5h17v13h-17z',
  roundrect: 'M7 5.5h10a3.5 3.5 0 0 1 3.5 3.5v6a3.5 3.5 0 0 1-3.5 3.5H7A3.5 3.5 0 0 1 3.5 15V9A3.5 3.5 0 0 1 7 5.5z',
  ellipse: 'M12 4.5a8 7.5 0 1 1 0 15 8 7.5 0 0 1 0-15z',
  triangle: 'M12 4l9 16H3z',
  diamond: 'M12 3l9 9-9 9-9-9z',
  polygon: 'M12 3l8.5 6.2-3.2 10H6.7l-3.2-10z',
  text: 'M5 6V4h14v2M12 4v16M9 20h6',
  undo: 'M9 14L4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11',
  redo: 'M15 14l5-5-5-5M20 9H9.5a5.5 5.5 0 0 0 0 11H13',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  full: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  unfull: 'M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  cut: 'M6 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8.1 7.9L20 20M8.1 16.1L20 4',
  paste: 'M9 4h6v3H9zM7 5.5H5V21h14V5.5h-2',
  duplicate: 'M8 8h12v12H8zM4 16V4h12M14 11v6M11 14h6',
  front: 'M8 8h12v12H8zM4 4h10v3M4 4v10h3',
  back: 'M4 4h12v12H4zM20 8v12H8',
  group: 'M3 3h6v6H3zM15 15h6v6h-6zM3 15h3M3 15v6h6v-3M15 3h6v6h-3',
  lock: 'M6 11h12v10H6zM8.5 11V7.5a3.5 3.5 0 0 1 7 0V11',
  unlock: 'M6 11h12v10H6zM8.5 11V7.5a3.5 3.5 0 0 1 6.8-1.2',
  alignL: 'M4 3v18M8 7h12M8 12h7M8 17h10',
  alignC: 'M12 3v18M5 7h14M8 12h8M6 17h12',
  alignR: 'M20 3v18M4 7h12M9 12h7M6 17h10',
  alignT: 'M3 4h18M7 8v12M12 8v7M17 8v10',
  alignM: 'M3 12h18M7 5v14M12 8v8M17 6v12',
  alignB: 'M3 20h18M7 4v12M12 9v7M17 6v10',
  distH: 'M4 3v18M20 3v18M9 8h6v8H9z',
  distV: 'M3 4h18M3 20h18M8 9h8v6H8z',
  grid: 'M3 3h18v18H3zM9 3v18M15 3v18M3 9h18M3 15h18',
  magnet: 'M5 4v7a7 7 0 0 0 14 0V4h-4v7a3 3 0 0 1-6 0V4zM5 8h4M15 8h4',
  camera: 'M4 8h3l2-3h6l2 3h3v11H4zM12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z',
  zoomIn: 'M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM15.5 15.5L21 21M10.5 7.5v6M7.5 10.5h6',
  zoomOut: 'M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM15.5 15.5L21 21M7.5 10.5h6',
  close: 'M6 6l12 12M18 6L6 18',
  check: 'M5 12.5l4.5 4.5L19 7',
  turn: 'M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7',
  half: 'M3 5h18v14H3zM12 5v14',
  eraser: 'M16 3l5 5-11 11H5l-2-2 11-11zM9 8l7 7',
  goal: 'M15 5v14M15 5L5 12l10 7',
  ball: 'M12 5a7 7 0 1 1 0 14 7 7 0 0 1 0-14z',
  ladder: 'M3 8h18v8H3zM7 8v8M11 8v8M15 8v8M19 8v8',
  select_all: 'M4 4h4M16 4h4v4M20 16v4h-4M8 20H4v-4M4 8v8M20 8v8M8 4h8M8 20h8M8 8h8v8H8z',
  stamp: 'M12 3v10M8 13h8l2 4H6zM5 21h14',
  pen: 'M4 20l1-5L16 4l4 4L9 19zM13.5 6.5l4 4',
  bucket: 'M5 11l7-7 7 7-7 7zM5 11h14M20 15s1.5 2 1.5 3a1.5 1.5 0 0 1-3 0c0-1 1.5-3 1.5-3z',
  weight: 'M4 6h16M4 12h16M4 18h16',
  layers: 'M12 3l9 5-9 5-9-5zM3 12.5l9 5 9-5M3 17l9 5 9-5',
  help: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17.5h.01',
}

export type IconName = keyof typeof PATHS

export function Icon({ name, size = 18, className = '' }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`shrink-0 ${className}`}
    >
      <path d={PATHS[name]} />
    </svg>
  )
}
