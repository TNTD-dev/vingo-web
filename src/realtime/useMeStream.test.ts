import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'

import { invalidateFor } from './useMeStream'

function seeded() {
  const qc = new QueryClient()
  qc.setQueryData(['/orders/abc'], { status: 'PENDING' })
  qc.setQueryData(['/orders', { limit: 20 }], { data: [] })
  qc.setQueryData(['/tickets'], { data: [] })
  qc.setQueryData(['/events'], { data: [] })
  return qc
}
const stale = (qc: QueryClient, key: unknown[]) => qc.getQueryState(key)?.isInvalidated

describe('invalidateFor', () => {
  it('order.paid làm mới đơn (chi tiết, danh sách) và vé vì vé phát hành sau thanh toán', () => {
    const qc = seeded()
    invalidateFor('order.paid', qc)
    expect(stale(qc, ['/orders/abc'])).toBe(true)
    expect(stale(qc, ['/orders', { limit: 20 }])).toBe(true)
    expect(stale(qc, ['/tickets'])).toBe(true)
    expect(stale(qc, ['/events'])).toBe(false)
  })
  it('order.expired không đụng tới vé', () => {
    const qc = seeded()
    invalidateFor('order.expired', qc)
    expect(stale(qc, ['/orders/abc'])).toBe(true)
    expect(stale(qc, ['/tickets'])).toBe(false)
  })
  it('ticket.issued chỉ làm mới vé', () => {
    const qc = seeded()
    invalidateFor('ticket.issued', qc)
    expect(stale(qc, ['/tickets'])).toBe(true)
    expect(stale(qc, ['/orders/abc'])).toBe(false)
  })
})
