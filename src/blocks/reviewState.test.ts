import { describe, expect, it } from 'vitest'

import type { ReviewOrder } from './adminPayloads'
import { decisions, initialRows, isChanged, setRowAction, summarize, toggleRow } from './reviewState'

const order = (id: string, action: ReviewOrder['action'], selected: boolean, tickets = 2): ReviewOrder => ({
  orderId: id,
  code: id,
  reason: '',
  action,
  selected,
  statusTone: 'neutral',
  tickets,
})
const orders = [order('a', 'ISSUE_TICKETS', true), order('b', 'ISSUE_TICKETS', true), order('c', 'SKIP', false)]

describe('bảng duyệt hàng loạt', () => {
  it('ban đầu chỉ duyệt các đơn Vingo đề xuất phát hành', () => {
    const rows = initialRows(orders)
    expect(decisions(rows)).toEqual([
      { order_id: 'a', action: 'ISSUE_TICKETS' },
      { order_id: 'b', action: 'ISSUE_TICKETS' },
    ])
    expect(summarize(rows, orders)).toEqual({ count: 2, total: 3, skipped: 1, tickets: 4 })
  })

  it('bỏ chọn một đơn thì đơn đó không còn trong danh sách duyệt', () => {
    const rows = toggleRow(initialRows(orders), 'a')
    expect(decisions(rows).map((d) => d.order_id)).toEqual(['b'])
    expect(isChanged(initialRows(orders), rows)).toBe(true)
  })

  it('chọn đơn đang "để sau" thì chuyển sang phát hành vé', () => {
    const rows = toggleRow(initialRows(orders), 'c')
    expect(rows.find((r) => r.orderId === 'c')).toMatchObject({ selected: true, action: 'ISSUE_TICKETS' })
  })

  it('đổi đề xuất sang "để sau" thì tự bỏ chọn', () => {
    const rows = setRowAction(initialRows(orders), 'b', 'SKIP')
    expect(rows.find((r) => r.orderId === 'b')).toMatchObject({ selected: false, action: 'SKIP' })
    expect(decisions(rows).map((d) => d.order_id)).toEqual(['a'])
  })

  it('đổi rồi trả về như cũ thì không còn là thay đổi', () => {
    const start = initialRows(orders)
    expect(isChanged(start, toggleRow(toggleRow(start, 'a'), 'a'))).toBe(false)
  })
})
