// Reading players out of a spreadsheet paste or a CSV file.
//
// Kept free of server imports so it can be tested on its own and used from
// either side — lib/rosters re-exports it for convenience.

export interface ParsedPlayer {
  name: string
  number: string | null
  position: string | null
  class_year: string | null
}

/**
 * Reads players pasted straight out of a spreadsheet, or a CSV file's contents.
 *
 * Columns are Name, Number, Position, Grad year — but only the name is required,
 * and a single column of names is a perfectly good paste. Tabs (what Google
 * Sheets puts on the clipboard) and commas both work as separators, and a header
 * row is skipped if it looks like one.
 */
export function parseRosterPaste(raw: string): ParsedPlayer[] {
  const out: ParsedPlayer[] = []

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed) continue

    const cells = (trimmed.includes('\t') ? trimmed.split('\t') : trimmed.split(','))
      .map((c) => c.trim().replace(/^"(.*)"$/, '$1'))

    const name = cells[0]
    if (!name) continue
    // Skip a header row rather than importing a player called "Name".
    if (/^(name|player|player name|full name)$/i.test(name)) continue

    out.push({
      name,
      number: cells[1] || null,
      position: cells[2] || null,
      class_year: cells[3] || null,
    })
  }
  return out
}
