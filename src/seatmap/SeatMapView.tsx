import { Maximize2, Minus, Plus } from 'lucide-react'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'

import { cn } from '@/lib/cn'

import './seatmap.css'
import {
  boxToViewBox,
  fitView,
  interpolateZoom,
  panView,
  parseViewBox,
  transformMapCamera,
  zoomAround,
  type Box,
} from './geometry'
import { SeatMapMinimap } from './SeatMapMinimap'
import { parseSeatId, parseZoneId, zoneCodeOfPart } from './svg'

/**
 * Vẽ sơ đồ ghế từ SVG layout admin đã nhập (quy ước SVG v1, xem ./svg.ts).
 * Dùng chung cho: chọn ghế (booking), block SeatMap trong chat, khoá ghế (admin-catalog), xem sơ đồ.
 * Không vẽ sẵn sân bóng: lớp trung tâm (PITCH, STAGE…) chỉ là nền. Xem Figma page 09.
 *
 * SVG phải là chuỗi đã qua `sanitizeSvg`. Component chèn SVG một lần rồi chỉ đổi thuộc tính/lớp trên các
 * phần tử cần đổi (6–7 nghìn ghế, không dựng lại bằng React).
 */

export type SeatState = 'AVAILABLE' | 'HELD' | 'SOLD' | 'BLOCKED'

export type MapZone = {
  /** Hạng giá 1..4 quyết định màu; không có = coi như hết vé. */
  tier?: number
  color?: string
  soldOut: boolean
}

type Props = {
  svg: string
  /** Theo mã khu trong SVG (vd. "A1-T1"). */
  zones: Record<string, MapZone>
  /** Khu đang xem gần (phóng vào). Không có = toàn cảnh. */
  focus?: string
  /** Trạng thái ghế của khu đang xem, theo id ghế trong SVG. */
  seats?: Record<string, SeatState>
  selected: ReadonlySet<string>
  selectedZones?: ReadonlySet<string>
  /** Chỉ sáng các khu thuộc hạng này (số) hoặc khu đứng; null = tất cả. */
  tierFilter?: number | null
  onZoneClick: (code: string) => void
  onSeatClick?: (svgSeatId: string) => void
  /** Bấm vào chỗ trống (không phải khu/ghế): thường dùng để thoát về toàn cảnh. */
  onBackgroundClick?: () => void
  /** Admin có thể chọn ghế BLOCKED để mở khóa; buyer mặc định chỉ chọn AVAILABLE. */
  selectableStatuses?: readonly SeatState[]
  /** Nội dung tooltip khi rê chuột vào khu; trả null để không hiện. */
  tooltip?: (code: string) => ReactNode
  /** Hiện bản đồ thu nhỏ để định vị và di chuyển. */
  minimap?: boolean
  className?: string
}

const tierColor = (tier: number | undefined, soldOut: boolean) =>
  soldOut || !tier ? 'var(--vg-map-sold)' : `var(--vg-tier-${Math.min(tier, 4)})`

