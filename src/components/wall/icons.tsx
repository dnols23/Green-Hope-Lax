// The player's controls, drawn rather than borrowed from an emoji font, so a
// shuffle button looks like a shuffle button on every phone.

type P = { className?: string }

const base = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const

export const IconShuffle = ({ className = 'w-5 h-5' }: P) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden {...base}>
    <path d="M16 3h5v5" />
    <path d="M4 20 21 3" />
    <path d="M21 16v5h-5" />
    <path d="m15 15 6 6" />
    <path d="M4 4l5 5" />
  </svg>
)

export const IconRepeat = ({ className = 'w-5 h-5' }: P) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden {...base}>
    <path d="m17 2 4 4-4 4" />
    <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
    <path d="m7 22-4-4 4-4" />
    <path d="M21 13v1a4 4 0 0 1-4 4H3" />
  </svg>
)

export const IconPrev = ({ className = 'w-5 h-5' }: P) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
    <path d="M6 5a1 1 0 0 1 1 1v12a1 1 0 1 1-2 0V6a1 1 0 0 1 1-1Zm13.1.2a1 1 0 0 1 .4.8v12a1 1 0 0 1-1.5.9l-9-6a1 1 0 0 1 0-1.7l9-6a1 1 0 0 1 1.1 0Z" />
  </svg>
)

export const IconNext = ({ className = 'w-5 h-5' }: P) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
    <path d="M18 5a1 1 0 0 1 1 1v12a1 1 0 1 1-2 0V6a1 1 0 0 1 1-1ZM4.9 5.2a1 1 0 0 1 1.1-.1l9 6a1 1 0 0 1 0 1.7l-9 6A1 1 0 0 1 4.5 18V6a1 1 0 0 1 .4-.8Z" />
  </svg>
)

export const IconPlay = ({ className = 'w-5 h-5' }: P) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
    <path d="M7 4.5a1 1 0 0 1 1.5-.9l12 7.5a1 1 0 0 1 0 1.8l-12 7.5A1 1 0 0 1 7 19.5v-15Z" />
  </svg>
)

export const IconPause = ({ className = 'w-5 h-5' }: P) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
    <rect x="5.5" y="4" width="4.5" height="16" rx="1.2" />
    <rect x="14" y="4" width="4.5" height="16" rx="1.2" />
  </svg>
)

export const IconHeart = ({ className = 'w-5 h-5', filled = false }: P & { filled?: boolean }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden {...base} fill={filled ? 'currentColor' : 'none'}>
    <path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7Z" />
  </svg>
)

export const IconPlus = ({ className = 'w-5 h-5' }: P) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden {...base}>
    <path d="M12 5v14M5 12h14" />
  </svg>
)

export const IconAddToList = ({ className = 'w-5 h-5' }: P) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden {...base}>
    <path d="M3 6h12M3 12h12M3 18h7" />
    <path d="M18 14v7M14.5 17.5h7" />
  </svg>
)

export const IconExpand = ({ className = 'w-5 h-5' }: P) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden {...base}>
    <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
  </svg>
)

export const IconClose = ({ className = 'w-5 h-5' }: P) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden {...base}>
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
)

export const IconQuote = ({ className = 'w-5 h-5' }: P) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
    <path d="M9.6 5C6.2 6.4 4 9.3 4 13v6h6v-6H7c0-2.3 1.3-4.1 3.4-5L9.6 5Zm10 0C16.2 6.4 14 9.3 14 13v6h6v-6h-3c0-2.3 1.3-4.1 3.4-5L19.6 5Z" />
  </svg>
)

export const IconGrip = ({ className = 'w-4 h-4' }: P) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
    <circle cx="9" cy="6" r="1.6" /><circle cx="15" cy="6" r="1.6" />
    <circle cx="9" cy="12" r="1.6" /><circle cx="15" cy="12" r="1.6" />
    <circle cx="9" cy="18" r="1.6" /><circle cx="15" cy="18" r="1.6" />
  </svg>
)
