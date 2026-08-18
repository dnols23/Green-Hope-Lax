// Reversible storage for the Team Hub shared code.
//
// The code is one join code a coach hands to every family, so unlike a personal
// credential it has to be readable again — a coach needs to paste it into a join
// email. It is still never written to the database in the clear: it is encrypted
// with AES-GCM under a key derived from SUPABASE_SERVICE_ROLE_KEY, which lives in
// the server environment and never in the database. A database dump on its own
// therefore reveals nothing.
//
// Sign-in still checks the SHA-256 hash in teamAuth.ts. This is display only.

const ENC_PREFIX = 'v1:'

async function aesKey(): Promise<CryptoKey> {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'unset'
  const raw = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`team-code:${secret}`))
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
}

function toB64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64')
}

// Copied into a fresh Uint8Array so it is backed by a plain ArrayBuffer, which
// is what the Web Crypto BufferSource type requires.
function fromB64(s: string): Uint8Array<ArrayBuffer> {
  const buf = Buffer.from(s, 'base64')
  const out = new Uint8Array(buf.byteLength)
  out.set(buf)
  return out
}

export async function encryptTeamCode(code: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await aesKey()
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(code)
  )
  return `${ENC_PREFIX}${toB64(iv)}.${toB64(new Uint8Array(ct))}`
}

// Returns null for anything this key can't open — a value written before this
// existed, or one encrypted under a service key that has since been rotated.
export async function decryptTeamCode(stored: string | null | undefined): Promise<string | null> {
  if (!stored || !stored.startsWith(ENC_PREFIX)) return null
  const [ivB64, ctB64] = stored.slice(ENC_PREFIX.length).split('.')
  if (!ivB64 || !ctB64) return null
  try {
    const key = await aesKey()
    const pt = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromB64(ivB64) },
      key,
      fromB64(ctB64)
    )
    return new TextDecoder().decode(pt)
  } catch {
    return null
  }
}
