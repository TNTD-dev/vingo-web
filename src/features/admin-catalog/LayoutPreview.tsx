import { memo, useId, useMemo, useState } from 'react'
import { parseSeatId, sanitizeSvg } from '@/seatmap/svg'
import { VenueMapView, type VenueGate } from './VenueMapView'

const semanticId = /^(?:ZONE|LABEL|CONTENT|SEAT|GATE|GATE_LABEL|AREA)__|^BACKGROUND$/

type MergeIssue = {
  detailIndex: number
  message: string
  previewSvg?: string
}

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
  const issues: MergeIssue[] = []
  const base = readLayer(overview)
  if (!base) return { svg: '', skipped: 0, issues }

  const businessIds = new Set<string>()
  let skipped = 0
  for (const [index, source] of [overview, ...details].entries()) {
    const layer = index === 0 ? base : readLayer(source)
    if (!layer) {
      skipped++
      issues.push({ detailIndex: index - 1, message: 'SVG không có viewBox hợp lệ hoặc không đọc được nội dung.' })
      continue
    }
    if (!layer.bounds.every((value, position) => value === base.bounds[position])) {
      skipped++
      issues.push({
        detailIndex: index - 1,
        message: `viewBox của file là "${layer.bounds.join(' ')}", khác SVG tổng quan "${base.bounds.join(' ')}".`,
        previewSvg: new XMLSerializer().serializeToString(layer.root),
      })
      continue
    }
    const elements = [layer.root, ...Array.from(layer.root.querySelectorAll('*'))]
    const ids = elements.filter((element) => element.id)
    const business = ids.filter((element) => semanticId.test(element.id))
    const duplicateIds = business.filter((element) => businessIds.has(element.id)).map((element) => element.id)
    if (index > 0 && duplicateIds.length) {
      skipped++
      issues.push({
        detailIndex: index - 1,
        message: `Trùng ID với lớp đã ghép: ${duplicateIds.slice(0, 3).join(', ')}${duplicateIds.length > 3 ? '…' : ''}.`,
        previewSvg: new XMLSerializer().serializeToString(layer.root),
      })
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
  return { svg: sanitizeSvg(new XMLSerializer().serializeToString(base.root)) ?? '', skipped, issues }
}

type LayoutPreviewProps = {
  overview: string
  details: string[]
  detailNames?: string[]
  label: string
}

export const LayoutPreview = memo(
  function LayoutPreview({ overview, details, detailNames, label }: LayoutPreviewProps) {
    const id = useId().replace(/[^a-zA-Z0-9_-]/g, '')
    const { svg, skipped, issues } = useMemo(
      () => mergeLayers(overview, details, `preview-${id}`),
      [overview, details, id],
    )
    if (!svg) return <p>SVG tổng quan chưa có vùng hiển thị hợp lệ.</p>

    return (
      <>
        {skipped > 0 && (
          <div className="venue-preview-merge-warning">
            <div role="alert">
              <strong>{skipped} file zone/ghế chưa ghép được vào tổng quan</strong>
              <ul>
                {issues.map((issue) => (
                  <li key={issue.detailIndex}>
                    <strong>{detailNames?.[issue.detailIndex] || `File chi tiết ${issue.detailIndex + 1}`}</strong>:{' '}
                    {issue.message}
                  </li>
                ))}
              </ul>
              <p>
                Xuất các lớp từ cùng một frame, giữ nguyên tọa độ và kích thước. Chỉ sửa con số viewBox chưa đủ để đặt
                đúng vị trí zone/ghế.
              </p>
            </div>
            {issues
              .filter((issue) => issue.previewSvg)
              .map((issue) => (
                <SeparateLayer
                  key={issue.detailIndex}
                  svg={issue.previewSvg!}
                  name={detailNames?.[issue.detailIndex] || `File chi tiết ${issue.detailIndex + 1}`}
                />
              ))}
          </div>
        )}
        <InteractiveLayout key={svg} svg={svg} label={label} />
      </>
    )
  },
  (previous, next) =>
    previous.overview === next.overview &&
    previous.label === next.label &&
    sameLayers(previous.details, next.details) &&
    sameLayers(previous.detailNames, next.detailNames),
)

function sameLayers(previous?: string[], next?: string[]) {
  return (
    previous === next ||
    (!!previous && !!next && previous.length === next.length && previous.every((value, index) => value === next[index]))
  )
}

function SeparateLayer({ svg, name }: { svg: string; name: string }) {
  const [open, setOpen] = useState(false)
  return (
    <details className="venue-preview-separate" onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>Xem riêng {name}</summary>
      {open && (
        <div>
          <p>File chi tiết riêng · Chưa ghép vào SVG tổng quan. Bấm khu hoặc phóng to để xem ghế.</p>
          <LayoutPreview overview={svg} details={[]} label={name} />
        </div>
      )}
    </details>
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
          minimap
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
              : 'Cuộn để zoom, kéo để di chuyển. Dùng bản đồ nhỏ để định vị; bấm khu để xem ghế hoặc bấm cổng để xem mã.'}
      </p>
    </>
  )
}
