export const shrinkThumbnail = dataUrl =>
  new Promise(resolve => {
    const image = new Image()
    image.onload = () => {
      const maxEdge = 480
      const scale = Math.min(
        1,
        maxEdge / Math.max(image.width, image.height, 1)
      )
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(image.width * scale))
      canvas.height = Math.max(1, Math.round(image.height * scale))
      const context = canvas.getContext('2d')
      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/jpeg', 0.7))
    }
    image.onerror = () => resolve('')
    image.src = dataUrl
  })

export const svgElementToThumbnail = async svg => {
  const clone = svg.cloneNode(true)
  if (!clone.getAttribute('xmlns')) {
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  }
  const viewBox = svg.viewBox && svg.viewBox.baseVal
  const width =
    (viewBox && viewBox.width) || (svg.width && svg.width.baseVal.value) || 800
  const height =
    (viewBox && viewBox.height) ||
    (svg.height && svg.height.baseVal.value) ||
    600
  clone.setAttribute('width', String(Math.max(1, Math.round(width))))
  clone.setAttribute('height', String(Math.max(1, Math.round(height))))
  const xml = new XMLSerializer().serializeToString(clone)
  const url = URL.createObjectURL(
    new Blob([xml], { type: 'image/svg+xml;charset=utf-8' })
  )
  try {
    return await shrinkThumbnail(url)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export const svgMarkupToThumbnail = async markup => {
  const host = document.createElement('div')
  host.innerHTML = markup
  const svg = host.querySelector('svg')
  if (!svg) {
    return ''
  }
  return svgElementToThumbnail(svg)
}

export const mindMapPng = async mindMap => {
  const exporter = mindMap.doExport
  if (!exporter) {
    const png = await mindMap.export('png', false, 'preview')
    return typeof png === 'string' ? png : ''
  }
  const { str, clipData } = await exporter.getSvgData()
  const svgUrl = await exporter.fixSvgStrAndToBlob(str)
  return exporter.svgToPng(svgUrl, false, clipData, false, 'image/png')
}
