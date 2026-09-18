/**
 * Sending something from the Library on somewhere else.
 *
 * Pure, because the awkward part is the string: a mail app is handed a URL and
 * anything not escaped properly silently truncates the message.
 */

export const SHARE_SUBJECT = 'Green Hope Lacrosse'

/** The address that opens a mail app with the links already in the message. */
export function mailtoFor(links: string[], subject = SHARE_SUBJECT): string {
  const body = links.length ? `${links.join('\n\n')}\n` : ''
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

/** What "n picked" should say. */
export function pickedLabel(n: number): string {
  return n === 1 ? '1 picked' : `${n} picked`
}
