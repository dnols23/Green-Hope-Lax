export function fmtTime(t: number | null | undefined): string {
  if (t == null || isNaN(t) || t < 0) return '0:00'
  const h = Math.floor(t / 3600)
  const m = Math.floor((t % 3600) / 60)
  const s = String(Math.floor(t % 60)).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`
}

export function fmtDuration(secs: number): string {
  if (secs < 10) return `${secs.toFixed(1)}s`
  return fmtTime(secs)
}

export function shortName(name: string, max = 24): string {
  return name.length > max ? name.slice(0, max - 1) + '…' : name
}

/** Strip the file extension for display — chips read better without ".mp4". */
export function baseName(name: string): string {
  const i = name.lastIndexOf('.')
  return i > 0 ? name.slice(0, i) : name
}
