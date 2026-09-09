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

/** Positions we recognise, so a second column can be told apart from a surname. */
const POSITIONS =
  /^(a|att|attack|attackman|m|mid|midfield|midfielder|d|def|defense|defence|defenseman|g|gk|goalie|goalkeeper|lsm|fogo|fo|ssdm|smd|util|utility)$/i

/** A jersey number: digits, optionally with a # in front. */
const NUMBER = /^#?\d{1,2}$|^#?\d{3}$/

/** A graduation year. Checked before the jersey number so 2027 isn't a shirt. */
const YEAR = /^(19|20)\d{2}$/

/**
 * Reads players pasted straight out of a spreadsheet, or a CSV file's contents.
 *
 * Columns are Name, Number, Position, Grad year — but only the name is required,
 * and a single column of names is a perfectly good paste. Tabs (what Google
 * Sheets puts on the clipboard) and commas both work as separators, and a header
 * row is skipped if it looks like one.
 *
 * A first-name/last-name split is common enough to handle on its own: when the
 * second column is neither a number nor a position, it is read as the rest of
 * the name and everything after it shifts across. Without that, "Cayden, Staley,
 * LSM" imported a player called Cayden wearing jersey "Staley".
 */
export function parseRosterPaste(raw: string): ParsedPlayer[] {
  const out: ParsedPlayer[] = []

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed) continue

    const cells = (trimmed.includes('\t') ? trimmed.split('\t') : trimmed.split(','))
      .map((c) => c.trim().replace(/^"(.*)"$/, '$1'))

    let name = cells[0]
    if (!name) continue
    // Skip a header row rather than importing a player called "Name".
    if (/^(name|player|player name|full name|first|first name)$/i.test(name)) continue

    let rest = cells.slice(1).filter(Boolean)
    const second = rest[0]
    // A surname column: not a jersey number, not a position, not a grad year.
    if (second && !NUMBER.test(second) && !YEAR.test(second) && !POSITIONS.test(second)) {
      name = `${name} ${second}`
      rest = rest.slice(1)
    }

    // Take the remaining columns by what they look like rather than by where
    // they sit, so a missing column doesn't shift everything after it.
    let number: string | null = null
    let position: string | null = null
    let classYear: string | null = null
    for (const cell of rest) {
      if (number === null && NUMBER.test(cell)) number = cell.replace(/^#/, '')
      else if (classYear === null && YEAR.test(cell)) classYear = cell
      else if (position === null) position = cell
    }

    out.push({ name, number, position, class_year: classYear })
  }
  return out
}
