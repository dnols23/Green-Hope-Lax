import Image from 'next/image'

// Official Green Hope Falcons mark. Source art lives at /public/logos/falcon-head.png
// (1327×847, transparent). next/image handles resizing/optimization automatically.
const LOGO = '/logos/falcon-head.png'
const RATIO = 1327 / 847

// Falcon-head mark — header / nav / general use. Sized by height; width follows.
export function FalconHead({ size = 40, className = '' }: { size?: number; className?: string }) {
  return (
    <Image
      src={LOGO}
      alt="Green Hope Falcons"
      width={Math.round(size * RATIO)}
      height={size}
      priority
      className={className}
      style={{ height: size, width: 'auto' }}
    />
  )
}

// Contained badge: the falcon on a white circle so it pops on dark backgrounds
// (hero, footer). `variant` kept for backwards-compat but no longer needed.
export function FalconBadge({
  size = 96,
  className = '',
}: {
  size?: number
  variant?: 'light' | 'dark'
  className?: string
}) {
  const inner = Math.round(size * 0.72)
  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        borderRadius: '9999px',
        background: '#ffffff',
        boxShadow: '0 6px 18px rgba(0,0,0,0.22)',
      }}
    >
      <Image
        src={LOGO}
        alt="Green Hope Falcons Lacrosse"
        width={Math.round(inner * RATIO)}
        height={inner}
        style={{ height: inner, width: 'auto' }}
      />
    </span>
  )
}
