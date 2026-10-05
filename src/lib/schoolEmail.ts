// A player's school email, not a personal one.
//
// Pure, so the forms and the server agree. Green Hope players all have a WCPSS
// student address (jdsmith@wcpss.net, or @students.wcpss.net). Players from
// other schools — the Green Machine, a Firebirds event — still have a school
// address, just not that one; what is never accepted is a personal inbox.

/** Any WCPSS address, students' subdomain included. */
export const isWcpssEmail = (email: string) => /@([a-z0-9-]+\.)*wcpss\.net$/i.test(email.trim())

/** The browser's own check for the Green Hope form. */
export const WCPSS_PATTERN = '[^@\\s]+@([A-Za-z0-9\\-]+\\.)*[Ww][Cc][Pp][Ss][Ss]\\.[Nn][Ee][Tt]'

const PERSONAL = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'ymail.com', 'hotmail.com', 'outlook.com', 'live.com',
  'msn.com', 'icloud.com', 'me.com', 'mac.com', 'aol.com', 'proton.me', 'protonmail.com', 'gmx.com',
  'mail.com', 'zoho.com', 'yandex.com', 'att.net', 'comcast.net', 'verizon.net', 'spectrum.net',
])

/** A personal inbox — gmail, iCloud, Yahoo and the like. */
export const isPersonalEmail = (email: string) => PERSONAL.has(email.trim().toLowerCase().split('@')[1] ?? '')

export const SCHOOL_EMAIL_HINT = 'Their WCPSS student email, e.g. jdsmith@wcpss.net'
export const WCPSS_EMAIL_ERROR = 'Please enter the player’s WCPSS school email (it ends in @wcpss.net), not a personal one.'
export const PERSONAL_EMAIL_ERROR = 'Please use the player’s school email, not a personal one like Gmail — or leave it blank.'
