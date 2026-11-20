import { describe, expect, it } from 'vitest'
import type { EventDetail } from '@/api/generated/model'
import {
  addMinutes,
  duplicateIds,
  eventChecklist,
  formatVndShort,
  nextOpenSlot,
  presetSale,
  readinessSummary,
  saleState,
  validateSaleWindow,
  venueState,
} from './readiness'

const ok = {
  starts_at: '2026-11-21T17:00',
  ends_at: '2026-11-21T19:00',
  sale_opens_at: '2026-11-14T10:00',
  sale_closes_at: '2026-11-21T17:00',
}

describe('validateSaleWindow', () => {
  it('chấp nhận đóng bán đúng lúc bắt đầu diễn', () => {
    expect(validateSaleWindow(ok)).toEqual([])
  })
  it('báo thiếu khi còn trường trống', () => {
    expect(validateSaleWindow({ ...ok, sale_opens_at: '' })).toEqual(['MISSING'])
  })
  it('từ chối đóng bán sau giờ bắt đầu', () => {
    expect(validateSaleWindow({ ...ok, sale_closes_at: '2026-11-21T17:01' })).toEqual(['SALE_AFTER_START'])
  })
  it('từ chối mở bán không trước đóng bán', () => {
    expect(validateSaleWindow({ ...ok, sale_opens_at: '2026-11-21T17:00' })).toContain('SALE_ORDER')
  })
  it('từ chối kết thúc không sau bắt đầu', () => {
    expect(validateSaleWindow({ ...ok, ends_at: '2026-11-21T17:00' })).toContain('END_BEFORE_START')
  })
})

describe('gợi ý giờ bán', () => {
  it('cộng trừ phút qua nửa đêm', () => {
    expect(addMinutes('2026-11-21T01:00', -120)).toBe('2026-11-20T23:00')
  })
  it('“Đóng trước 2 giờ” giữ giờ mở và lùi giờ đóng', () => {
    expect(presetSale('BEFORE_2H', ok.starts_at, '2026-11-01T08:00', { open: ok.sale_opens_at, close: '' })).toEqual({
      open: ok.sale_opens_at,
      close: '2026-11-21T15:00',
    })
  })
  it('“Mở bán ngay” lấy giờ hiện tại làm giờ mở', () => {
    expect(presetSale('NOW_TO_START', ok.starts_at, '2026-11-01T08:00', { open: '', close: '' })).toEqual({
      open: '2026-11-01T08:00',
      close: ok.starts_at,
    })
  })
})

describe('nextOpenSlot', () => {
  it('lấy giờ tròn kế tiếp sau ít nhất 30 phút', () => {
    expect(nextOpenSlot('2026-11-15T16:28')).toBe('2026-11-15T17:00')
    expect(nextOpenSlot('2026-11-15T23:40')).toBe('2026-11-16T01:00')
  })
})

describe('formatVndShort', () => {
  it('rút gọn tỷ và triệu', () => {
    expect(formatVndShort(4_280_000_000)).toBe('4,28 tỷ ₫')
    expect(formatVndShort(402_000_000)).toBe('402 tr ₫')
  })
})

const showtime = {
  id: 's1',
  status: 'DRAFT' as const,
  seat_layout_id: 'l1',
  starts_at: '2026-11-21T10:00:00Z',
  ends_at: '2026-11-21T12:00:00Z',
  sale_opens_at: '2026-11-14T03:00:00Z',
  sale_closes_at: '2026-11-21T10:00:00Z',
}
const layouts = {
  l1: {
    name: 'Sân chính',
    version: 1,
    status: 'PUBLISHED' as const,
    seat_count: 100,
    zones: [
      { id: 'z1', code: 'A', label: 'A', kind: 'SEATED' as const, capacity: 60 },
      { id: 'z2', code: 'B', label: 'B', kind: 'SEATED' as const, capacity: 40 },
    ],
  },
}
const event: EventDetail = {
  id: 'e',
  title: 'HAGL vs Hà Nội FC',
  category: 'FOOTBALL',
  poster_mobile_url: 'https://x/p.jpg',
  price_tiers: [{ id: 't1', name: 'VIP', price: 1 }],
  showtimes: [showtime],
}
const byId = (list: ReturnType<typeof eventChecklist>) => Object.fromEntries(list.map((c) => [c.id, c]))

