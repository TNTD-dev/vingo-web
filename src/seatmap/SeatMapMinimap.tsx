import { useMemo, useRef } from 'react'
import { boxToViewBox, fitView, type Box } from './geometry'
import './seatmap-minimap.css'

type Props = {
  svg: string
  bounds: Box
  view: Box
  onNavigate: (point: { x: number; y: number }) => void
  onFit: () => void
}

const percent = (value: number) => Math.min(100, Math.max(0, value))

/** SVG thu nhỏ đặt trong ảnh riêng để không trùng ID/mask với bản đồ chính. */
export function SeatMapMinimap({ svg, bounds, view, onNavigate, onFit }: Props) {
  const pointer = useRef<number | null>(null)
  const { image, canvas } = useMemo(() => {
    const canvas = fitView(bounds, 1.4, 0.04)
    const document = new DOMParser().parseFromString(svg, 'image/svg+xml')
    const root = document.documentElement
    root.querySelectorAll('[id^="SEAT__"]').forEach((seat) => seat.remove())
    root.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    root.setAttribute('viewBox', boxToViewBox(canvas))
    root.setAttribute('width', '280')
    root.setAttribute('height', '200')
    root.setAttribute('preserveAspectRatio', 'xMidYMid meet')
    const source = new XMLSerializer().serializeToString(root)
    return { canvas, image: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(source)}` }
  }, [svg, bounds])
  const left = percent(((view.x - canvas.x) / canvas.w) * 100)
  const top = percent(((view.y - canvas.y) / canvas.h) * 100)
  const right = percent(((view.x + view.w - canvas.x) / canvas.w) * 100)
  const bottom = percent(((view.y + view.h - canvas.y) / canvas.h) * 100)

  function navigate(element: HTMLButtonElement, x: number, y: number) {
    const rect = element.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    onNavigate({
      x: canvas.x + Math.min(1, Math.max(0, (x - rect.left) / rect.width)) * canvas.w,
      y: canvas.y + Math.min(1, Math.max(0, (y - rect.top) / rect.height)) * canvas.h,
    })
  }

  return (
    <div className="venue-map-minimap">
      <span className="venue-minimap-label">Bản đồ nhỏ</span>
      <button
        type="button"
        className="venue-minimap-canvas"
        aria-label="Bản đồ nhỏ. Bấm hoặc kéo để di chuyển, phím mũi tên để di chuyển, Enter để về toàn cảnh."
        title="Bấm hoặc kéo để di chuyển vùng đang xem"
        onPointerDown={(event) => {
          if (event.button !== 0) return
          event.preventDefault()
          event.currentTarget.focus({ preventScroll: true })
          pointer.current = event.pointerId
          event.currentTarget.setPointerCapture?.(event.pointerId)
          navigate(event.currentTarget, event.clientX, event.clientY)
        }}
        onPointerMove={(event) => {
          if (pointer.current === event.pointerId) navigate(event.currentTarget, event.clientX, event.clientY)
        }}
        onPointerUp={(event) => {
          if (pointer.current !== event.pointerId) return
          pointer.current = null
          if (event.currentTarget.hasPointerCapture?.(event.pointerId))
            event.currentTarget.releasePointerCapture(event.pointerId)
        }}
        onPointerCancel={() => {
          pointer.current = null
        }}
        onLostPointerCapture={() => {
          pointer.current = null
        }}
        onClick={(event) => {
          if (event.detail === 0) onFit()
        }}
        onKeyDown={(event) => {
          if (event.key === 'Home' || event.key === '0') {
            event.preventDefault()
            onFit()
          } else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
            event.preventDefault()
            onNavigate({
              x:
                view.x +
                view.w / 2 +
                (event.key === 'ArrowLeft' ? -view.w * 0.15 : event.key === 'ArrowRight' ? view.w * 0.15 : 0),
              y:
                view.y +
                view.h / 2 +
                (event.key === 'ArrowUp' ? -view.h * 0.15 : event.key === 'ArrowDown' ? view.h * 0.15 : 0),
            })
          }
        }}
      >
        <img src={image} alt="" draggable={false} />
        <span
          className="venue-minimap-viewport"
          aria-hidden="true"
          style={{
            left: `${left}%`,
            top: `${top}%`,
            width: `${Math.max(0, right - left)}%`,
            height: `${Math.max(0, bottom - top)}%`,
          }}
        />
      </button>
    </div>
  )
}
