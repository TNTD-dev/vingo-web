import { useState } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { parseSeatId } from '@/seatmap/svg'
import { VenueMapView } from './VenueMapView'

const source = `<svg viewBox="0 0 1000 600"><rect id="BACKGROUND" width="1000" height="600" fill="white"/><rect id="PITCH" x="300" y="200" width="400" height="200" fill="#208040"/><path id="pitch_track" fill="#ab5b40" d="M0 0H1000V600H0Z"/><g id="ZONE__A1__SEATED"><path d="M100 100h100v100H100Z" fill="#aabbcc"/></g><g id="CONTENT__A1"><circle id="SEAT__A1__A__01" cx="130" cy="130" r="2"/><g id="GATE__A1__01"><rect width="10" height="10" fill="#ffffff"/></g></g></svg>`
const boxDescriptor = Object.getOwnPropertyDescriptor(SVGElement.prototype, 'getBBox')
const matrixDescriptor = Object.getOwnPropertyDescriptor(SVGElement.prototype, 'getScreenCTM')

beforeEach(() => {
  vi.useFakeTimers()
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(600)
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(400)
  Object.defineProperty(SVGElement.prototype, 'getBBox', {
    configurable: true,
    value: function (this: SVGElement) {
      if (this.id.startsWith('SEAT__')) return { x: 128, y: 128, width: 4, height: 4 }
      if (this.id.startsWith('ZONE__')) return { x: 100, y: 100, width: 100, height: 100 }
      return { x: 0, y: 0, width: 1000, height: 600 }
    },
  })
  const matrix = {
    inverse() {
      return this
    },
    multiply() {
      return this
    },
  }
  Object.defineProperty(SVGElement.prototype, 'getScreenCTM', { configurable: true, value: () => matrix })
  vi.stubGlobal(
    'DOMPoint',
    class {
      x: number
      y: number
      constructor(x: number, y: number) {
        this.x = x
        this.y = y
      }
      matrixTransform() {
        return this
      }
    },
  )
  vi.stubGlobal(
    'ResizeObserver',
    class {
      callback: ResizeObserverCallback
      constructor(callback: ResizeObserverCallback) {
        this.callback = callback
      }
      observe() {
        this.callback(
          [{ contentRect: { width: 600, height: 400 } }] as ResizeObserverEntry[],
          this as unknown as ResizeObserver,
        )
      }
      disconnect() {}
    },
  )
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callback(0)
    return 1
  })
  vi.stubGlobal('cancelAnimationFrame', () => {})
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  if (boxDescriptor) Object.defineProperty(SVGElement.prototype, 'getBBox', boxDescriptor)
  else Reflect.deleteProperty(SVGElement.prototype, 'getBBox')
  if (matrixDescriptor) Object.defineProperty(SVGElement.prototype, 'getScreenCTM', matrixDescriptor)
  else Reflect.deleteProperty(SVGElement.prototype, 'getScreenCTM')
})
function setup(focus?: string, svgSource = source, minimap = false) {
  const props = {
    svg: svgSource,
    minimap,
    focus,
    onZoneClick: vi.fn(),
    onSeatClick: vi.fn(),
    onGateClick: vi.fn(),
    onOverview: vi.fn(),
  }
  return { ...render(<VenueMapView {...props} />), props }
}

