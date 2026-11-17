import { useMemo, useState } from 'react'
import { sanitizeSvg } from '@/seatmap/svg'

/** Chỉ nhận SVG đã qua server; lọc thêm trước khi gắn DOM. */
export function ImportMap({ overview, detail }: { overview?: string | null; detail?: string | null }) {
  const [layers, setLayers] = useState({ overview: true, zones: true, seats: true, gates: true })
  const svg = useMemo(() => {
    const parser = new DOMParser()
    const base = parser.parseFromString(
      sanitizeSvg(overview ?? '') || '<svg xmlns="http://www.w3.org/2000/svg"/>',
      'image/svg+xml',
    )
    const root = base.documentElement
    const extra = detail && sanitizeSvg(detail)
    if (!layers.overview)
      for (const el of Array.from(root.children))
        if (el.tagName !== 'defs' && !el.id.startsWith('GATE__')) el.setAttribute('visibility', 'hidden')
    if (extra) {
      const doc = parser.parseFromString(extra, 'image/svg+xml')
      if (!overview) root.setAttribute('viewBox', doc.documentElement.getAttribute('viewBox') ?? '0 0 100 100')
      for (const el of Array.from(doc.documentElement.children)) root.appendChild(base.importNode(el, true))
    }
    for (const el of Array.from(root.querySelectorAll('[id]'))) {
      const layer = el.id.startsWith('SEAT__')
        ? 'seats'
        : el.id.startsWith('GATE__') || el.id.startsWith('GATE_LABEL__')
          ? 'gates'
          : el.id.startsWith('ZONE__') || el.id.startsWith('LABEL__')
            ? 'zones'
            : undefined
      if (layer) el.setAttribute('visibility', layers[layer] ? 'visible' : 'hidden')
    }
    return sanitizeSvg(new XMLSerializer().serializeToString(root)) ?? ''
  }, [overview, detail, layers])
  return (
    <div className="venue-import-preview">
      <div className="venue-inline-actions" aria-label="Lớp sơ đồ">
        {Object.entries({ overview: 'Nền', zones: 'Zone', seats: 'Ghế', gates: 'Cổng' }).map(([key, label]) => (
          <label key={key}>
            <input
              type="checkbox"
              checked={layers[key as keyof typeof layers]}
              onChange={(e) => setLayers({ ...layers, [key]: e.target.checked })}
            />{' '}
            {label}
          </label>
        ))}
      </div>
      <div
        role="img"
        aria-label="Xem trước sơ đồ nhiều lớp"
        className="venue-import-map"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </div>
  )
}
