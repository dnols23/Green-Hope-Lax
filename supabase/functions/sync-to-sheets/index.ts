// ─────────────────────────────────────────────────────────────────────────────
// OPTIONAL — Supabase Edge Function: append new form submissions to a Google Sheet
//
// This is the "Preferred: Google Sheets sync" option. It's entirely optional —
// the site already works with the built-in CSV export in /admin/submissions.
//
// How it fires: a Supabase Database Webhook on INSERT into
// interest_form_submissions (and/or contact_submissions) POSTs the new row here,
// and this function appends it to your Google Sheet.
//
// Setup is in the project README → "Option B: Google Sheets sync".
// Requires these Edge Function secrets:
//   GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY, GOOGLE_SHEET_ID
// ─────────────────────────────────────────────────────────────────────────────

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

const SHEET_ID = Deno.env.get('GOOGLE_SHEET_ID')!
const CLIENT_EMAIL = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_EMAIL')!
const PRIVATE_KEY = (Deno.env.get('GOOGLE_PRIVATE_KEY') ?? '').replace(/\\n/g, '\n')

// ── RS256 JWT → Google OAuth access token ───────────────────────────────────────
function b64url(data: Uint8Array | string): string {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function pemToBinary(pem: string): ArrayBuffer {
  const body = pem.replace(/-----BEGIN PRIVATE KEY-----/, '').replace(/-----END PRIVATE KEY-----/, '').replace(/\s/g, '')
  const bin = atob(body)
  const buf = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i)
  return buf.buffer
}

async function getAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claim = b64url(JSON.stringify({
    iss: CLIENT_EMAIL,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }))
  const key = await crypto.subtle.importKey(
    'pkcs8', pemToBinary(PRIVATE_KEY),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'],
  )
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${header}.${claim}`))
  const jwt = `${header}.${claim}.${b64url(new Uint8Array(sig))}`

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  })
  const json = await res.json()
  if (!json.access_token) throw new Error('Google token error: ' + JSON.stringify(json))
  return json.access_token
}

// Maps a webhook payload to a flat row for the sheet. Works for both form tables.
function toRow(table: string, record: Record<string, unknown>): string[] {
  if (table === 'contact_submissions') {
    return [String(record.created_at ?? ''), 'contact', String(record.name ?? ''), String(record.email ?? ''), String(record.message ?? '')]
  }
  return [
    String(record.created_at ?? ''),
    'interest',
    `${record.player_first ?? ''} ${record.player_last ?? ''}`.trim(),
    String(record.program ?? ''),
    String(record.grad_year ?? ''),
    String(record.experience ?? ''),
    String(record.parent_name ?? ''),
    String(record.parent_email ?? ''),
    String(record.parent_phone ?? ''),
    String(record.player_email ?? ''),
    String(record.notes ?? ''),
  ]
}

serve(async (req) => {
  try {
    const payload = await req.json()
    // Supabase DB webhook shape: { type, table, record, ... }
    const table = payload.table ?? 'interest_form_submissions'
    const record = payload.record ?? payload
    const row = toRow(table, record)

    const token = await getAccessToken()
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/A1:append?valueInputOption=USER_ENTERED`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: [row] }),
      },
    )
    if (!res.ok) return new Response(await res.text(), { status: 500 })
    return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
})
