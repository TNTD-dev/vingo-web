import { describe, expect, it } from 'vitest'
import type { SeatLayoutZone } from '@/api/generated/model'
import {
  assignPriceToZones,
  groupZonesByPrice,
  layoutCapacity,
  removeZonePrices,
  rerandomizePriceColor,
  venueLayout,
  venueMapsUrl,
} from './venueLayoutModel'

describe('nguồn dữ liệu cấu hình sân', () => {
  it('chọn đúng layout giữa nhiều loại trong cùng sân', () => {
    const layouts = [
      { id: 'football', name: 'Bóng đá', venue_id: 'v1', layout_type: 'FOOTBALL' as const },
      { id: 'concert', name: 'Concert', venue_id: 'v1', layout_type: 'CONCERT' as const },
    ]
    expect(venueLayout(layouts, 'concert')?.id).toBe('concert')
    expect(venueLayout(layouts, 'missing')).toBeUndefined()
  })
  it('chọn đúng link cấu hình hoặc bản mới nhất, không sửa thứ tự cache', () => {
    const layouts = [
      { id: 'old', name: 'Cũ', version: 1 },
      { id: 'new', name: 'Mới', version: 2 },
    ]
    expect(venueLayout(layouts)?.id).toBe('new')
    expect(venueLayout(layouts, 'old')?.id).toBe('old')
    expect(venueLayout(layouts, 'missing')).toBeUndefined()
    expect(layouts[0].id).toBe('old')
  })
  it('phân biệt chưa tải dữ liệu, sơ đồ rỗng và chỗ đứng', () => {
    expect(layoutCapacity(undefined)).toBeNull()
    expect(layoutCapacity([])).toEqual({ zones: 0, seated: 0, standing: 0, total: 0 })
    const zones = [
      { kind: 'SEATED', capacity: 50 },
      { kind: 'STANDING', capacity: 120 },
    ] as SeatLayoutZone[]
    expect(layoutCapacity(zones)).toEqual({ zones: 2, seated: 50, standing: 120, total: 170 })
  })
  it('mở bản đồ từ tọa độ hoặc địa chỉ API, không gán địa điểm theo tên sân', () => {
    expect(venueMapsUrl({ name: 'Tên sân' })).toBeNull()
    expect(venueMapsUrl({ lat: 0, lng: 0, address: 'abc' })).toContain('query=0%2C0')
    expect(venueMapsUrl({ address: 'A & B' })).toContain('query=A%20%26%20B')
  })
  it('gán nhiều zone chung 1 giá vé có chung màu random, đổi màu và xóa sạch', () => {
    let seq = 0
    const rng = () => [0.1, 0.45, 0.75][seq++ % 3]
    let state = assignPriceToZones({ zonePrices: {}, priceColors: {} }, ['A1', 'B1'], 500_000, rng)
    expect(state.zonePrices).toEqual({ A1: 500_000, B1: 500_000 })
    const color500 = state.priceColors['500000']
    expect(color500).toBeDefined()

    // Gán thêm C1 cùng giá 500.000 giữ nguyên màu chung
    state = assignPriceToZones(state, ['C1'], 500_000, rng)
    expect(state.priceColors['500000']).toEqual(color500)

    // Gán mức giá khác nhận màu khác
    state = assignPriceToZones(state, ['D1'], 200_000, rng)
    expect(state.priceColors['200000']).toBeDefined()
    expect(state.priceColors['200000']).not.toEqual(color500)
    expect(groupZonesByPrice(state).map((g) => g.price)).toEqual([500_000, 200_000])

    // Đổi màu ngẫu nhiên cập nhật cho cả nhóm giá
    const rerolled = rerandomizePriceColor(state, 500_000, () => 0.85)
    expect(rerolled.priceColors['500000']).not.toEqual(color500)

    // Xóa hết zone của một mức giá sẽ dọn màu tương ứng
    const cleaned = removeZonePrices(rerolled, ['D1'])
    expect(cleaned.zonePrices.D1).toBeUndefined()
    expect(cleaned.priceColors['200000']).toBeUndefined()
  })
})
