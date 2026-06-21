// ─────────────────────────────────────────────────────────────────────────────
// PLACEHOLDER LOGOS (inline SVG).
// These are stand-ins so the site looks complete before the official art is in.
// To use the real logos, see README → "Adding your real logos":
//   drop falcon-head.png / badge-light.png / badge-dark.png into /public/logos
//   and switch these components to <Image src=... /> (snippet in the README).
// ─────────────────────────────────────────────────────────────────────────────

// Stylized falcon-head mark — header / nav / general use.
export function FalconHead({ size = 40, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      role="img"
      aria-label="Green Hope Falcons"
    >
      <circle cx="50" cy="50" r="48" fill="#00693E" />
      <circle cx="50" cy="50" r="48" fill="none" stroke="#7A1F2B" strokeWidth="3" />
      {/* falcon head profile, facing right */}
      <path
        d="M26 30 C 40 24, 60 26, 72 38 C 78 44, 80 52, 74 56 L 82 58 L 72 62
           C 70 70, 62 76, 52 76 C 54 70, 53 66, 49 64 C 40 70, 30 68, 26 60
           C 33 60, 37 57, 38 52 C 30 52, 25 47, 26 40 C 33 44, 39 43, 42 39
           C 36 37, 31 34, 26 30 Z"
        fill="#ffffff"
      />
      {/* eye */}
      <circle cx="52" cy="42" r="3.4" fill="#141414" />
      {/* beak accent */}
      <path d="M74 56 L 82 58 L 74 60 Z" fill="#7A1F2B" />
    </svg>
  )
}

// Circular "LACROSSE" badge. variant 'light' = sits on dark backgrounds,
// 'dark' = sits on light backgrounds. Footer / loading / social.
export function FalconBadge({
  size = 96,
  variant = 'light',
  className = '',
}: {
  size?: number
  variant?: 'light' | 'dark'
  className?: string
}) {
  const ring = variant === 'light' ? '#ffffff' : '#00693E'
  const bg = variant === 'light' ? 'transparent' : '#ffffff'
  const text = variant === 'light' ? '#ffffff' : '#00693E'
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      className={className}
      role="img"
      aria-label="Green Hope Falcons Lacrosse"
    >
      <circle cx="60" cy="60" r="58" fill={bg} stroke={ring} strokeWidth="3" />
      <circle cx="60" cy="60" r="46" fill="none" stroke="#7A1F2B" strokeWidth="2" />
      <g transform="translate(35,28) scale(0.5)">
        <path
          d="M26 30 C 40 24, 60 26, 72 38 C 78 44, 80 52, 74 56 L 82 58 L 72 62
             C 70 70, 62 76, 52 76 C 54 70, 53 66, 49 64 C 40 70, 30 68, 26 60
             C 33 60, 37 57, 38 52 C 30 52, 25 47, 26 40 C 33 44, 39 43, 42 39
             C 36 37, 31 34, 26 30 Z"
          fill={text}
        />
      </g>
      <text
        x="60"
        y="98"
        textAnchor="middle"
        fontSize="13"
        fontWeight="800"
        letterSpacing="2"
        fill={text}
        fontFamily="system-ui, sans-serif"
      >
        LACROSSE
      </text>
    </svg>
  )
}