export function SeatMapView({
  svg,
  zones,
  focus,
  seats,
  selected,
  selectedZones,
  tierFilter = null,
  onZoneClick,
  onSeatClick,
  onBackgroundClick,
  selectableStatuses = ['AVAILABLE'],
  tooltip,
  minimap = true,
  className,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const cameraRef = useRef<HTMLDivElement | null>(null)
  const baseRef = useRef<Box | null>(null)
  const settleRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const lastMinimapUpdate = useRef(-Infinity)
  const zonePartsRef = useRef(new Map<string, SVGElement[]>())
  const seatGroupsRef = useRef(new Map<string, { layers: SVGGElement[]; seats: SVGElement[] }>())
  const previousFocus = useRef<string | undefined>(undefined)
  const targetRef = useRef<Box | null>(null)
  const inputFrame = useRef(0)
  const [ready, setReady] = useState(false)
  const [full, setFull] = useState<Box | null>(null)
  const [minimapView, setMinimapView] = useState<Box | null>(null)
  const viewRef = useRef<Box | null>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [hover, setHover] = useState<{ code: string; x: number; y: number } | null>(null)
  const animation = useRef(0)
  const drag = useRef<{ x: number; y: number; view: Box; moved: boolean } | null>(null)
  const suppressClick = useRef(false)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinch = useRef<{ dist: number; x: number; y: number; view: Box } | null>(null)

  const stopMotion = useCallback(() => {
    cancelAnimationFrame(animation.current)
    cancelAnimationFrame(inputFrame.current)
    animation.current = 0
    inputFrame.current = 0
    targetRef.current = null
  }, [])

  // ---- chèn SVG một lần ----
  useLayoutEffect(() => {
    const host = hostRef.current
    if (!host) return
    const camera = host.ownerDocument.createElement('div')
    camera.className = 'seatmap-camera'
    camera.innerHTML = svg
    const root = camera.querySelector('svg')
    const box = parseViewBox(root?.getAttribute('viewBox'))
    if (!root || !box) return
    root.removeAttribute('width')
    root.removeAttribute('height')
    root.setAttribute('preserveAspectRatio', 'xMidYMid meet')
    root.setAttribute('role', 'img')
    root.setAttribute('aria-label', 'Sơ đồ chỗ ngồi')
    host.replaceChildren(camera)
    cameraRef.current = camera
    baseRef.current = null
    viewRef.current = null
    lastMinimapUpdate.current = -Infinity
    const zoneParts = new Map<string, SVGElement[]>()
    const seatGroups = new Map<string, { layers: SVGGElement[]; seats: SVGElement[] }>()
    for (const el of root.querySelectorAll<SVGElement>('[id]')) {
      const code = zoneCodeOfPart(el.id)
      if (code) {
        const zone = parseZoneId(el.id)
        el.setAttribute('data-zone', code)
        if (zone) el.setAttribute('data-kind', zone.kind)
        const parts = zoneParts.get(code)
        if (parts) parts.push(el)
        else zoneParts.set(code, [el])
      }
    }
    // Group adjacent seats in place so the camera can paint only the focused zone.
    for (const seat of root.querySelectorAll<SVGElement>('[id^="SEAT__"]')) {
      const code = parseSeatId(seat.id)?.zone ?? seat.closest('[data-zone]')?.getAttribute('data-zone')
      const parent = seat.parentNode
      if (!code || !parent) continue
      let group = seatGroups.get(code)
      if (!group) {
        group = { layers: [], seats: [] }
        seatGroups.set(code, group)
      }
      const previous = seat.previousElementSibling
      const layer =
        previous?.getAttribute('data-seat-zone') === code
          ? (previous as SVGGElement)
          : root.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'g')
      if (layer !== previous) {
        layer.setAttribute('data-seat-zone', code)
        layer.setAttribute('data-seats-hidden', '')
        parent.insertBefore(layer, seat)
        group.layers.push(layer)
      }
      layer.appendChild(seat)
      group.seats.push(seat)
    }
    zonePartsRef.current = zoneParts
    seatGroupsRef.current = seatGroups
    previousFocus.current = undefined
    const background = root.querySelector<SVGGraphicsElement>('[id="BACKGROUND"]')
    const display = background?.style.display
    if (background) background.style.display = 'none'
    let bounds = box
    try {
      const fitted = root.getBBox()
      if (fitted.width > 0 && fitted.height > 0) {
        bounds = { x: fitted.x, y: fitted.y, w: fitted.width, h: fitted.height }
      }
    } catch {
      // The original viewBox is the fallback when SVG geometry isn't available.
    }
    if (background) background.style.display = display ?? ''
    setFull(bounds)
    setReady(true)
    return () => {
      stopMotion()
      clearTimeout(settleRef.current)
      cameraRef.current = null
      baseRef.current = null
      viewRef.current = null
      host.replaceChildren()
      setReady(false)
    }
  }, [svg, stopMotion])

  // ---- kích thước khung chứa ----
  useEffect(() => {
    const el = frameRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setSize({ w: width, h: height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const paintView = useCallback(
    (next: Box, interacting = true) => {
      const camera = cameraRef.current
      const base = baseRef.current
      if (!camera || !base || !size.w || !size.h) return
      camera.style.willChange = interacting ? 'transform' : 'auto'
      transformMapCamera(camera, base, next, size.w, size.h)
      clearTimeout(settleRef.current)
      const now = performance.now()
      if (minimap && (!interacting || now - lastMinimapUpdate.current >= 80)) {
        lastMinimapUpdate.current = now
        setMinimapView(next)
      }
      if (interacting) {
        settleRef.current = setTimeout(() => {
          camera.style.willChange = 'auto'
          if (minimap) setMinimapView(next)
        }, 120)
      }
    },
    [minimap, size],
  )

  const scheduleView = useCallback(
    (next: Box) => {
      viewRef.current = next
      if (inputFrame.current) return
      inputFrame.current = requestAnimationFrame(() => {
        inputFrame.current = 0
        if (viewRef.current) paintView(viewRef.current)
      })
    },
    [paintView],
  )

  // Wheel and button input can retarget the same animation while it is running.
  const glideTo = useCallback(
    (target: Box) => {
      targetRef.current = target
      if (animation.current) return
      if (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) {
        viewRef.current = target
        targetRef.current = null
        paintView(target, false)
        return
      }
      let previousTime = performance.now()
      const tick = (now: number) => {
        animation.current = 0
        const current = viewRef.current
        const destination = targetRef.current
        if (!current || !destination) return
        const elapsed = Math.max(1, Math.min(64, now - previousTime))
        previousTime = now
        const next = interpolateZoom(current, destination, 1 - Math.exp(-elapsed / 45))
        const settled =
          Math.max(
            Math.abs(next.w - destination.w),
            Math.abs(next.x - destination.x),
            Math.abs(next.y - destination.y),
          ) <
          destination.w * 0.0004
        viewRef.current = settled ? destination : next
        paintView(viewRef.current)
        if (settled) targetRef.current = null
        else animation.current = requestAnimationFrame(tick)
      }
      animation.current = requestAnimationFrame(tick)
    },
    [paintView],
  )

  // ---- hộp bao của khu (toạ độ gốc của bản vẽ) ----
  const zoneBox = useCallback((code: string): Box | null => {
    const parts = zonePartsRef.current.get(code)
    const root = cameraRef.current?.querySelector('svg')
    const ctm = root?.getScreenCTM?.()
    if (!parts || !ctm) return null
    const surface = parts.find((part) => part.id.startsWith('ZONE__'))
    const el = (surface ?? parts.find((part) => part.id.startsWith('CONTENT__'))) as SVGGraphicsElement | undefined
    const elCtm = el?.getScreenCTM?.()
    const b = el?.getBBox?.()
    if (!elCtm || !b || b.width <= 0 || b.height <= 0) return null
    const m = ctm.inverse().multiply(elCtm)
    const pts = [
      new DOMPoint(b.x, b.y),
      new DOMPoint(b.x + b.width, b.y),
      new DOMPoint(b.x, b.y + b.height),
      new DOMPoint(b.x + b.width, b.y + b.height),
    ].map((p) => p.matrixTransform(m))
    const xs = pts.map((p) => p.x)
    const ys = pts.map((p) => p.y)
    return {
      x: Math.min(...xs),
      y: Math.min(...ys),
      w: Math.max(...xs) - Math.min(...xs),
      h: Math.max(...ys) - Math.min(...ys),
    }
  }, [])

  const fitTarget = useCallback((): Box | null => {
    const base = baseRef.current
    if (!base) return null
    const box = focus ? zoneBox(focus) : null
    return box && box.w > 0 && box.h > 0 ? fitView(box, base.w / base.h, 0.1) : base
  }, [focus, zoneBox])

  useLayoutEffect(() => {
    const root = cameraRef.current?.querySelector('svg')
    if (!root || !full || !size.w || !size.h) return
    stopMotion()
    const base = fitView(full, size.w / size.h, 0.04)
    baseRef.current = base
    root.setAttribute('viewBox', boxToViewBox(base))
    viewRef.current = base
    paintView(base, false)
  }, [full, size, paintView, stopMotion])

  useLayoutEffect(() => {
    const target = fitTarget()
    if (!target || target === viewRef.current) return
    stopMotion()
    glideTo(target)
  }, [full, ready, fitTarget, glideTo, stopMotion])

  // ---- tô màu khu, lọc hạng, ghế ----
  useLayoutEffect(() => {
    const host = hostRef.current
    if (!host || !ready) return
    for (const [code, els] of zonePartsRef.current) {
      const zone = zones[code]
      const standing = els.some((el) => el.getAttribute('data-kind') === 'STANDING')
      const soldOut = !zone || zone.soldOut
      const matchesFilter = tierFilter === null || zone?.tier === tierFilter
      const dim = focus ? code !== focus : !matchesFilter
      for (const el of els) {
        const isContent = el.id.startsWith('CONTENT__')
        const isZone = el.id.startsWith('ZONE__')
        ;(el as SVGElement).style.setProperty(
          '--zone-fill',
          soldOut
            ? tierColor(zone?.tier, true)
            : (zone?.color ?? (standing ? 'var(--vg-bg-surface)' : tierColor(zone?.tier, false))),
        )
        toggle(el, 'data-zone-picked', isZone && !!selectedZones?.has(code))
        toggle(el, 'data-soldout', soldOut)
        toggle(el, 'data-dim', dim)
        toggle(el, 'data-active', isZone && code === focus)
        // Đang xem gần: chỉ khu được xem còn ghế; khu khác ẩn bớt chấm ghế để nhẹ.
        toggle(el, 'data-hidden', isContent && Boolean(focus) && code !== focus)
      }
    }
  }, [ready, svg, zones, focus, tierFilter, selectedZones])

  useLayoutEffect(() => {
    if (!ready) return
    const previous = previousFocus.current
    if (previous && previous !== focus) {
      const group = seatGroupsRef.current.get(previous)
      group?.layers.forEach((layer) => layer.setAttribute('data-seats-hidden', ''))
      group?.seats.forEach((seat) => seat.removeAttribute('data-status'))
    }
    previousFocus.current = focus
    if (!focus) return
    const group = seatGroupsRef.current.get(focus)
    group?.layers.forEach((layer) => layer.removeAttribute('data-seats-hidden'))
    for (const seat of group?.seats ?? []) {
      const state = selected.has(seat.id) ? 'SELECTED' : (seats?.[seat.id] ?? 'BLOCKED')
      if (seat.getAttribute('data-status') !== state) seat.setAttribute('data-status', state)
    }
  }, [ready, svg, focus, seats, selected])

  // ---- tương tác ----
  function zoneOf(target: EventTarget | null): string | null {
    return (target as Element | null)?.closest?.('[data-zone]')?.getAttribute('data-zone') ?? null
  }

  function onClick(e: React.MouseEvent) {
    if (suppressClick.current) {
      suppressClick.current = false
      return
    }
    const seat = (e.target as Element).closest?.('[id^="SEAT__"][data-status]')
    if (seat) {
      const state = seat.getAttribute('data-status')
      if (state === 'SELECTED' || selectableStatuses.includes(state as SeatState)) onSeatClick?.(seat.id)
      return
    }
    const code = zoneOf(e.target)
    if (code) onZoneClick(code)
    else onBackgroundClick?.()
  }

  function toMap(v: Box, clientX: number, clientY: number) {
    const rect = frameRef.current?.getBoundingClientRect()
    if (!rect || !rect.width || !rect.height) return { x: v.x + v.w / 2, y: v.y + v.h / 2 }
    return { x: v.x + ((clientX - rect.left) / rect.width) * v.w, y: v.y + ((clientY - rect.top) / rect.height) * v.h }
  }

  const zoomAt = useCallback(
    (factor: number, clientX?: number, clientY?: number) => {
      const view = targetRef.current ?? viewRef.current
      const base = baseRef.current
      if (!view || !base) return
      const anchor =
        clientX === undefined || clientY === undefined
          ? { x: view.x + view.w / 2, y: view.y + view.h / 2 }
          : toMap(view, clientX, clientY)
      setHover(null)
      glideTo(zoomAround(view, Math.min(factor, (view.w / base.w) * 24), anchor.x, anchor.y, base))
    },
    [glideTo],
  )

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const onWheel = (e: WheelEvent) => {
      if (!baseRef.current) return
      e.preventDefault()
      const pixels = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? size.h : 1)
      zoomAt(Math.exp(-Math.max(-100, Math.min(100, pixels)) * 0.0008), e.clientX, e.clientY)
    }
    host.addEventListener('wheel', onWheel, { passive: false })
    return () => host.removeEventListener('wheel', onWheel)
  }, [size.h, zoomAt])

  function capturePointer(element: Element, id: number) {
    try {
      element.setPointerCapture(id)
    } catch {
      // The pointer may already have been released.
    }
  }

  function onPointerDown(e: ReactPointerEvent) {
    if (e.button !== 0 || !viewRef.current || pointers.current.size >= 2) return
    stopMotion()
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      pinch.current = {
        dist: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
        x: (a.x + b.x) / 2,
        y: (a.y + b.y) / 2,
        view: viewRef.current,
      }
      for (const id of pointers.current.keys()) capturePointer(e.currentTarget, id)
      drag.current = null
      suppressClick.current = true
      return
    }
    suppressClick.current = false
    drag.current = { x: e.clientX, y: e.clientY, view: viewRef.current, moved: false }
  }

  function onPointerMove(e: ReactPointerEvent) {
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const gesture = pinch.current
    const base = baseRef.current
    if (gesture && base && pointers.current.size === 2 && size.w && size.h) {
      const [a, b] = [...pointers.current.values()]
      const dist = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y))
      const anchor = toMap(gesture.view, gesture.x, gesture.y)
      const next = zoomAround(
        gesture.view,
        Math.min(dist / gesture.dist, (gesture.view.w / base.w) * 24),
        anchor.x,
        anchor.y,
        base,
      )
      scheduleView(
        panView(
          next,
          (-((a.x + b.x) / 2 - gesture.x) * next.w) / size.w,
          (-((a.y + b.y) / 2 - gesture.y) * next.h) / size.h,
          base,
        ),
      )
      setHover(null)
      return
    }
    const d = drag.current
    const frame = frameRef.current
    if (d && frame && e.buttons === 1) {
      const dx = e.clientX - d.x
      const dy = e.clientY - d.y
      if (!d.moved && Math.hypot(dx, dy) > 5) {
        d.moved = true
        capturePointer(e.currentTarget, e.pointerId)
      }
      if (d.moved && base && size.w) {
        const scale = d.view.w / size.w
        scheduleView(panView(d.view, -dx * scale, -dy * scale, base))
        setHover(null)
        return
      }
    }
    const code = zoneOf(e.target)
    const rect = frame?.getBoundingClientRect()
    if (!code || !rect || !tooltip) {
      if (hover) setHover(null)
      return
    }
    setHover({ code, x: e.clientX - rect.left, y: e.clientY - rect.top })
  }

  function onPointerUp(e: ReactPointerEvent) {
    if (!pointers.current.delete(e.pointerId)) return
    if (pinch.current) {
      pinch.current = null
      const remaining = [...pointers.current.values()][0]
      drag.current = remaining && viewRef.current ? { ...remaining, view: viewRef.current, moved: true } : null
    } else {
      if (drag.current?.moved || e.type === 'pointercancel') suppressClick.current = true
      drag.current = null
    }
  }

  const refit = () => {
    const target = fitTarget()
    if (target) {
      stopMotion()
      glideTo(target)
    }
  }

  // Bàn phím: + / - phóng thu, 0 vừa khung, phím mũi tên kéo khung nhìn.
  function onKeyDown(e: React.KeyboardEvent) {
    const v = targetRef.current ?? viewRef.current
    const base = baseRef.current
    if (!v || !base) return
    const step = v.w * 0.12
    const move = (dx: number, dy: number) => glideTo(panView(v, dx, dy, base))
    if (e.key === '+' || e.key === '=') zoomAt(1.6)
    else if (e.key === '-') zoomAt(1 / 1.6)
    else if (e.key === '0') refit()
    else if (e.key === 'ArrowLeft') move(-step, 0)
    else if (e.key === 'ArrowRight') move(step, 0)
    else if (e.key === 'ArrowUp') move(0, -step)
    else if (e.key === 'ArrowDown') move(0, step)
    else return
    e.preventDefault()
  }

  const tip = hover && tooltip ? tooltip(hover.code) : null
  // Hộp tooltip bám con trỏ nhưng không tràn khung.
  const tipLeft = hover ? Math.min(Math.max(hover.x + 14, 8), Math.max(8, size.w - 270)) : 0
  const tipTop = hover ? Math.min(hover.y + 14, Math.max(8, size.h - 120)) : 0

  return (
    <div ref={frameRef} className={cn('relative size-full overflow-hidden', className)}>
      {/* Vùng bản đồ tự xử lý bàn phím và chuột (role application): các quy tắc a11y cho phần tử tĩnh không áp dụng. */}
      {/* oxlint-disable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */}
      <div
        ref={hostRef}
        className="seatmap size-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
        role="application"
        aria-label="Sơ đồ chỗ ngồi. Dùng phím cộng, trừ để phóng thu, phím mũi tên để di chuyển."
        tabIndex={0}
        onKeyDown={onKeyDown}
        onClick={onClick}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onLostPointerCapture={onPointerUp}
        onDragStart={(e) => e.preventDefault()}
        onPointerLeave={(e) => {
          if (!e.currentTarget.hasPointerCapture?.(e.pointerId)) onPointerUp(e)
          setHover(null)
        }}
      />
      {/* oxlint-enable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */}

      {tip && hover && (
        <div className="pointer-events-none absolute z-10" style={{ left: tipLeft, top: tipTop }}>
          {tip}
        </div>
      )}

      <div className="absolute top-3 right-3 z-10 flex flex-col gap-0.5 rounded-lg bg-surface p-1 shadow-float">
        <ControlButton label="Phóng to" onClick={() => zoomAt(1.6)}>
          <Plus className="size-4" />
        </ControlButton>
        <ControlButton label="Thu nhỏ" onClick={() => zoomAt(1 / 1.6)}>
          <Minus className="size-4" />
        </ControlButton>
        <ControlButton label="Vừa khung" onClick={refit}>
          <Maximize2 className="size-4" />
        </ControlButton>
      </div>

      {minimap && ready && minimapView && full && (
        <SeatMapMinimap
          svg={svg}
          bounds={full}
          view={minimapView}
          onFit={refit}
          onNavigate={(point) => {
            const view = viewRef.current
            const base = baseRef.current
            if (!view || !base) return
            stopMotion()
            scheduleView(panView({ ...view, x: point.x - view.w / 2, y: point.y - view.h / 2 }, 0, 0, base))
          }}
        />
      )}
    </div>
  )
}

function toggle(el: Element, attr: string, on: boolean) {
  if (on) el.setAttribute(attr, '')
  else el.removeAttribute(attr)
}

function ControlButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex size-8 items-center justify-center rounded-sm text-foreground outline-none hover:bg-canvas focus-visible:ring-2 focus-visible:ring-ring"
    >
      {children}
    </button>
  )
}
