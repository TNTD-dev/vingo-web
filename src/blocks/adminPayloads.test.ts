import { describe, expect, it } from 'vitest'

import {
  blockView,
  describeSeats,
  formatMetric,
  parseChart,
  parseReviewTable,
  parseSeatLock,
  parseStatCards,
  sanitizeLockSelection,
  toggleLockSeat,
} from './adminPayloads'
import { parseSeatMap } from './payloads'

const b = (payload: Record<string, unknown>) => ({ id: 'x', payload })

const rows = [
  [
    { id: 'A-01', label: 'A-01', state: 'sold' as const },
    { id: 'A-02', label: 'A-02', state: 'available' as const },
    { id: 'A-03', label: 'A-03', state: 'held' as const },
    { id: 'A-04', label: 'A-04', state: 'available' as const },
  ],
]

describe('chọn ghế để khoá', () => {
  it('chạm ghế đã bán hoặc đang giữ thì bỏ qua, danh sách không đổi', () => {
    expect(toggleLockSeat(['A-02'], rows[0]![0]!)).toEqual(['A-02'])
    expect(toggleLockSeat(['A-02'], rows[0]![2]!)).toEqual(['A-02'])
  })

  it('chạm ghế trống thì thêm, chạm lần nữa thì bớt', () => {
    const added = toggleLockSeat(['A-02'], rows[0]![3]!)
    expect(added).toEqual(['A-02', 'A-04'])
    expect(toggleLockSeat(added, rows[0]![3]!)).toEqual(['A-02'])
  })

  it('loại ghế đã bán, đang giữ, trùng và không có trong sơ đồ khỏi đề xuất của agent', () => {
    expect(sanitizeLockSelection(['A-01', 'A-02', 'A-02', 'A-03', 'Z-9'], rows)).toEqual(['A-02'])
  })

  it('đề xuất ban đầu của block không chứa ghế đã bán', () => {
    const block = b({ rows, selected: ['A-01', 'A-02', 'A-04'] })
    expect(parseSeatLock(block, parseSeatMap(block).rows).selected).toEqual(['A-02', 'A-04'])
  })

  it('mô tả danh sách ghế gọn khi nhiều ghế', () => {
    expect(describeSeats([])).toBe('Chưa chọn ghế')
    expect(describeSeats(['A-06', 'A-07'])).toBe('A-06, A-07')
    expect(describeSeats(['A-06', 'A-07', 'A-08', 'A-09', 'A-10', 'A-11'])).toBe('A-06 → A-11 · 6 ghế')
  })
})

describe('bảng duyệt đơn', () => {
  it('chỉ có phát hành vé hoặc để sau: đề xuất hoàn tiền hay lạ đều thành để sau, không được chọn', () => {
    const { orders } = parseReviewTable(
      b({
        orders: [
          { order_id: 'o1', code: '#1', proposal: 'ISSUE_TICKETS' },
          { order_id: 'o2', code: '#2', proposal: 'REFUND', selected: true },
          { order_id: 'o3', code: '#3' },
        ],
      }),
    )
    expect(orders.map((o) => [o.action, o.selected])).toEqual([
      ['ISSUE_TICKETS', true],
      ['SKIP', false],
      ['SKIP', false],
    ])
  })

  it('bỏ dòng thiếu mã đơn', () => {
    expect(parseReviewTable(b({ orders: [{ reason: 'x' }] })).orders).toEqual([])
  })
})

describe('số liệu', () => {
  it('ưu tiên value_label của agent, không tự tính lại', () => {
    const { cards } = parseStatCards(
      b({
        cards: [
          { label: 'A', value: 5, value_label: '1,94 tỷ ₫' },
          { label: 'B', value: 4812 },
        ],
      }),
    )
    expect(cards.map((c) => c.display)).toEqual(['1,94 tỷ ₫', '4.812'])
  })

  it('định dạng gọn theo đơn vị', () => {
    expect(formatMetric(1_940_000_000, 'VND')).toBe('1,94 tỷ ₫')
    expect(formatMetric(48, 'percent')).toBe('48%')
  })

  it('biểu đồ: cột cuối mỗi nhóm là kỳ hiện tại, max tính trên mọi cột', () => {
    const c = parseChart(
      b({
        categories: [
          { label: 'A', values: [1, 3] },
          { label: 'C', values: [2, 1], tone: 'danger' },
        ],
      }),
    )
    expect(c.max).toBe(3)
    expect(c.groups[1]).toMatchObject({ tone: 'danger', bars: [{ highlight: false }, { highlight: true }] })
  })
})

describe('blockView', () => {
  it('nhận ba dạng mở rộng, bỏ qua giá trị lạ', () => {
    expect(blockView(b({ view: 'review_table' }))).toBe('review_table')
    expect(blockView(b({ view: 'seat_lock' }))).toBe('seat_lock')
    expect(blockView(b({ view: 'evil' }))).toBeUndefined()
  })
})
