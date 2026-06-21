'use client'

// Generates and downloads a CSV from data already on the page — no API route,
// works entirely in the browser.
function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return ''
  const headers = Object.keys(rows[0])
  const escape = (v: unknown) => {
    const s = v == null ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = [
    headers.join(','),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(',')),
  ]
  return lines.join('\n')
}

export function ExportCsvButton({
  rows,
  filename,
}: {
  rows: Record<string, unknown>[]
  filename: string
}) {
  function download() {
    const csv = toCsv(rows)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }
  return (
    <button onClick={download} disabled={rows.length === 0} className="btn btn-primary !py-2 !px-4 disabled:opacity-50">
      ⬇ Export CSV ({rows.length})
    </button>
  )
}
