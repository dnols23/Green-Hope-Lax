// Tiny Resend wrapper. No SDK dependency — just a fetch to the REST API so the
// project stays light. If RESEND_API_KEY is not set, sending is a silent no-op
// (the form still saves to Supabase), so the site works before you wire up email.

interface SendArgs {
  subject: string
  html: string
  replyTo?: string
}

export async function sendCoachEmail({ subject, html, replyTo }: SendArgs): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM
  const to = process.env.COACH_NOTIFY_EMAIL

  if (!apiKey || !from || !to) {
    console.warn('[email] Skipping send — RESEND_API_KEY / EMAIL_FROM / COACH_NOTIFY_EMAIL not all set.')
    return
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: to.split(',').map((s) => s.trim()),
        subject,
        html,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    })
    if (!res.ok) {
      console.error('[email] Resend error:', res.status, await res.text())
    }
  } catch (err) {
    // Never let a mail failure break the user's form submission.
    console.error('[email] Resend request failed:', err)
  }
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export function row(label: string, value: string | null | undefined): string {
  if (!value) return ''
  return `<tr><td style="padding:4px 12px 4px 0;color:#666;font-weight:600;vertical-align:top">${esc(
    label
  )}</td><td style="padding:4px 0">${esc(value)}</td></tr>`
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