describe('eventChecklist', () => {
  it('đủ cấu hình thì chỉ còn poster ngang là lưu ý không bắt buộc', () => {
    const list = eventChecklist({ event, layouts, assignments: { z1: 't1', z2: 't1' } })
    expect(list.filter((c) => c.status === 'ok')).toHaveLength(5)
    expect(byId(list)['poster-landscape']).toMatchObject({ status: 'warn', blocking: false })
    expect(readinessSummary(list)).toEqual({ ok: 5, total: 6, canPublish: true })
  })
  it('còn khu chưa gán hạng thì chưa thể công bố và nói rõ số khu', () => {
    const list = eventChecklist({ event, layouts, assignments: { z1: 't1' } })
    expect(byId(list).prices).toMatchObject({ status: 'todo', hint: '1/2 khu · 1 hạng giá' })
    expect(readinessSummary(list).canPublish).toBe(false)
  })
  it('chưa có suất diễn thì chặn và không bịa số khu', () => {
    const list = eventChecklist({ event: { ...event, showtimes: [] }, layouts, assignments: {} })
    expect(byId(list).showtimes.status).toBe('todo')
    expect(byId(list).layout.status).toBe('todo')
    expect(readinessSummary(list).canPublish).toBe(false)
  })
  it('không đọc được gán giá thì chỉ cảnh báo, để backend quyết', () => {
    const list = eventChecklist({ event, layouts, assignments: null })
    expect(byId(list).prices.status).toBe('warn')
    expect(readinessSummary(list).canPublish).toBe(true)
  })
  it('suất có giờ đóng bán sau giờ diễn bị báo không hợp lệ', () => {
    const bad = { ...showtime, sale_closes_at: '2026-11-21T11:00:00Z' }
    const list = eventChecklist({ event: { ...event, showtimes: [bad] }, layouts, assignments: null })
    expect(byId(list).showtimes).toMatchObject({ status: 'todo', hint: '1 suất có giờ bán chưa hợp lệ' })
  })
})

describe('venueState', () => {
  it('phân biệt sẵn sàng và chưa có sơ đồ', () => {
    expect(venueState([[{ version: 1 }], []])).toBe('READY')
    expect(venueState([[]])).toBe('NO_LAYOUT')
  })
})

describe('duplicateIds', () => {
  it('đánh dấu cả hai sự kiện cùng tên và thể loại', () => {
    const ids = duplicateIds([
      { id: '1', title: 'Việt Nam vs MU', category: 'FOOTBALL' },
      { id: '2', title: ' việt nam  vs mu', category: 'FOOTBALL' },
      { id: '3', title: 'Việt Nam vs MU', category: 'CONCERT' },
    ])
    expect([...ids].sort()).toEqual(['1', '2'])
  })
})

describe('saleState', () => {
  const now = Date.parse('2026-11-15T00:00:00Z')
  it('đang bán khi giờ hiện tại nằm trong khoảng mở–đóng', () => {
    expect(saleState([{ ...showtime, status: 'SCHEDULED', sale_opens_at: '2026-11-14T00:00:00Z' }], now)).toBe(
      'ON_SALE',
    )
  })
  it('sắp mở bán khi chưa tới giờ mở', () => {
    expect(saleState([{ ...showtime, status: 'SCHEDULED', sale_opens_at: '2026-11-16T00:00:00Z' }], now)).toBe(
      'UPCOMING',
    )
  })
  it('không tính suất đã hủy', () => {
    expect(saleState([{ ...showtime, status: 'CANCELLED' }], now)).toBe('NONE')
  })
})
