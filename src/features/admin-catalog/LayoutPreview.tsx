import { useId, useMemo, useState } from 'react'
import { parseSeatId, sanitizeSvg } from '@/seatmap/svg'
import { VenueMapView, type VenueGate } from './VenueMapView'

const semanticId = /^(?:ZONE|LABEL|CONTENT|SEAT|GATE|GATE_LABEL|AREA)__|^BACKGROUND$/

function readLayer(source: string) {
  const safe = sanitizeSvg(source)
  if (!safe) return
  const doc = new DOMParser().parseFromString(safe, 'image/svg+xml')
  const root = doc.documentElement
  const bounds = root
    .getAttribute('viewBox')
    ?.trim()
    .split(/[\s,]+/)
    .map(Number)
  if (!bounds || bounds.length !== 4 || !bounds.every(Number.isFinite) || bounds[2] <= 0 || bounds[3] <= 0) return
  return { doc, root, bounds }
}

export function mergeLayers(overview: string, details: string[], prefix: string) {
  const base = readLayer(overview)
  if (!base) return { svg: '', skipped: 0 }

  const businessIds = new Set<string>()
  let skipped = 0
  for (const [index, source] of [overview, ...details].entries()) {
    const layer = index === 0 ? base : readLayer(source)
    if (!layer || !layer.bounds.every((value, position) => value === base.bounds[position])) {
      skipped++
      continue
    }
    const elements = [layer.root, ...Array.from(layer.root.querySelectorAll('*'))]
    const ids = elements.filter((element) => element.id)
    const business = ids.filter((element) => semanticId.test(element.id))
    if (index > 0 && business.some((element) => businessIds.has(element.id))) {
      skipped++
      continue
    }
    business.forEach((element) => businessIds.add(element.id))

    const names = new Map<string, string>()
    for (const element of ids) {
      if (semanticId.test(element.id)) continue
      const namespaced = `${prefix}-${index}-${element.id}`
      names.set(element.id, namespaced)
      element.id = namespaced
    }
    for (const element of elements) {
      for (const attr of Array.from(element.attributes)) {
        const value = attr.value.replace(/url\(\s*(['"]?)#([^)'"]+)\1\s*\)/g, (match, _quote, id: string) => {
          const renamed = names.get(id.trim())
          return renamed ? `url(#${renamed})` : match
        })
        const target = attr.localName === 'href' && value.startsWith('#') ? names.get(value.slice(1)) : undefined
        attr.value = target ? `#${target}` : value
      }
    }
    if (index === 0) continue

    const group = base.doc.createElementNS('http://www.w3.org/2000/svg', 'g')
    for (const attr of Array.from(layer.root.attributes)) {
      if (
        !['viewBox', 'width', 'height', 'x', 'y', 'preserveAspectRatio', 'xmlns', 'xmlns:xlink'].includes(attr.name)
      ) {
        group.setAttribute(attr.name, attr.value)
      }
    }
    for (const child of Array.from(layer.root.children)) group.appendChild(base.doc.importNode(child, true))
    base.root.appendChild(group)
  }
  return { svg: sanitizeSvg(new XMLSerializer().serializeToString(base.root)) ?? '', skipped }
}

export function LayoutPreview({ overview, details, label }: { overview: string; details: string[]; label: string }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const { svg, skipped } = useMemo(() => mergeLayers(overview, details, `preview-${id}`), [overview, details, id])
  if (!svg) return <p>SVG tổng quan chưa có vùng hiển thị hợp lệ.</p>

  return (
    <>
      <InteractiveLayout key={svg} svg={svg} label={label} />
      {skipped > 0 && <p>Có tệp zone/ghế bị trùng ID hoặc khác viewBox. Hãy kiểm tra sơ đồ để xem lỗi.</p>}
    </>
  )
}

function InteractiveLayout({ svg, label }: { svg: string; label: string }) {
  const [zone, setZone] = useState<string>()
  const [seatId, setSeatId] = useState<string>()
  const [gate, setGate] = useState<VenueGate>()
  const seat = seatId ? parseSeatId(seatId) : null

  return (
    <>
      <div className="venue-layout-preview" role="region" aria-label={`Xem trước layout ${label}`}>
        <VenueMapView
          svg={svg}
          focus={zone}
          selectedSeat={seatId}
          onZoneClick={(code) => {
            setZone(code)
            setSeatId(undefined)
            setGate(undefined)
          }}
          onSeatClick={(id) => {
            setSeatId(id)
            setZone(parseSeatId(id)?.zone)
            setGate(undefined)
          }}
          onGateClick={(selected) => {
            setGate(selected)
            setSeatId(undefined)
          }}
          onOverview={() => {
            setZone(undefined)
            setSeatId(undefined)
            setGate(undefined)
          }}
        />
      </div>
      <p className="venue-svg-hint" role="status">
        {gate
          ? `Cổng ${gate.number}`
          : seat
            ? `Khu ${seat.zone} · Hàng ${seat.row} · Ghế ${seat.number}`
            : zone
              ? `Khu ${zone}`
              : 'Cuộn để zoom, kéo để di chuyển. Bấm khu để xem ghế hoặc bấm cổng để xem mã.'}
      </p>
    </>
  )
}
