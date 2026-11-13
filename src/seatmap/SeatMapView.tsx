import { Maximize2, Minus, Plus } from 'lucide-react'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'

import { cn } from '@/lib/cn'

import './seatmap.css'
import { boxToViewBox, easeInOut, fitView, lerpBox, panView, parseViewBox, zoomAround, type Box } from './geometry'
import { indexSvg, parseZoneId, zoneCodeOfPart } from './svg'

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
  /** Chỉ sáng các khu thuộc hạng này (số) hoặc khu đứng; null = tất cả. */
  tierFilter?: number | 'standing' | null
  onZoneClick: (code: string) => void
  onSeatClick: (svgSeatId: string) => void
  /** Admin có thể chọn ghế BLOCKED để mở khóa; buyer mặc định chỉ chọn AVAILABLE. */
  selectableStatuses?: readonly SeatState[]
  /** Nội dung tooltip khi rê chuột vào khu; trả null để không hiện. */
  tooltip?: (code: string) => ReactNode
  /** Hiện bản đồ thu nhỏ khi đang xem gần. */
  minimap?: boolean
  className?: string
}

const ANIMATION_MS = 380
/** Vùng bản vẽ hiện trong bản đồ thu nhỏ (bỏ lề trắng quanh sân). */
const MINIMAP: Box = { x: 120, y: 24, w: 1360, h: 1152 }

const tierColor = (tier: number | undefined, soldOut: boolean) =>
  soldOut || !tier ? 'var(--vg-map-sold)' : `var(--vg-tier-${Math.min(tier, 4)})`

