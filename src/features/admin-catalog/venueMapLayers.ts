export type VenueMapLayers = { background: boolean; seats: boolean; gates: boolean }

// Giữ nhóm và phép biến đổi SVG để bật/tắt lớp mà không làm lệch vị trí.
export function filterVenueMapLayers(source: string, layers: VenueMapLayers, overview = false) {
  const doc = new DOMParser().parseFromString(source, 'image/svg+xml')
  const root = doc.documentElement
  if (root.localName !== 'svg' || doc.querySelector('parsererror')) return ''
  if (overview && !layers.background) {
    for (const element of root.querySelectorAll('path, rect, circle, ellipse, line, polyline, polygon, text, use')) {
      if (!element.closest('defs, clipPath, mask, pattern, [id^="GATE__"], [id^="GATE_LABEL__"]')) hide(element)
    }
  }
  for (const element of root.querySelectorAll('[id^="SEAT__"], [id^="GATE__"], [id^="GATE_LABEL__"]')) {
    if (element.id.startsWith('SEAT__') ? !layers.seats : !layers.gates) {
      hide(element)
    }
  }
  return new XMLSerializer().serializeToString(root)
}

function hide(element: Element) {
  element.setAttribute('style', `${element.getAttribute('style') ?? ''};display:none!important`)
}
