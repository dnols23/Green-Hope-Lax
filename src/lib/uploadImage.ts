/**
 * Getting a picture off the clipboard and into the team's own storage.
 *
 * Browser only. A coach who has just right-clicked a screenshot and hit "copy
 * image" expects to be able to paste it where it belongs, and every drawing
 * tool they have used works that way.
 */

/** The image on the clipboard, if there is one. Text pastes come back null. */
export function imageFromClipboard(data: DataTransfer | null): File | null {
  if (!data) return null
  for (const file of Array.from(data.files)) {
    if (file.type.startsWith('image/')) return file
  }
  // Safari puts a pasted picture in items rather than files.
  for (const item of Array.from(data.items ?? [])) {
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      const file = item.getAsFile()
      if (file) return file
    }
  }
  return null
}

/** Put it in the bucket and hand back its address. */
export async function uploadImage(
  file: Blob,
  folder: string,
  name = 'pasted.png'
): Promise<{ url?: string; error?: string }> {
  try {
    const data = new FormData()
    data.set('file', file instanceof File ? file : new File([file], name, { type: file.type || 'image/png' }))
    data.set('folder', folder)
    const res = await fetch('/api/upload', { method: 'POST', body: data })
    const body = (await res.json()) as { url?: string; error?: string }
    if (!res.ok || !body.url) return { error: body.error ?? 'That picture would not save.' }
    return { url: body.url }
  } catch {
    return { error: 'That picture would not save.' }
  }
}

const MAX_EDGE = 1600
const QUALITY = 0.85

/**
 * A phone photo, made small enough to send.
 *
 * A phone camera shoots 4000 pixels wide and four megabytes; nothing on the
 * site shows more than about 1600, and the upload has a size ceiling it would
 * otherwise hit — so the resize is what makes "pick the photo you just took"
 * work at all.
 */
export async function shrinkImage(file: File): Promise<Blob> {
  // A GIF is usually animated and a canvas would flatten it to one frame.
  if (file.type === 'image/gif') return file

  // A format the browser cannot decode is sent as it came; the server is the
  // one that decides what it will accept.
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    return file
  }
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
  const w = Math.round(bitmap.width * scale)
  const h = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return file
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close()

  // PNG keeps transparency — a logo on a transparent background would come back
  // with a black box behind it as a JPEG.
  const type = file.type === 'image/png' ? 'image/png' : 'image/jpeg'
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, type, QUALITY))
  return blob ?? file
}

/**
 * A Google Drive share link, turned into the picture itself.
 *
 * "Copy link" in Drive gives the page the file sits on, not the image, so it
 * can't be shown as it is. Drive serves the picture from its thumbnail address
 * for a file shared as "anyone with the link". Anything that isn't a Drive
 * link comes back unchanged.
 */
export function driveImageUrl(link: string): string {
  const s = link.trim()
  if (!/drive\.google\.com|docs\.google\.com/i.test(s)) return s
  const id = s.match(/\/d\/([A-Za-z0-9_-]{10,})/)?.[1] ?? s.match(/[?&]id=([A-Za-z0-9_-]{10,})/)?.[1]
  return id ? `https://drive.google.com/thumbnail?id=${id}&sz=w2000` : s
}
