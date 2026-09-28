// The calendar as a PDF, made in the browser and saved straight to the phone
// or laptop. Two layouts: a list by day, or a page per month.
//
// Times are the coach's own clock, like everything else on the calendar screen.

import type { CalItem } from '@/lib/calendarModel'
import { colorFor } from '@/lib/calendarModel'
import {
  MONTH_NAMES,
  WEEKDAY_NAMES,
  WEEKDAY_SHORT,
  addDays,
  addMonths,
  isAllDayish,
  itemsOnDay,
  sameDay,
  startOfDay,
  startOfMonth,
} from '@/lib/calendarMath'
import { audienceBadge, itemTitle, kindMeta, teamLabel } from './calShared'

type Doc = import('jspdf').jsPDF

const GREEN = '#004D2E'
const INK = '#111827'
const MUTED = '#6b7280'
const RULE = '#e5e7eb'

/* The built-in PDF fonts only carry the Windows-1252 characters. Curly quotes
   and dashes are in it; emoji and the rest are not, and would print as junk. */
const CP1252 = new Set('€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ'.split(''))
function clean(s: string): string {
  return [...s]
    .filter((ch) => {
      const c = ch.codePointAt(0) ?? 0
      return (c >= 0x20 && c <= 0x7e) || (c >= 0xa0 && c <= 0xff) || CP1252.has(ch)
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
}

/** "5p", "5:30p" — the short time the month grid has room for. */
function shortTime(d: Date): string {
  const h = d.getHours()
  const m = d.getMinutes()
  return `${h % 12 || 12}${m ? `:${String(m).padStart(2, '0')}` : ''}${h < 12 ? 'a' : 'p'}`
}

/** "5:00 PM". */
function clock(d: Date): string {
  return `${d.getHours() % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')} ${d.getHours() < 12 ? 'AM' : 'PM'}`
}

const allDay = (it: CalItem) => it.allDay || isAllDayish(it)

function header(doc: Doc, title: string, sub: string, margin: number) {
  const w = doc.internal.pageSize.getWidth()
  doc.setFillColor(GREEN)
  doc.rect(0, 0, w, 6, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(INK)
  doc.text(clean(title), margin, margin + 14)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(MUTED)
  doc.text(clean(sub), margin, margin + 28)
  doc.text('Green Hope Falcons Lacrosse', w - margin, margin + 14, { align: 'right' })
}

// ── List ─────────────────────────────────────────────────────────────────────

function listPages(doc: Doc, items: CalItem[], from: Date, to: Date, sub: string) {
  const M = 40
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const timeW = 92
  header(doc, 'Calendar', sub, M)
  let y = M + 48

  const room = (need: number) => {
    if (y + need <= H - M) return
    doc.addPage()
    header(doc, 'Calendar', sub, M)
    y = M + 48
  }

  let any = false
  for (let day = startOfDay(from); day < to; day = addDays(day, 1)) {
    const today = itemsOnDay(items, day)
    if (!today.length) continue
    any = true
    room(44)
    doc.setFillColor('#f3f4f6')
    doc.rect(M, y, W - 2 * M, 20, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10.5)
    doc.setTextColor(INK)
    doc.text(`${WEEKDAY_NAMES[day.getDay()]}, ${MONTH_NAMES[day.getMonth()]} ${day.getDate()}`, M + 8, y + 14)
    y += 28

    for (const it of today) {
      const title = clean(itemTitle(it))
      const meta = clean(
        [kindMeta(it).label, teamLabel(it.team), it.location ?? '', audienceBadge(it)].filter(Boolean).join('  ·  '),
      )
      const titleLines = doc.setFont('helvetica', 'bold').setFontSize(10.5).splitTextToSize(title, W - 2 * M - timeW - 12)
      const metaLines = doc.setFont('helvetica', 'normal').setFontSize(8.5).splitTextToSize(meta, W - 2 * M - timeW - 12)
      const notes = it.notes ? doc.setFontSize(8.5).splitTextToSize(clean(it.notes), W - 2 * M - timeW - 12).slice(0, 3) : []
      const h = Math.max(30, titleLines.length * 13 + metaLines.length * 11 + notes.length * 11 + 8)
      room(h)
      const c = colorFor(it)
      doc.setFillColor(c.bg)
      doc.rect(M + timeW - 8, y - 1, 3, h - 8, 'F')
      doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(INK)
      doc.text(allDay(it) ? 'All day' : clock(new Date(it.startsAt)), M, y + 9)
      if (!allDay(it)) {
        doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(MUTED)
        doc.text(`to ${clock(new Date(it.endsAt))}`, M, y + 20)
      }
      let ty = y + 9
      doc.setFont('helvetica', 'bold').setFontSize(10.5).setTextColor(INK)
      doc.text(titleLines, M + timeW + 2, ty)
      ty += titleLines.length * 13
      doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(MUTED)
      doc.text(metaLines, M + timeW + 2, ty - 2)
      ty += metaLines.length * 11
      if (notes.length) doc.text(notes, M + timeW + 2, ty - 2)
      y += h
      doc.setDrawColor(RULE)
      doc.line(M + timeW + 2, y - 4, W - M, y - 4)
    }
    y += 6
  }
  if (!any) {
    doc.setFont('helvetica', 'normal').setFontSize(11).setTextColor(MUTED)
    doc.text('Nothing on the calendar in this stretch.', M, y + 12)
  }
}

// ── Month pages ──────────────────────────────────────────────────────────────

function monthPage(doc: Doc, items: CalItem[], month: Date, from: Date, to: Date) {
  const M = 28
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  header(doc, `${MONTH_NAMES[month.getMonth()]} ${month.getFullYear()}`, 'Calendar', M)

  const top = M + 44
  const colW = (W - 2 * M) / 7
  // Weekday row.
  doc.setFont('helvetica', 'bold').setFontSize(8).setTextColor(MUTED)
  WEEKDAY_SHORT.forEach((d, i) => doc.text(d.toUpperCase(), M + i * colW + 4, top + 10))
  const gridTop = top + 16
  const first = addDays(month, -month.getDay())
  const next = startOfMonth(addMonths(month, 1))
  const weeks = Math.ceil((next.getTime() - first.getTime()) / (7 * 86_400_000) - 1e-9)
  const rowH = (H - M - gridTop) / weeks
  const lineH = 9.5

  for (let w = 0; w < weeks; w++) {
    for (let d = 0; d < 7; d++) {
      const day = addDays(first, w * 7 + d)
      const x = M + d * colW
      const y = gridTop + w * rowH
      const inMonth = day.getMonth() === month.getMonth()
      const inRange = day >= startOfDay(from) && day < to
      doc.setDrawColor(RULE)
      if (!inMonth) {
        doc.setFillColor('#f9fafb')
        doc.rect(x, y, colW, rowH, 'FD')
      } else {
        doc.rect(x, y, colW, rowH, 'S')
      }
      doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(inMonth ? INK : '#9ca3af')
      doc.text(String(day.getDate()), x + 4, y + 11)
      if (!inMonth || !inRange) continue

      const list = itemsOnDay(items, day)
      const maxLines = Math.max(0, Math.floor((rowH - 16) / lineH))
      doc.setFont('helvetica', 'normal').setFontSize(7.5)
      // Each item gets up to two lines; whatever doesn't fit becomes "+N more".
      const blocks = list.map((it) => {
        const starts = new Date(it.startsAt)
        const label = clean(`${allDay(it) || !sameDay(starts, day) ? '' : `${shortTime(starts)} `}${itemTitle(it)}`)
        const lines: string[] = doc.splitTextToSize(label, colW - 12)
        if (lines.length <= 2) return { it, lines }
        return { it, lines: [lines[0], `${lines[1].slice(0, -1).trimEnd()}…`] }
      })
      const shown: typeof blocks = []
      let used = 0
      for (const [i, b] of blocks.entries()) {
        const needMore = i < blocks.length - 1 ? 1 : 0
        if (used + b.lines.length + needMore > maxLines) break
        shown.push(b)
        used += b.lines.length
      }
      let ly = y + 16
      for (const { it, lines } of shown) {
        doc.setFillColor(colorFor(it).bg)
        doc.rect(x + 4, ly - 1, 2.5, lines.length * lineH - 2, 'F')
        doc.setTextColor(INK)
        lines.forEach((l, n) => doc.text(l, x + 9, ly + 5.5 + n * lineH))
        ly += lines.length * lineH
      }
      if (list.length > shown.length) {
        doc.setTextColor(MUTED)
        doc.text(`+${list.length - shown.length} more`, x + 9, ly + 5.5)
      }
    }
  }
}

/** Build the PDF and save it. */
export async function savePdf(
  items: CalItem[],
  opts: { from: Date; to: Date; layout: 'month' | 'list'; filename: string; label: string },
) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'pt', format: 'letter', orientation: opts.layout === 'month' ? 'landscape' : 'portrait' })
  if (opts.layout === 'list') {
    listPages(doc, items, opts.from, opts.to, opts.label)
  } else {
    let first = true
    for (let m = startOfMonth(opts.from); m < opts.to; m = startOfMonth(addMonths(m, 1))) {
      if (!first) doc.addPage()
      first = false
      monthPage(doc, items, m, opts.from, opts.to)
    }
  }
  doc.save(opts.filename)
}
