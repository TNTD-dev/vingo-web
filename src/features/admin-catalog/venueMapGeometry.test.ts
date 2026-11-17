import { describe, expect, it } from 'vitest'
import { fitVenueZone, showVenueSeats, visibleBox, wheelZoomFactor, zoomVenueView } from './venueMapGeometry'

const overview = { x: 0, y: 0, w: 1000, h: 600 }
describe('điều khiển bản đồ cấu hình sân', () => {
  it('zoom neo vị trí con trỏ', () => {
    const anchor = { x: 300, y: 180 },
      next = zoomVenueView(overview, 2, anchor, overview)
    expect((anchor.x - next.x) / next.w).toBeCloseTo(0.3)
    expect((anchor.y - next.y) / next.h).toBeCloseTo(0.3)
  })
  it('giới hạn zoom nhưng giữ aspect ratio', () => {
    expect(zoomVenueView(overview, 1000, { x: 500, y: 300 }, overview).w).toBeCloseTo(1000 / 24)
    const next = zoomVenueView(overview, 0.001, { x: 500, y: 300 }, overview)
    expect(next.w).toBe(1000)
    expect(next.w / next.h).toBeCloseTo(1000 / 600)
  })
  it('chuẩn hóa wheel theo pixel, dòng và trang', () => {
    expect(wheelZoomFactor(16, 0, 600)).toBe(wheelZoomFactor(1, 1, 600))
    expect(wheelZoomFactor(1000, 0, 600)).toBe(wheelZoomFactor(1, 2, 600))
    expect(wheelZoomFactor(-10, 0, 600)).toBeGreaterThan(1)
    expect(wheelZoomFactor(10, 0, 600)).toBeLessThan(1)
  })
  it('hai ngưỡng tránh nhấp nháy ghế, ghế quá nhỏ phải ẩn', () => {
    expect(showVenueSeats(false, 2)).toBe(false)
    expect(showVenueSeats(false, 4.6)).toBe(true)
    expect(showVenueSeats(true, 3.5)).toBe(true)
    expect(showVenueSeats(false, 3.5)).toBe(false)
    expect(showVenueSeats(true, 2.9)).toBe(false)
  })
  it('chỉ cần ghế của các khu nằm trong viewport', () => {
    expect(visibleBox(overview, { x: 200, y: 200, w: 100, h: 100 })).toBe(true)
    expect(visibleBox(overview, { x: 1200, y: 200, w: 100, h: 100 })).toBe(false)
  })
  it('fit zone theo aspect màn hình mà không vượt giới hạn phóng', () => {
    const next = fitVenueZone({ x: 100, y: 150, w: 1, h: 1 }, overview, 2)
    expect(next.w / next.h).toBeCloseTo(2)
    expect(next.w).toBeCloseTo(1000 / 24)
    expect(next.x + next.w / 2).toBeCloseTo(100.5)
  })
})
