// Tiny Resend wrapper. No SDK dependency — just a fetch to the REST API so the
// project stays light. If RESEND_API_KEY is not set, sending is a silent no-op
// (the form still saves to Supabase), so the site works before you wire up email.

// Generic Resend send. No-ops (logs a warning) if RESEND_API_KEY / EMAIL_FROM
// aren't set, so the rest of the app keeps working before email is configured.
export async function sendEmail(args: {
  to?: string | string[]
  bcc?: string[]
  subject: string
  html: string
  replyTo?: string
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM
  if (!apiKey || !from) {
    console.warn('[email] Skipping send — RESEND_API_KEY / EMAIL_FROM not set.')
    return false
  }
  // Resend requires a "to"; for bcc-only blasts we address it to the sender.
  const to = args.to ?? from
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: Array.isArray(to) ? to : [to],
        ...(args.bcc && args.bcc.length ? { bcc: args.bcc } : {}),
        subject: args.subject,
        html: args.html,
        ...(args.replyTo ? { reply_to: args.replyTo } : {}),
      }),
    })
    if (!res.ok) {
      console.error('[email] Resend error:', res.status, await res.text())
      return false
    }
    return true
  } catch (err) {
    console.error('[email] Resend request failed:', err)
    return false
  }
}

export async function sendCoachEmail({
  subject,
  html,
  replyTo,
}: {
  subject: string
  html: string
  replyTo?: string
}): Promise<void> {
  const to = process.env.COACH_NOTIFY_EMAIL
  if (!to) {
    console.warn('[email] COACH_NOTIFY_EMAIL not set — skipping coach notification.')
    return
  }
  await sendEmail({ to: to.split(',').map((s) => s.trim()), subject, html, replyTo })
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export function row(label: string, value: string | null | undefined): string {
  if (!value) return ''
  return `<tr><td style="padding:4px 12px 4px 0;color:#666;font-weight:600;vertical-align:top">${esc(
    label
  )}</td><td style="padding:4px 0">${esc(value)}</td></tr>`
}

// New-post notification email for opted-in team members.
export function postEmailHtml(title: string, body: string): string {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.greenhopelacrosse.com'
  const safeBody = esc(body).replace(/\n/g, '<br>')
  return `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px">
    <div style="background:#00693E;color:#fff;padding:16px 20px;border-radius:8px 8px 0 0">
      <strong style="font-size:14px;letter-spacing:1px">GREEN HOPE FALCONS · TEAM HUB</strong>
    </div>
    <div style="border:1px solid #e5e7eb;border-top:none;padding:20px;border-radius:0 0 8px 8px">
      <h2 style="margin:0 0 10px;font-size:18px;color:#141414">${esc(title)}</h2>
      <p style="font-size:14px;line-height:1.6;color:#374151">${safeBody}</p>
      <p style="margin-top:18px">
        <a href="${site}/team" style="background:#7A1F2B;color:#fff;text-decoration:none;font-weight:700;padding:10px 18px;border-radius:9999px;font-size:14px">Open the Team Hub →</a>
      </p>
      <p style="font-size:11px;color:#9ca3af;margin-top:18px">You're receiving this because you opted in to post updates when you joined the Falcons Team Hub.</p>
    </div>
  </div>`
}

export function emailShell(title: string, rowsHtml: string): string {
  return `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px">
    <div style="background:#00693E;color:#fff;padding:16px 20px;border-radius:8px 8px 0 0">
      <strong style="font-size:16px">${esc(title)}</strong>
    </div>
    <div style="border:1px solid #e5e7eb;border-top:none;padding:20px;border-radius:0 0 8px 8px">
      <table style="border-collapse:collapse;font-size:14px">${rowsHtml}</table>
    </div>
  </div>`
}
