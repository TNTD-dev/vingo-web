import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Maximize2, Minus, Plus } from 'lucide-react'
import { boxToViewBox, easeInOut, fitView, lerpBox, panView, parseViewBox, type Box } from '@/seatmap/geometry'
import { parseSeatId, zoneCodeOfPart } from '@/seatmap/svg'
import {
  fitVenueZone,
  resizeVenueView,
  showVenueSeats,
  visibleBox,
  wheelZoomFactor,
  zoomVenueView,
} from './venueMapGeometry'
import { VenueMinimap } from './VenueMinimap'

export type VenueGate = { id: string; zone?: string; number: string }

function parseMapGate(element: Element): VenueGate | undefined {
  const zone = element.closest('[data-map-zone]')?.getAttribute('data-map-zone') ?? undefined
  const legacy = /^GATE(?:_LABEL)?__(.+)__(\d+)$/.exec(element.id)
  if (legacy) return { id: `GATE__${legacy[1]}__${legacy[2]}`, number: legacy[2], zone }

  const gate = /^GATE(?:_LABEL)?__([A-Z0-9][A-Z0-9-]*(?:__\d+)?)(?:__(?:IN|OUT|BOTH))?$/.exec(element.id)
  if (!gate) return
  return { id: element.id.startsWith('GATE_LABEL__') ? `GATE__${gate[1]}` : element.id, number: gate[1], zone }
}
type Props = {
  svg: string
  minimap?: boolean
  focus?: string
  selectedSeat?: string
  selectedZones?: ReadonlySet<string>
  zoneColors?: Record<string, { fill: string; stroke: string }>
  onZoneClick: (code: string) => void
  onSeatClick: (id: string) => void
  onGateClick: (gate: VenueGate) => void
  onOverview: () => void
}
type ZoneGeometry = {
  box: Box
  seats: SVGGraphicsElement[]
  seatLayers: SVGGElement[]
  seatSize: number
  visible: boolean
  surface: SVGGraphicsElement
  label?: SVGGraphicsElement
}

