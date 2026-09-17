/**
 * A picture of the board, taken in the browser.
 *
 * The field is an SVG, so a screenshot is the SVG itself serialised, painted
 * onto a canvas and handed back as a PNG. Nothing is fetched while it draws —
 * every colour, size and end shape on the board is written as an attribute or
 * an inline style — so the canvas stays clean and the export works offline on a
 * sideline.
 *
 * Browser only.
 */

/** Drawn at three times the field's size in yards, which lands about 1800px wide. */
const SCALE = 15

export async function boardToPng(svg: SVGSVGElement): Promise<Blob> {
  const box = svg.viewBox.baseVal
  const w = Math.round((box?.width || svg.clientWidth || 120) * SCALE)
  const h = Math.round((box?.height || svg.clientHeight || 60) * SCALE)

  const copy = svg.cloneNode(true) as SVGSVGElement
  copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  copy.setAttribute('width', String(w))
  copy.setAttribute('height', String(h))
  // The grass is a CSS background on the live element, and a background is not
  // painted into a canvas — so the picture would come out on glass. Draw it.
  const grass = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
  grass.setAttribute('width', '100%')
  grass.setAttribute('height', '100%')
  grass.setAttribute('fill', svg.style.background || '#4a7f52')
  copy.insertBefore(grass, copy.firstChild)

  const markup = new XMLSerializer().serializeToString(copy)
  const url = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml;charset=utf-8' }))

  try {
    const img = new Image()
    img.decoding = 'sync'
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('The board would not turn into a picture.'))
      img.src = url
    })

    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('This browser will not draw pictures.')
    ctx.drawImage(img, 0, 0, w, h)

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('The picture came out empty.'))),
        'image/png'
      )
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}
