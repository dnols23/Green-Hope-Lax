'use client'

import { useRef, useState } from 'react'
import { shrinkImage as shrink } from '@/lib/uploadImage'

/**
 * Pick a photo from the phone — no links, no file manager, no hosting account.
 *
 * The photo is shrunk in the browser first. A phone camera shoots 4000 pixels
 * wide and four megabytes, the site never shows more than about 1600, and the
 * upload has a size ceiling it would otherwise hit — so the resize is what
 * makes "pick the photo you just took" work at all.
 *
 * The value it produces is an ordinary URL in a hidden field, so the form and
 * the server action behind it never had to change.
 */

/**
 * Why a pasted link will not work, when we can tell before the browser tries.
 *
 * A search-results page is the one people actually paste: right-clicking a
 * picture in Google Images copies the page it sits on, not the picture. That
 * link can never render, and saying so beats a broken grey square.
 */
function linkProblem(value: string): string {
  if (!value) return ''
  if (/^https?:\/\/(www\.)?google\.[a-z.]+\/(imgres|search|url)/i.test(value)) {
    return 'That is a Google Images page, not the photo itself. Upload the file instead.'
  }
  if (/^https?:\/\/(www\.)?(bing|duckduckgo|pinterest)\./i.test(value)) {
    return 'That is a search result, not the photo itself. Upload the file instead.'
  }
  if (!/^https?:\/\//i.test(value)) return 'A link has to start with https://'
  return ''
}

export function ImageField({
  name,
  defaultValue,
  folder = 'uploads',
  label = 'Photo',
}: {
  name: string
  defaultValue?: string | null
  folder?: string
  label?: string
}) {
  const [url, setUrl] = useState(defaultValue ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [showLink, setShowLink] = useState(false)
  const [broken, setBroken] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    setBroken(false)
    setBusy(true)
    try {
      const blob = await shrink(file)
      // The resized blob carries its own type, and that type is what names the
      // file — send it as image/jpeg called photo.png and the server is right
      // to refuse it.
      const type = blob.type || file.type
      const body = new FormData()
      body.append('file', new File([blob], `photo.${type.split('/')[1] ?? 'jpg'}`, { type }))
      body.append('folder', folder)
      const res = await fetch('/api/upload', { method: 'POST', body })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'The upload did not go through.')
      setUrl(json.url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The upload did not go through.')
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  return (
    <div>
      <label className="field-label">{label}</label>
      <input type="hidden" name={name} value={url} />

      <div className="flex items-start gap-3">
        {url && !broken && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt=""
            onError={() => setBroken(true)}
            onLoad={() => setBroken(false)}
            className="w-24 h-24 rounded-lg object-cover border border-gray-200 shrink-0"
          />
        )}
        {url && broken && (
          <div className="w-24 h-24 rounded-lg border border-dashed border-[var(--gh-maroon)] shrink-0 flex items-center justify-center text-center text-[0.65rem] font-bold px-1 text-[var(--gh-maroon)]">
            WON&rsquo;T LOAD
          </div>
        )}
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => input.current?.click()}
              disabled={busy}
              className="btn btn-ghost"
            >
              {busy ? 'Uploading…' : url ? 'Replace photo' : 'Choose a photo'}
            </button>
            {url && !busy && (
              <button
                type="button"
                onClick={() => { setUrl(''); setError(''); setBroken(false) }}
                className="text-sm font-semibold text-[var(--gh-maroon)]"
              >
                Remove
              </button>
            )}
          </div>
          <input
            ref={input}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={onPick}
            className="hidden"
          />
          {error && <p className="text-sm text-[var(--gh-maroon)]">{error}</p>}
          {!error && url && (linkProblem(url) || broken) && (
            <p className="text-sm text-[var(--gh-maroon)]">
              {linkProblem(url) ||
                'That link does not load as a photo — it may be a page rather than an image file, or private. Upload the file instead.'}
            </p>
          )}
          {!url && !error && (
            <p className="text-xs text-gray-400">
              Straight from your phone or computer — it gets resized for you.
            </p>
          )}

          {showLink ? (
            <input
              value={url}
              onChange={(e) => { setUrl(e.target.value); setBroken(false) }}
              placeholder="https://…"
              className="field"
            />
          ) : (
            <button
              type="button"
              onClick={() => setShowLink(true)}
              className="text-xs text-gray-400 underline"
            >
              or paste a link
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