export function SeatMapView({
  svg,
  zones,
  focus,
  seats,
  selected,
  tierFilter = null,
  onZoneClick,
  onSeatClick,
  selectableStatuses = ['AVAILABLE'],
  tooltip,
  minimap = true,
  className,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const index = useMemo(() => indexSvg(svg), [svg])
  const [ready, setReady] = useState(false)
  const [full, setFull] = useState<Box | null>(null)
  const [view, setView] = useState<Box | null>(null)
  const viewRef = useRef<Box | null>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [hover, setHover] = useState<{ code: string; x: number; y: number } | null>(null)
  const animation = useRef(0)
  const miniRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; y: number; view: Box; moved: boolean } | null>(null)
  const suppressClick = useRef(false)

  // ---- chèn SVG một lần ----
  useLayoutEffect(() => {
    const host = hostRef.current
    if (!host) return
    host.innerHTML = svg
    const root = host.querySelector('svg')
    const box = parseViewBox(root?.getAttribute('viewBox'))
    if (!root || !box) return
    root.removeAttribute('width')
    root.removeAttribute('height')
    root.setAttribute('preserveAspectRatio', 'xMidYMid meet')
    root.setAttribute('role', 'img')
    root.setAttribute('aria-label', 'Sơ đồ chỗ ngồi')
    // Đánh dấu phần tử tương tác bằng data-zone để CSS và xử lý sự kiện dùng chung.
    for (const el of Array.from(host.querySelectorAll('[id]'))) {
      const code = zoneCodeOfPart(el.id)
      if (!code) continue
      const zone = parseZoneId(el.id)
      el.setAttribute('data-zone', code)
      if (zone) el.setAttribute('data-kind', zone.kind)
    }
    setFull(box)
    setView(box)
    viewRef.current = box
    setReady(true)
    return () => {
      host.innerHTML = ''
      setReady(false)
    }
  }, [svg])

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

  // ---- đưa khung nhìn tới đích (có hiệu ứng, tôn trọng prefers-reduced-motion) ----
  const flyTo = useCallback((target: Box) => {
    cancelAnimationFrame(animation.current)
    const from = viewRef.current ?? target
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      animation.current = requestAnimationFrame(() => {
        viewRef.current = target
        setView(target)
      })
      return
    }
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ANIMATION_MS)
      const next = lerpBox(from, target, easeInOut(t))
      viewRef.current = next
      setView(next)
      if (t < 1) animation.current = requestAnimationFrame(tick)
    }
    animation.current = requestAnimationFrame(tick)
  }, [])
  useEffect(() => () => cancelAnimationFrame(animation.current), [])

  // ---- hộp bao của khu (toạ độ gốc của bản vẽ) ----
  const zoneBox = useCallback((code: string): Box | null => {
    const host = hostRef.current
    const root = host?.querySelector('svg')
    const el = host?.querySelector<SVGGraphicsElement>(`[id^="CONTENT__${code}"]`)
    const ctm = root?.getScreenCTM()
    const elCtm = el?.getScreenCTM()
    if (!root || !el || !ctm || !elCtm) return null
    const b = el.getBBox()
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

  // ---- phóng vào khu / trở về toàn cảnh ----
  const aspect = size.w > 0 && size.h > 0 ? size.w / size.h : 4 / 3
  const fitTarget = useCallback((): Box | null => {
    if (!full) return null
    const box = focus ? zoneBox(focus) : null
    // Toàn cảnh: bỏ chừa trắng quanh sân để bản đồ to hơn.
    return box ? fitView(box, aspect, 0.1) : fitView({ x: 120, y: 24, w: 1360, h: 1152 }, aspect, 0.04)
  }, [full, focus, aspect, zoneBox])

  useEffect(() => {
    if (!ready) return
    const target = fitTarget()
    if (target) flyTo(target)
  }, [ready, focus, aspect, fitTarget, flyTo])

  useEffect(() => {
    const root = hostRef.current?.querySelector('svg')
    if (root && view) root.setAttribute('viewBox', boxToViewBox(view))
  }, [view, ready])

  // ---- tô màu khu, lọc hạng, ghế ----
  useLayoutEffect(() => {
    const host = hostRef.current
    if (!host || !ready) return
    const parts = new Map<string, Element[]>()
    for (const el of Array.from(host.querySelectorAll('[data-zone]'))) {
      const code = el.getAttribute('data-zone') ?? ''
      parts.set(code, [...(parts.get(code) ?? []), el])
    }
    for (const [code, els] of parts) {
      const zone = zones[code]
      const standing = index.zones.find((z) => z.code === code)?.kind === 'STANDING'
      const soldOut = !zone || zone.soldOut
      const matchesFilter =
        tierFilter === null || (tierFilter === 'standing' ? standing : !standing && zone?.tier === tierFilter)
      const dim = focus ? code !== focus : !matchesFilter
      for (const el of els) {
        const isContent = el.id.startsWith('CONTENT__')
        const isZone = el.id.startsWith('ZONE__')
        ;(el as SVGElement).style.setProperty('--zone-fill', tierColor(zone?.tier, soldOut))
        toggle(el, 'data-soldout', soldOut)
        toggle(el, 'data-dim', dim)
        toggle(el, 'data-active', isZone && code === focus)
        // Đang xem gần: chỉ khu được xem còn ghế; khu khác ẩn bớt chấm ghế để nhẹ.
        toggle(el, 'data-hidden', isContent && Boolean(focus) && code !== focus)
      }
    }
  }, [ready, zones, focus, tierFilter, index])

  useLayoutEffect(() => {
    const host = hostRef.current
    if (!host || !ready) return
    // Gỡ trạng thái ở lần trước rồi gán lại cho khu đang xem.
    for (const el of Array.from(host.querySelectorAll('[data-status]'))) el.removeAttribute('data-status')
    if (!focus) return
    const content = host.querySelector(`[id^="CONTENT__${focus}"]`)
    if (!content) return
    for (const el of Array.from(content.querySelectorAll('[id^="SEAT__"]'))) {
      const state = selected.has(el.id) ? 'SELECTED' : seats?.[el.id]
      if (state) el.setAttribute('data-status', state)
      else el.setAttribute('data-status', 'BLOCKED') // ghế không có dữ liệu = không bán
    }
  }, [ready, focus, seats, selected])

  // Bản đồ thu nhỏ: nhân bản SVG đã tô màu (CSS không áp dụng được vào <use>), chỉ khi đang xem gần.
  useEffect(() => {
    const mini = miniRef.current
    const root = hostRef.current?.querySelector('svg')
    if (!mini || !root || !ready || !focus) return
    const clone = root.cloneNode(true) as SVGSVGElement
    clone.setAttribute('viewBox', `${MINIMAP.x} ${MINIMAP.y} ${MINIMAP.w} ${MINIMAP.h}`)
    clone.removeAttribute('role')
    clone.removeAttribute('aria-label')
    clone.setAttribute('aria-hidden', 'true')
    for (const el of Array.from(clone.querySelectorAll('[data-status]'))) el.removeAttribute('data-status')
    mini.replaceChildren(clone)
    return () => mini.replaceChildren()
  }, [ready, focus, zones, tierFilter])

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
      if (state === 'SELECTED' || selectableStatuses.includes(state as SeatState)) onSeatClick(seat.id)
      return
    }
    const code = zoneOf(e.target)
    if (code) onZoneClick(code)
  }

  function onPointerDown(e: ReactPointerEvent) {
    if (!viewRef.current) return
    drag.current = { x: e.clientX, y: e.clientY, view: viewRef.current, moved: false }
  }

  function onPointerMove(e: ReactPointerEvent) {
    const d = drag.current
    const frame = frameRef.current
    if (d && frame && e.buttons === 1) {
      const dx = e.clientX - d.x
      const dy = e.clientY - d.y
      if (!d.moved && Math.hypot(dx, dy) > 5) {
        d.moved = true
        cancelAnimationFrame(animation.current)
      }
      if (d.moved && full) {
        const scale = d.view.w / frame.clientWidth
        const next = panView(d.view, -dx * scale, -dy * scale, full)
        viewRef.current = next
        setView(next)
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

  function onPointerUp() {
    if (drag.current?.moved) suppressClick.current = true
    drag.current = null
  }

  const zoomBy = (factor: number) => {
    const v = viewRef.current
    if (!v || !full) return
    flyTo(zoomAround(v, factor, v.x + v.w / 2, v.y + v.h / 2, full))
  }
  const refit = () => {
    const target = fitTarget()
    if (target) flyTo(target)
  }

  // Bàn phím: + / - phóng thu, 0 vừa khung, phím mũi tên kéo khung nhìn.
  function onKeyDown(e: React.KeyboardEvent) {
    const v = viewRef.current
    if (!v || !full) return
    const step = v.w * 0.12
    const move = (dx: number, dy: number) => flyTo(panView(v, dx, dy, full))
    if (e.key === '+' || e.key === '=') zoomBy(1.6)
    else if (e.key === '-') zoomBy(1 / 1.6)
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
        onPointerLeave={() => {
          onPointerUp()
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
        <ControlButton label="Phóng to" onClick={() => zoomBy(1.6)}>
          <Plus className="size-4" />
        </ControlButton>
        <ControlButton label="Thu nhỏ" onClick={() => zoomBy(1 / 1.6)}>
          <Minus className="size-4" />
        </ControlButton>
        <ControlButton label="Vừa khung" onClick={refit}>
          <Maximize2 className="size-4" />
        </ControlButton>
      </div>

      {minimap && focus && view && (
        <div className="pointer-events-none absolute bottom-3 left-3 z-10 w-[190px] rounded-md bg-surface p-1 shadow-float">
          <div className="relative overflow-hidden" style={{ aspectRatio: `${MINIMAP.w} / ${MINIMAP.h}` }}>
            <div ref={miniRef} className="seatmap size-full" aria-hidden />
            <div
              className="absolute border-2 border-ink bg-agent/25"
              style={{
                left: `${clampPct(((view.x - MINIMAP.x) / MINIMAP.w) * 100)}%`,
                top: `${clampPct(((view.y - MINIMAP.y) / MINIMAP.h) * 100)}%`,
                width: `${Math.min(100, (view.w / MINIMAP.w) * 100)}%`,
                height: `${Math.min(100, (view.h / MINIMAP.h) * 100)}%`,
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

const clampPct = (n: number) => Math.min(100, Math.max(0, n))

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
