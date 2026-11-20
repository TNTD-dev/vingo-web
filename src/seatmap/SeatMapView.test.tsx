import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { SeatMapView } from './SeatMapView'

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 400">
  <rect id="ZONE__A1__SEATED" x="20" y="20" width="100" height="100"/>
  <g id="CONTENT__A1">
    <circle id="SEAT__A1__A__01" cx="30" cy="30" r="2"/>
    <circle id="SEAT__A1__A__02" cx="40" cy="30" r="2"/>
  </g>
</svg>`

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

it('zooms a fixed SVG and keeps booking seat state and selection after opening a zone', () => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      private callback: ResizeObserverCallback

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
  vi.stubGlobal('matchMedia', () => ({ matches: true }))
  const onZoneClick = vi.fn()
  const onSeatClick = vi.fn()
  const props = {
    svg,
    zones: { A1: { tier: 1, soldOut: false } },
    seats: { SEAT__A1__A__01: 'AVAILABLE', SEAT__A1__A__02: 'SOLD' } as const,
    selected: new Set<string>(),
    onZoneClick,
    onSeatClick,
  }
  const { container, rerender } = render(<SeatMapView {...props} />)
  const camera = container.querySelector<HTMLDivElement>('.seatmap-camera')!
  const root = camera.querySelector('svg')!
  const zone = root.querySelector('#ZONE__A1__SEATED')!
  const seat = root.querySelector('#SEAT__A1__A__01')!
  expect(seat.closest('[data-seats-hidden]')).not.toBeNull()
  expect(screen.getByRole('button', { name: /^Bản đồ nhỏ/ })).toBeInTheDocument()
  fireEvent.click(zone)
  expect(onZoneClick).toHaveBeenCalledWith('A1')

  rerender(<SeatMapView {...props} focus="A1" />)
  expect(seat.closest('[data-seats-hidden]')).toBeNull()
  expect(seat).toHaveAttribute('data-status', 'AVAILABLE')
  const originalBox = root.getAttribute('viewBox')
  const originalTransform = camera.style.transform
  fireEvent.wheel(screen.getByRole('application'), { deltaY: -100, clientX: 300, clientY: 200 })
  expect(camera.style.transform).not.toBe(originalTransform)
  expect(root).toHaveAttribute('viewBox', originalBox)

  fireEvent.click(seat)
  fireEvent.click(root.querySelector('#SEAT__A1__A__02')!)
  expect(onSeatClick).toHaveBeenCalledExactlyOnceWith('SEAT__A1__A__01')
  rerender(<SeatMapView {...props} focus="A1" selected={new Set([seat.id])} />)
  expect(seat).toHaveAttribute('data-status', 'SELECTED')
})
