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
