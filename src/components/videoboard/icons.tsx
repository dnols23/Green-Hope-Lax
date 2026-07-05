// Inline SVG icons for the video board — crisp at small sizes, inherit
// currentColor so CSS controls their state colors.

import type { ReactNode } from 'react'

type IconProps = { size?: number }

function Svg({ size = 18, children, viewBox = '0 0 24 24' }: IconProps & { children: ReactNode; viewBox?: string }) {
  return (
    <svg width={size} height={size} viewBox={viewBox} fill="none" aria-hidden="true">
      {children}
    </svg>
  )
}

export function IconPlay({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M8 5.5v13l11-6.5-11-6.5Z" fill="currentColor" />
    </Svg>
  )
}

export function IconPause({ size }: IconProps) {
  return (
    <Svg size={size}>
      <rect x="6.5" y="5" width="4" height="14" rx="1" fill="currentColor" />
      <rect x="13.5" y="5" width="4" height="14" rx="1" fill="currentColor" />
    </Svg>
  )
}

/** YouTube-style skip arrow with the seconds count inside. */
export function IconSkip({ size = 20, n, dir }: IconProps & { n: number; dir: -1 | 1 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <g transform={dir === -1 ? 'scale(-1,1) translate(-24,0)' : undefined}>
        <path
          d="M12 3.5a8.5 8.5 0 1 0 8.5 8.5"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <path d="M17.2 1.2 21.5 4l-4.3 2.8V1.2Z" fill="currentColor" />
      </g>
      <text
        x="12"
        y="15.5"
        textAnchor="middle"
        fontSize="8.5"
        fontWeight="700"
        fill="currentColor"
        style={{ fontFamily: 'inherit' }}
      >
        {n}
      </text>
    </svg>
  )
}

/** Single frame step — a bar with a triangle nudging against it. */
export function IconFrame({ size = 16, dir }: IconProps & { dir: -1 | 1 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <g transform={dir === -1 ? 'scale(-1,1) translate(-24,0)' : undefined}>
        <path d="M7 6.5v11l8-5.5-8-5.5Z" fill="currentColor" />
        <rect x="16.5" y="6" width="2.4" height="12" rx="1" fill="currentColor" />
      </g>
    </svg>
  )
}

export function IconVolume({ size, muted = false }: IconProps & { muted?: boolean }) {
  return (
    <Svg size={size}>
      <path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4Z" fill="currentColor" />
      {muted ? (
        <path d="m15.5 9.5 5 5m0-5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      ) : (
        <>
          <path d="M15 9.5a4 4 0 0 1 0 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M17.5 7.5a7 7 0 0 1 0 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </>
      )}
    </Svg>
  )
}

export function IconExpand({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path
        d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

export function IconCompress({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path
        d="M4 9h5V4M20 9h-5V4M4 15h5v5M20 15h-5v5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

export function IconClose({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
  )
}

export function IconUpload({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path
        d="M12 15V4m0 0 4 4m-4-4L8 8"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M4 15.5V18a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </Svg>
  )
}

export function IconFilm({ size }: IconProps) {
  return (
    <Svg size={size}>
      <rect x="3.5" y="5" width="17" height="14" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M7.5 5v14M16.5 5v14M3.5 9h4M3.5 15h4M16.5 9h4M16.5 15h4" stroke="currentColor" strokeWidth="1.4" />
    </Svg>
  )
}

export function IconScissors({ size }: IconProps) {
  return (
    <Svg size={size}>
      <circle cx="6.5" cy="7" r="2.5" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="6.5" cy="17" r="2.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="m8.7 8.5 11.3 8m-11.3-1 11.3-8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </Svg>
  )
}

export function IconTrash({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path
        d="M5 7h14M10 7V5.5A1.5 1.5 0 0 1 11.5 4h1A1.5 1.5 0 0 1 14 5.5V7m4 0-.8 11.2A2 2 0 0 1 15.2 20H8.8a2 2 0 0 1-2-1.8L6 7"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path d="M10 11v5M14 11v5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </Svg>
  )
}

export function IconKeyboard({ size }: IconProps) {
  return (
    <Svg size={size}>
      <rect x="3" y="6.5" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M6.5 10h.01M10 10h.01M13.5 10h.01M17 10h.01M6.5 13h.01M17 13h.01M9 13.5h6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </Svg>
  )
}

/** Layout picker glyphs: 1, 2, 3 columns or a 2×2 grid. */
export function IconLayout({ size = 16, panes }: IconProps & { panes: 1 | 2 | 3 | 4 }) {
  const r = 1.2
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      {panes === 1 && <rect x="4" y="6" width="16" height="12" rx={r} />}
      {panes === 2 && (
        <>
          <rect x="4" y="6" width="7.2" height="12" rx={r} />
          <rect x="12.8" y="6" width="7.2" height="12" rx={r} />
        </>
      )}
      {panes === 3 && (
        <>
          <rect x="3.4" y="6" width="4.9" height="12" rx={r} />
          <rect x="9.55" y="6" width="4.9" height="12" rx={r} />
          <rect x="15.7" y="6" width="4.9" height="12" rx={r} />
        </>
      )}
      {panes === 4 && (
        <>
          <rect x="4" y="4.6" width="7.2" height="6.6" rx={r} />
          <rect x="12.8" y="4.6" width="7.2" height="6.6" rx={r} />
          <rect x="4" y="12.8" width="7.2" height="6.6" rx={r} />
          <rect x="12.8" y="12.8" width="7.2" height="6.6" rx={r} />
        </>
      )}
    </svg>
  )
}