describe('bộ xem SVG cấu hình sân', () => {
  it('minimap dùng nền nhẹ, thu khung khi zoom và điều khiển camera chính', () => {
    const { container, props } = setup(undefined, source, true)
    const map = screen.getByRole('button', { name: /^Bản đồ nhỏ/ })
    const camera = container.querySelector<HTMLDivElement>('.venue-map-camera')!
    const viewport = map.querySelector<HTMLSpanElement>('.venue-minimap-viewport')!
    const image = decodeURIComponent(map.querySelector('img')!.src)
    expect(image).toContain('id="PITCH"')
    expect(image).not.toContain('id="SEAT__A1__A__01"')
    expect(container.querySelector('[data-map-seat]')).not.toBeNull()

    const fullCamera = camera.style.transform
    const fullWidth = parseFloat(viewport.style.width)
    fireEvent.click(screen.getByRole('button', { name: 'Phóng to' }))
    act(() => vi.advanceTimersByTime(120))
    expect(parseFloat(viewport.style.width)).toBeLessThan(fullWidth)

    const zoomedCamera = camera.style.transform
    fireEvent.keyDown(map, { key: 'ArrowRight' })
    expect(camera.style.transform).not.toBe(zoomedCamera)

    fireEvent.keyDown(map, { key: 'Home' })
    act(() => vi.advanceTimersByTime(120))
    expect(camera.style.transform).toBe(fullCamera)
    expect(parseFloat(viewport.style.width)).toBeCloseTo(fullWidth)
    expect(props.onOverview).toHaveBeenCalledOnce()
  })
  it('giữ màu nguồn, ẩn ghế tổng quan nhưng không ẩn cổng', () => {
    const { container } = setup()
    expect(container.querySelector('#PITCH')).toHaveAttribute('fill', '#208040')
    expect(container.querySelector('#pitch_track')).toHaveAttribute('fill', '#ab5b40')
    expect(container.querySelector('[data-map-seat]')!.closest('[data-map-hidden]')).not.toBeNull()
    expect(container.querySelector('[data-map-gate]')).not.toHaveAttribute('data-map-hidden')
    expect(container.querySelectorAll('[data-map-gate]')).toHaveLength(1)
    expect(screen.getByText('Tổng quan khu')).toBeInTheDocument()
  })
  it('focus khu hiện ghế và click ghế chỉ gọi callback xem', () => {
    const { container, props } = setup('A1')
    const seat = container.querySelector('[data-map-seat]')!
    expect(seat.closest('[data-map-hidden]')).toBeNull()
    fireEvent.click(seat)
    expect(props.onSeatClick).toHaveBeenCalledWith('SEAT__A1__A__01')
    expect(props.onZoneClick).not.toHaveBeenCalled()
  })
  it('ghế ẩn không nhận callback ghế, cổng giữ đúng id từ nguồn', () => {
    const { container, props } = setup()
    fireEvent.click(container.querySelector('[data-map-seat]')!)
    expect(props.onSeatClick).not.toHaveBeenCalled()
    fireEvent.click(container.querySelector('[data-map-gate] rect')!)
    expect(props.onGateClick).toHaveBeenCalledWith({ id: 'GATE__A1__01', number: '01', zone: 'A1' })
  })
  it('wheel ngăn cuộn trang, chỉ đổi camera và giữ nguyên viewBox', () => {
    const { container } = setup(),
      host = screen.getByRole('application')
    const before = container.querySelector('svg')!.getAttribute('viewBox')
    const camera = container.querySelector<HTMLDivElement>('.venue-map-camera')!
    const beforeTransform = camera.style.transform
    const event = new WheelEvent('wheel', { deltaY: -100, clientX: 300, clientY: 200, bubbles: true, cancelable: true })
    act(() => {
      host.dispatchEvent(event)
    })
    expect(event.defaultPrevented).toBe(true)
    expect(container.querySelector('svg')!.getAttribute('viewBox')).toBe(before)
    expect(camera.style.transform).not.toBe(beforeTransform)
    expect(camera.style.willChange).toBe('transform')
    act(() => vi.advanceTimersByTime(120))
    expect(camera.style.willChange).toBe('auto')
  })
  it('giữ viewBox cố định qua nhiều frame, tích lũy wheel và hủy animation khi unmount', () => {
    const frames = new Map<number, FrameRequestCallback>()
    let id = 0
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frames.set(++id, callback)
      return id
    })
    vi.stubGlobal('cancelAnimationFrame', (frame: number) => frames.delete(frame))
    const { container, unmount } = setup()
    const host = screen.getByRole('application')
    const camera = container.querySelector<HTMLDivElement>('.venue-map-camera')!
    const svg = container.querySelector('svg')!
    const viewBox = svg.getAttribute('viewBox')
    const initial = camera.style.transform
    const step = () =>
      act(() => {
        vi.advanceTimersByTime(16)
        const callbacks = [...frames.values()]
        frames.clear()
        callbacks.forEach((callback) => callback(performance.now()))
      })
    fireEvent.wheel(host, { deltaY: -100, clientX: 300, clientY: 200 })
    step()
    const first = camera.style.transform
    expect(first).not.toBe(initial)
    fireEvent.wheel(host, { deltaY: -100, clientX: 300, clientY: 200 })
    for (let i = 0; i < 10; i++) step()
    expect(camera.style.transform).not.toBe(first)
    expect(svg.getAttribute('viewBox')).toBe(viewBox)
    expect(frames.size).toBe(1)
    unmount()
    expect(frames.size).toBe(0)
    expect(vi.getTimerCount()).toBe(0)
  })
  it('pinch phóng tại tâm hai ngón, chặn click nhầm và giữ target khi tap', () => {
    HTMLElement.prototype.setPointerCapture = vi.fn()
    HTMLElement.prototype.hasPointerCapture = vi.fn(() => true)
    HTMLElement.prototype.releasePointerCapture = vi.fn()
    const { container, props } = setup('A1')
    const host = screen.getByRole('application')
    const camera = container.querySelector<HTMLDivElement>('.venue-map-camera')!
    const initial = camera.style.transform
    fireEvent.pointerDown(host, { pointerType: 'touch', pointerId: 1, button: 0, clientX: 200, clientY: 200 })
    expect(host.setPointerCapture).not.toHaveBeenCalled()
    fireEvent.pointerDown(host, { pointerType: 'touch', pointerId: 2, button: 0, clientX: 400, clientY: 200 })
    fireEvent.pointerMove(host, { pointerType: 'touch', pointerId: 2, buttons: 1, clientX: 500, clientY: 200 })
    expect(camera.style.transform).not.toBe(initial)
    fireEvent.pointerUp(host, { pointerId: 2 })
    fireEvent.pointerUp(host, { pointerId: 1 })
    const seat = container.querySelector('[data-map-seat]')!
    fireEvent.click(seat)
    expect(props.onSeatClick).not.toHaveBeenCalled()
    fireEvent.pointerDown(seat, { pointerType: 'touch', pointerId: 3, button: 0, clientX: 300, clientY: 200 })
    fireEvent.pointerUp(seat, { pointerId: 3 })
    fireEvent.click(seat)
    expect(props.onSeatClick).toHaveBeenCalledWith(seat.id)
  })
  it('về toàn cảnh bỏ focus và ẩn ghế', () => {
    const { container, props } = setup('A1')
    fireEvent.click(screen.getByRole('button', { name: 'Về toàn cảnh' }))
    act(() => vi.advanceTimersByTime(120))
    expect(props.onOverview).toHaveBeenCalled()
    expect(container.querySelector('[data-map-seat]')!.closest('[data-map-hidden]')).not.toBeNull()
  })
  it('áp data-map-detail lên path zone và nhãn khi mở chi tiết, click GATE_LABEL vẫn nhận đúng cổng', () => {
    const richSvg = `<svg viewBox="0 0 1000 600">
      <rect id="BACKGROUND" width="1000" height="600" fill="white"/>
      <path id="ZONE__A2R-T1__SEATED" d="M100 100h100v100H100Z" fill="#aabbcc"/>
      <g id="CONTENT__A2R-T1">
        <circle id="SEAT__A2R-T1__A__01" cx="130" cy="130" r="2"/>
        <path id="GATE__A2R-T1__01" d="M10 10h20v20H10Z"/>
        <path id="GATE_LABEL__A2R-T1__01" d="M12 12h10v10H12Z"/>
      </g>
      <g id="LABEL__A2R-T1"><rect x="120" y="110" width="30" height="12"/></g>
    </svg>`
    const { container, props } = setup('A2R-T1', richSvg)
    expect(container.querySelector('#ZONE__A2R-T1__SEATED')).toHaveAttribute('data-map-detail')
    expect(container.querySelector('#LABEL__A2R-T1')).toHaveAttribute('data-map-detail')
    fireEvent.click(container.querySelector('#GATE_LABEL__A2R-T1__01')!)
    expect(props.onGateClick).toHaveBeenCalledWith({ id: 'GATE__A2R-T1__01', number: '01', zone: 'A2R-T1' })
  })
  it('hỗ trợ bàn phím +/−/Arrow/0 và kéo không gây click nhầm', () => {
    HTMLElement.prototype.setPointerCapture = vi.fn()
    HTMLElement.prototype.hasPointerCapture = vi.fn(() => true)
    HTMLElement.prototype.releasePointerCapture = vi.fn()

    const { container, props } = setup()
    const host = screen.getByRole('application')
    const camera = container.querySelector<HTMLDivElement>('.venue-map-camera')!
    const initial = camera.style.transform

    fireEvent.keyDown(host, { key: '+' })
    const zoomed = camera.style.transform
    expect(zoomed).not.toBe(initial)

    fireEvent.keyDown(host, { key: 'ArrowRight' })
    expect(camera.style.transform).not.toBe(zoomed)

    fireEvent.keyDown(host, { key: '-' })
    fireEvent.keyDown(host, { key: '0' })
    expect(props.onOverview).toHaveBeenCalledTimes(1)
    expect(camera.style.transform).toBe(initial)

    const zone = container.querySelector('#ZONE__A1__SEATED')!
    fireEvent.pointerDown(host, { button: 0, clientX: 100, clientY: 100, pointerId: 1 })
    fireEvent.pointerMove(host, { buttons: 1, clientX: 140, clientY: 120, pointerId: 1 })
    fireEvent.pointerUp(host, { pointerId: 1 })
    fireEvent.click(zone)
    expect(props.onZoneClick).not.toHaveBeenCalled()

    fireEvent.pointerDown(host, { button: 0, clientX: 100, clientY: 100, pointerId: 2 })
    fireEvent.pointerCancel(host, { pointerId: 2 })
    fireEvent.click(zone)
    expect(props.onZoneClick).not.toHaveBeenCalled()

    fireEvent.click(zone)
    expect(props.onZoneClick).toHaveBeenCalledWith('A1')
  })
  it('chọn ghế khi đã zoom gần không làm nhảy viewBox, hiển thị màu giá và viền chọn khu', () => {
    const twoZoneSvg = `<svg viewBox="0 0 1000 600">
      <rect id="BACKGROUND" width="1000" height="600" fill="white"/>
      <g id="ZONE__A1__SEATED"><path d="M100 100h100v100H100Z" fill="#aabbcc"/></g>
      <g id="CONTENT__A1"><circle id="SEAT__A1__A__01" cx="130" cy="130" r="2"/></g>
      <g id="ZONE__B1__SEATED"><path d="M220 100h100v100H220Z" fill="#ccbbaa"/></g>
      <g id="CONTENT__B1"><circle id="SEAT__B1__A__01" cx="250" cy="130" r="2"/></g>
    </svg>`

    function Harness() {
      const [focus, setFocus] = useState<string>()
      const [seatId, setSeatId] = useState<string>()
      return (
        <VenueMapView
          svg={twoZoneSvg}
          focus={focus}
          selectedSeat={seatId}
          selectedZones={new Set(['A1'])}
          zoneColors={{ A1: { fill: 'hsl(120 78% 68%)', stroke: 'hsl(120 72% 32%)' } }}
          onZoneClick={(code) => setFocus(code)}
          onSeatClick={(id) => {
            const parsed = parseSeatId(id)
            if (parsed) setFocus(parsed.zone)
            setSeatId(id)
          }}
          onGateClick={() => {}}
          onOverview={() => {
            setFocus(undefined)
            setSeatId(undefined)
          }}
        />
      )
    }

    const { container } = render(<Harness />)
    const zoneA1 = container.querySelector('#ZONE__A1__SEATED') as SVGElement
    expect(zoneA1).toHaveAttribute('data-map-colored')
    expect(zoneA1).toHaveAttribute('data-map-picked')
    expect(zoneA1.style.getPropertyValue('--zone-custom-fill')).toBe('hsl(120 78% 68%)')

    const host = screen.getByRole('application')
    const zoomIn = screen.getByRole('button', { name: 'Phóng to' })
    fireEvent.click(zoomIn)
    fireEvent.click(zoomIn)
    fireEvent.keyDown(host, { key: 'ArrowLeft' })
    fireEvent.keyDown(host, { key: 'ArrowLeft' })
    fireEvent.keyDown(host, { key: 'ArrowLeft' })

    act(() => vi.advanceTimersByTime(120))
    const seatA1 = container.querySelector('#SEAT__A1__A__01')!
    const seatB1 = container.querySelector('#SEAT__B1__A__01')!
    expect(seatA1.closest('[data-map-hidden]')).toBeNull()
    expect(seatB1.closest('[data-map-hidden]')).toBeNull()

    const svgEl = container.querySelector('svg')!
    const zoomedBox = svgEl.getAttribute('viewBox')
    const camera = container.querySelector<HTMLDivElement>('.venue-map-camera')!
    const cameraBefore = camera.style.transform
    fireEvent.click(seatA1)

    expect(svgEl.getAttribute('viewBox')).toBe(zoomedBox)
    expect(camera.style.transform).toBe(cameraBefore)
    expect(seatA1).toHaveAttribute('data-map-selected')
    expect(seatB1.closest('[data-map-hidden]')).toBeNull()
  })
})