/** Bộ xem cấu hình: giữ màu, nhãn và cổng từ SVG. Không có thao tác đặt/khóa ghế. */
export function VenueMapView({
  svg,
  minimap = false,
  focus,
  selectedSeat,
  selectedZones,
  zoneColors,
  onZoneClick,
  onSeatClick,
  onGateClick,
  onOverview,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const rootRef = useRef<SVGSVGElement | null>(null)
  const boundsRef = useRef<Box | null>(null)
  const overviewRef = useRef<Box | null>(null)
  const viewRef = useRef<Box | null>(null)
  const zonesRef = useRef(new Map<string, ZoneGeometry>())
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [revision, setRevision] = useState(0)
  const [zoom, setZoom] = useState(100)
  const [detailMode, setDetailMode] = useState(false)
  const [minimapView, setMinimapView] = useState<{ bounds: Box; view: Box } | null>(null)
  const drag = useRef<{ x: number; y: number; view: Box } | null>(null)
  const suppressClick = useRef(false)
  const frame = useRef(0)
  const animRef = useRef(0)
  const wheelTargetRef = useRef<Box | null>(null)
  const wheelAnimatingRef = useRef(false)
  const focusedRef = useRef(focus)
  const prevFocusRef = useRef(focus)
  const skipFlyZoneRef = useRef<string | null>(null)
  const sizeRef = useRef(size)
  const callbacks = useRef({ onOverview, onZoneClick, onSeatClick, onGateClick })
  useLayoutEffect(() => {
    focusedRef.current = focus
    sizeRef.current = size
    callbacks.current = { onOverview, onZoneClick, onSeatClick, onGateClick }
  })

  const stopFly = useCallback(() => {
    if (animRef.current > 0) cancelAnimationFrame(animRef.current)
    animRef.current = 0
    wheelTargetRef.current = null
    wheelAnimatingRef.current = false
  }, [])

  const renderView = useCallback(() => {
    if (frame.current > 0) {
      cancelAnimationFrame(frame.current)
      frame.current = 0
    }
    const root = rootRef.current,
      view = viewRef.current,
      overview = overviewRef.current,
      viewport = sizeRef.current
    if (!root || !view || !overview || viewport.width <= 0 || viewport.height <= 0) return
    // Dùng kích thước từ ResizeObserver, tránh ép browser layout lại SVG sau mỗi lần đổi viewBox.
    root.setAttribute('viewBox', boxToViewBox(view))
    const pixelsPerUnit = Math.min(viewport.width / view.w, viewport.height / view.h)
    let any = false
    for (const [code, zone] of zonesRef.current) {
      const show =
        visibleBox(view, zone.box) &&
        (focusedRef.current === code || showVenueSeats(zone.visible, zone.seatSize * pixelsPerUnit))
      if (show !== zone.visible) {
        zone.seatLayers.forEach((layer) => layer.toggleAttribute('data-map-hidden', !show))
        zone.surface.toggleAttribute('data-map-detail', show)
        zone.label?.toggleAttribute('data-map-detail', show)
        zone.visible = show
      }
      any ||= show && zone.seats.length > 0
    }
    setZoom(Math.round((overview.w / view.w) * 100))
    setDetailMode(any)
    if (minimap) setMinimapView({ bounds: boundsRef.current ?? overview, view: { ...view } })
  }, [minimap])

  const flyTo = useCallback(
    (target: Box, duration = 260) => {
      stopFly()
      const from = viewRef.current
      const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
      if (
        !from ||
        reduce ||
        (Math.abs(from.x - target.x) < 0.5 &&
          Math.abs(from.y - target.y) < 0.5 &&
          Math.abs(from.w - target.w) < 0.5 &&
          Math.abs(from.h - target.h) < 0.5)
      ) {
        viewRef.current = target
        renderView()
        return
      }
      const start = performance.now()
      const tick = (now: number) => {
        animRef.current = 0
        const elapsed = now > start ? now - start : duration
        const t = Math.min(1, elapsed / duration)
        viewRef.current = lerpBox(from, target, easeInOut(t))
        renderView()
        if (t < 1) {
          animRef.current = -1
          const id = requestAnimationFrame(tick)
          if (animRef.current === -1) animRef.current = id
        } else {
          wheelTargetRef.current = null
        }
      }
      animRef.current = -1
      const id = requestAnimationFrame(tick)
      if (animRef.current === -1) animRef.current = id
    },
    [renderView, stopFly],
  )

  // Một vòng rAF cho cả lượt cuộn; các nấc mới chỉ cập nhật đích, không khởi động lại easing.
  const glideWheelTo = useCallback(
    (target: Box) => {
      if (wheelAnimatingRef.current) {
        wheelTargetRef.current = target
        return
      }
      stopFly()
      if (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) {
        viewRef.current = target
        renderView()
        return
      }
      wheelTargetRef.current = target
      wheelAnimatingRef.current = true
      let previousTime = performance.now()
      const tick = (now: number) => {
        animRef.current = 0
        const current = viewRef.current,
          destination = wheelTargetRef.current
        if (!current || !destination) {
          wheelAnimatingRef.current = false
          return
        }
        const elapsed = now > previousTime ? Math.min(64, now - previousTime) : Number.POSITIVE_INFINITY
        previousTime = now
        const next = lerpBox(current, destination, 1 - Math.exp(-elapsed / 45))
        const settled =
          Math.abs(next.w - destination.w) < destination.w * 0.0004 &&
          Math.abs(next.x - destination.x) < destination.w * 0.0004 &&
          Math.abs(next.y - destination.y) < destination.h * 0.0004
        viewRef.current = settled ? destination : next
        renderView()
        if (settled) {
          wheelTargetRef.current = null
          wheelAnimatingRef.current = false
        } else {
          animRef.current = -1
          const id = requestAnimationFrame(tick)
          if (animRef.current === -1) animRef.current = id
        }
      }
      animRef.current = -1
      const id = requestAnimationFrame(tick)
      if (animRef.current === -1) animRef.current = id
    },
    [renderView, stopFly],
  )

  const schedule = useCallback(() => {
    if (frame.current) return
    frame.current = -1
    const id = requestAnimationFrame(() => {
      frame.current = 0
      renderView()
    })
    if (frame.current === -1) frame.current = id
  }, [renderView])

  useLayoutEffect(() => {
    const host = hostRef.current
    if (!host) return
    host.innerHTML = svg
    const root = host.querySelector('svg')
    rootRef.current = root
    zonesRef.current.clear()
    if (!root) return
    root.removeAttribute('width')
    root.removeAttribute('height')
    root.setAttribute('preserveAspectRatio', 'xMidYMid meet')
    // Đo hình học thật, không lấy kích thước trắng BACKGROUND làm bounds sân.
    const background = root.querySelector<SVGElement>('[id="BACKGROUND"]')
    const originalDisplay = background?.style.display ?? ''
    if (background) background.style.display = 'none'
    let bounds = parseViewBox(root.getAttribute('viewBox'))
    try {
      const b = root.getBBox()
      if (b.width > 0 && b.height > 0) bounds = { x: b.x, y: b.y, w: b.width, h: b.height }
    } catch {
      /* SVG chưa đo được: dùng viewBox nguồn. */
    }
    if (background) background.style.display = originalDisplay
    boundsRef.current = bounds
    // Chuẩn hóa bbox qua ma trận, giữ đúng các nhóm có transform trong SVG Figma.
    function boxOf(el: SVGGraphicsElement): Box | null {
      try {
        const b = el.getBBox(),
          base = root!.getScreenCTM(),
          local = el.getScreenCTM()
        if (!base || !local || b.width <= 0 || b.height <= 0) return null
        const matrix = base.inverse().multiply(local)
        const points = [
          [b.x, b.y],
          [b.x + b.width, b.y],
          [b.x, b.y + b.height],
          [b.x + b.width, b.y + b.height],
        ].map(([x, y]) => new DOMPoint(x, y).matrixTransform(matrix))
        const xs = points.map((p) => p.x),
          ys = points.map((p) => p.y)
        return {
          x: Math.min(...xs),
          y: Math.min(...ys),
          w: Math.max(...xs) - Math.min(...xs),
          h: Math.max(...ys) - Math.min(...ys),
        }
      } catch {
        return null
      }
    }
    const labels = new Map<string, SVGGraphicsElement>()
    for (const el of Array.from(root.querySelectorAll<SVGGraphicsElement>('[id]'))) {
      const code = zoneCodeOfPart(el.id)
      if (code) {
        el.setAttribute('data-map-zone', code)
        if (el.id.startsWith('ZONE__')) {
          const b = boxOf(el) ?? bounds
          if (b)
            zonesRef.current.set(code, {
              box: b,
              seats: [],
              seatLayers: [],
              seatSize: 0,
              visible: false,
              surface: el,
              label: labels.get(code),
            })
        } else if (el.id.startsWith('LABEL__')) {
          labels.set(code, el)
          const existing = zonesRef.current.get(code)
          if (existing) existing.label = el
        }
      }
    }
    for (const el of Array.from(root.querySelectorAll<SVGGraphicsElement>('[id^="SEAT__"]'))) {
      el.setAttribute('data-map-seat', '')
      const seat = parseSeatId(el.id),
        zone = seat && zonesRef.current.get(seat.zone)
      if (!zone) continue
      // Ghế không có fill/stroke trong file vẫn cần thấy được khi xem cấu hình.
      if (!el.getAttribute('fill') || el.getAttribute('fill') === 'none') {
        const paint = getComputedStyle(el)
        if (paint.fill === 'none' && paint.stroke === 'none') el.setAttribute('data-map-seat-fallback', '')
      }
      if (!zone.seatSize) {
        const b = boxOf(el)
        zone.seatSize = b ? Math.min(b.w, b.h) : 2
      }
      zone.seats.push(el)
    }
    // Chỉ gom các ghế liền nhau, giữ nguyên thứ tự vẽ, transform và cổng trong CONTENT.
    // Khi zoom, đổi visibility một nhóm thay vì sửa thuộc tính trên hàng trăm ghế của từng khu.
    for (const [code, zone] of zonesRef.current) {
      for (const seat of zone.seats) {
        const parent = seat.parentElement
        if (!parent) continue
        const previous = seat.previousElementSibling
        let layer: SVGGElement
        if (previous?.getAttribute('data-map-seat-layer') === code) {
          layer = previous as SVGGElement
        } else {
          layer = root.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'g')
          layer.setAttribute('data-map-seat-layer', code)
          parent.insertBefore(layer, seat)
          zone.seatLayers.push(layer)
        }
        layer.appendChild(seat)
      }
      zone.seatLayers.forEach((layer) => layer.setAttribute('data-map-hidden', ''))
    }
    for (const el of Array.from(root.querySelectorAll<SVGGraphicsElement>('[id^="GATE__"], [id^="GATE_LABEL__"]'))) {
      if (parseMapGate(el)) el.setAttribute('data-map-gate', '')
    }
    viewRef.current = null
    overviewRef.current = null
    setRevision((v) => v + 1)
    return () => {
      stopFly()
      if (frame.current > 0) cancelAnimationFrame(frame.current)
      frame.current = 0
      rootRef.current = null
      host.replaceChildren()
    }
  }, [svg, stopFly])

  useEffect(() => {
    const host = frameRef.current
    if (!host) return
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      if (width <= 0 || height <= 0) return
      setSize((previous) => (previous.width === width && previous.height === height ? previous : { width, height }))
    })
    observer.observe(host)
    return () => observer.disconnect()
  }, [])

  useLayoutEffect(() => {
    const bounds = boundsRef.current
    if (!bounds || size.width <= 0 || size.height <= 0) return
    const aspect = size.width / size.height
    const overview = fitView(bounds, aspect, 0.04)
    const previousOverview = overviewRef.current
    overviewRef.current = overview
    if (!viewRef.current) {
      const f = focusedRef.current
      const zone = f && zonesRef.current.get(f)
      viewRef.current = zone ? fitVenueZone(zone.box, overview, aspect) : overview
      prevFocusRef.current = f
    } else {
      stopFly()
      viewRef.current = resizeVenueView(viewRef.current, previousOverview ?? overview, overview)
    }
    renderView()
  }, [size, revision, renderView, stopFly])

  useLayoutEffect(() => {
    const overview = overviewRef.current
    if (!overview || size.width <= 0 || size.height <= 0) return
    if (prevFocusRef.current === focus) return
    prevFocusRef.current = focus
    const skip = skipFlyZoneRef.current === focus
    skipFlyZoneRef.current = null
    if (skip) {
      renderView()
      return
    }
    const zone = focus && zonesRef.current.get(focus)
    flyTo(zone ? fitVenueZone(zone.box, overview, size.width / size.height) : overview)
  }, [focus, size, revision, flyTo, renderView])

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return
    for (const [code, z] of zonesRef.current) {
      const color = zoneColors?.[code]
      if (color) {
        z.surface.style.setProperty('--zone-custom-fill', color.fill)
        z.surface.setAttribute('data-map-colored', '')
      } else {
        z.surface.style.removeProperty('--zone-custom-fill')
        z.surface.removeAttribute('data-map-colored')
      }
      z.surface.toggleAttribute('data-map-active', code === focus)
      z.surface.toggleAttribute('data-map-picked', !!selectedZones?.has(code))
    }
    for (const el of Array.from(root.querySelectorAll('[data-map-selected]'))) el.removeAttribute('data-map-selected')
    if (selectedSeat) {
      const esc =
        typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
          ? CSS.escape(selectedSeat)
          : selectedSeat.replace(/["\\]/g, '\\$&')
      root.querySelector(`[id="${esc}"]`)?.setAttribute('data-map-selected', '')
    }
  }, [focus, selectedSeat, selectedZones, zoneColors, revision])

  const changeZoom = useCallback(
    (factor: number, point?: { x: number; y: number }, smooth = false) => {
      skipFlyZoneRef.current = null
      const current = viewRef.current,
        overview = overviewRef.current
      if (!current || !overview) return
      // Cộng các nấc đang lăn vào đích để không mất thao tác khi animation chưa kết thúc.
      const view = smooth ? (wheelTargetRef.current ?? current) : current
      const anchor = point
        ? {
            x: view.x + ((point.x - current.x) / current.w) * view.w,
            y: view.y + ((point.y - current.y) / current.h) * view.h,
          }
        : { x: view.x + view.w / 2, y: view.y + view.h / 2 }
      const next = zoomVenueView(view, factor, anchor, overview)
      // Thu nhỏ về tổng quan phải rời focus, nếu không khu đó vẫn hiện ghế.
      if (overview.w / next.w < 1.5 && focusedRef.current) {
        focusedRef.current = undefined
        prevFocusRef.current = undefined
        callbacks.current.onOverview()
      }
      if (smooth) {
        glideWheelTo(next)
      } else {
        stopFly()
        viewRef.current = next
        schedule()
      }
    },
    [glideWheelTo, schedule, stopFly],
  )

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const wheel = (e: WheelEvent) => {
      const current = viewRef.current
      const viewport = sizeRef.current
      if (!current || viewport.width <= 0 || viewport.height <= 0) return
      e.preventDefault()
      const rect = host.getBoundingClientRect()
      const point = {
        x: current.x + ((e.clientX - rect.left) / viewport.width) * current.w,
        y: current.y + ((e.clientY - rect.top) / viewport.height) * current.h,
      }
      changeZoom(wheelZoomFactor(e.deltaY, e.deltaMode, viewport.height), point, true)
    }
    host.addEventListener('wheel', wheel, { passive: false })
    return () => host.removeEventListener('wheel', wheel)
  }, [changeZoom])

  function fit() {
    focusedRef.current = undefined
    prevFocusRef.current = undefined
    skipFlyZoneRef.current = null
    callbacks.current.onOverview()
    if (overviewRef.current) flyTo(overviewRef.current)
  }
  return (
    <div ref={frameRef} className="venue-map-frame">
      <div className="venue-map-mode" aria-live="polite">
        {detailMode ? 'Chi tiết ghế' : 'Tổng quan khu'}
      </div>
      {/* Vùng bản đồ có điều khiển bàn phím riêng và bảng khu tương đương ở bên cạnh. */}
      {/* oxlint-disable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */}
      <div
        ref={hostRef}
        className="venue-source-map"
        role="application"
        tabIndex={0}
        aria-label="Sơ đồ cấu hình sân. Lăn chuột hoặc phím cộng trừ để zoom, phím mũi tên để di chuyển, phím 0 về toàn cảnh."
        onKeyDown={(e) => {
          const view = viewRef.current,
            overview = overviewRef.current
          if (!view || !overview) return
          if (['+', '=', '-', '0', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key))
            e.preventDefault()
          if (e.key === '0') fit()
          else if (e.key === '+' || e.key === '=') changeZoom(1.5)
          else if (e.key === '-') changeZoom(1 / 1.5)
          else if (e.key.startsWith('Arrow')) {
            stopFly()
            const d = view.w * 0.12
            viewRef.current = panView(
              view,
              e.key === 'ArrowLeft' ? -d : e.key === 'ArrowRight' ? d : 0,
              e.key === 'ArrowUp' ? -d : e.key === 'ArrowDown' ? d : 0,
              overview,
            )
            schedule()
          }
        }}
        onPointerDown={(e) => {
          if (e.button !== 0 || !viewRef.current) return
          stopFly()
          suppressClick.current = false
          drag.current = { x: e.clientX, y: e.clientY, view: { ...viewRef.current } }
          // Capture ở SVG để click vào phần tử con vẫn giữ target gốc khi chưa kéo.
        }}
        onPointerMove={(e) => {
          const d = drag.current,
            root = rootRef.current,
            overview = overviewRef.current
          if (!d || !root || !overview) return
          if (!(e.buttons & 1)) {
            drag.current = null
            return
          }
          const dx = e.clientX - d.x,
            dy = e.clientY - d.y
          if (Math.hypot(dx, dy) < 5 && !suppressClick.current) return
          suppressClick.current = true
          e.currentTarget.setPointerCapture(e.pointerId)
          const scale = Math.min(sizeRef.current.width / d.view.w, sizeRef.current.height / d.view.h)
          viewRef.current = panView(d.view, -dx / scale, -dy / scale, overview)
          schedule()
        }}
        onPointerUp={(e) => {
          drag.current = null
          if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
        }}
        onPointerCancel={() => {
          drag.current = null
          suppressClick.current = true
        }}
        onPointerLeave={() => {
          if (!suppressClick.current) drag.current = null
        }}
        onClick={(e) => {
          if (suppressClick.current) {
            suppressClick.current = false
            return
          }
          const target = e.target as Element
          const gate = target.closest('[data-map-gate]')
          if (gate) {
            const selected = parseMapGate(gate)
            if (selected) callbacks.current.onGateClick(selected)
            return
          }
          const seat = target.closest('[data-map-seat]')
          if (seat && !seat.closest('[data-map-hidden]')) {
            const seatZone = parseSeatId(seat.id)?.zone
            skipFlyZoneRef.current = seatZone && seatZone !== focusedRef.current ? seatZone : null
            callbacks.current.onSeatClick(seat.id)
            return
          }
          const code = target.closest('[data-map-zone]')?.getAttribute('data-map-zone')
          if (code) {
            const z = zonesRef.current.get(code)
            const cur = viewRef.current
            const ov = overviewRef.current
            const sz = sizeRef.current
            const alreadyZoomed =
              !!z?.visible &&
              !!cur &&
              !!ov &&
              sz.width > 0 &&
              sz.height > 0 &&
              cur.w <= fitVenueZone(z.box, ov, sz.width / sz.height).w * 1.05
            skipFlyZoneRef.current = alreadyZoomed ? code : null
            callbacks.current.onZoneClick(code)
          }
        }}
      />
      {/* oxlint-enable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */}
      {minimap && minimapView && (
        <VenueMinimap
          svg={svg}
          bounds={minimapView.bounds}
          view={minimapView.view}
          onFit={fit}
          onNavigate={(point) => {
            const view = viewRef.current,
              overview = overviewRef.current
            if (!view || !overview) return
            stopFly()
            viewRef.current = panView({ ...view, x: point.x - view.w / 2, y: point.y - view.h / 2 }, 0, 0, overview)
            schedule()
          }}
        />
      )}
      <div className="venue-map-controls">
        <button type="button" onClick={fit} aria-label="Về toàn cảnh">
          <Maximize2 size={16} />
        </button>
        <button type="button" onClick={() => changeZoom(1 / 1.5)} aria-label="Thu nhỏ">
          <Minus size={16} />
        </button>
        <output aria-label="Mức zoom">{zoom}%</output>
        <button type="button" onClick={() => changeZoom(1.5)} aria-label="Phóng to">
          <Plus size={16} />
        </button>
      </div>
    </div>
  )
}
