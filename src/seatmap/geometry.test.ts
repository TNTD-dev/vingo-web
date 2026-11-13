import { describe, expect, it } from 'vitest'

import { fitView, panView, parseViewBox, zoomAround } from './geometry'

describe('fitView', () => {
  it('giữ tâm khu, thêm lề và khớp tỉ lệ khung chứa', () => {
    const v = fitView({ x: 100, y: 100, w: 200, h: 100 }, 2, 0)
    expect(v).toEqual({ x: 100, y: 100, w: 200, h: 100 })
    const wide = fitView({ x: 0, y: 0, w: 100, h: 100 }, 2, 0)
    expect(wide.w / wide.h).toBeCloseTo(2)
    expect(wide.x + wide.w / 2).toBeCloseTo(50)
    expect(wide.y + wide.h / 2).toBeCloseTo(50)
  })

  it('lề làm khung lớn hơn khu', () => {
    const v = fitView({ x: 0, y: 0, w: 100, h: 100 }, 1, 0.1)
    expect(v.w).toBeCloseTo(120)
  })
})

describe('zoomAround', () => {
  const full = { x: 0, y: 0, w: 1600, h: 1200 }

  it('điểm được giữ yên khi phóng to', () => {
    const v = zoomAround(full, 2, 400, 300, full)
    expect(v.w).toBe(800)
    // điểm (400,300) vẫn nằm ở cùng tỉ lệ trong khung
    expect((400 - v.x) / v.w).toBeCloseTo((400 - full.x) / full.w)
  })

  it('không thu nhỏ quá toàn cảnh', () => {
    const v = zoomAround(full, 0.5, 800, 600, full)
    expect(v.w).toBe(1600)
    expect(v.h).toBe(1200)
  })
})

describe('panView', () => {
  const bounds = { x: 0, y: 0, w: 1600, h: 1200 }

  it('kéo bình thường', () => {
    expect(panView({ x: 100, y: 100, w: 400, h: 300 }, 50, -20, bounds)).toEqual({ x: 150, y: 80, w: 400, h: 300 })
  })

  it('không kéo khung ra xa khỏi bản vẽ', () => {
    const v = panView({ x: 100, y: 100, w: 400, h: 300 }, 99999, 99999, bounds)
    expect(v.x).toBe(1600 - 200)
    expect(v.y).toBe(1200 - 150)
  })
})

describe('parseViewBox', () => {
  it('đọc viewBox hợp lệ, từ chối giá trị sai', () => {
    expect(parseViewBox('0 0 1600 1200')).toEqual({ x: 0, y: 0, w: 1600, h: 1200 })
    expect(parseViewBox('0,0,10,20')).toEqual({ x: 0, y: 0, w: 10, h: 20 })
    expect(parseViewBox('0 0 0 10')).toBeNull()
    expect(parseViewBox(null)).toBeNull()
    expect(parseViewBox('a b c d')).toBeNull()
  })
})
