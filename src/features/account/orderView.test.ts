import { describe, expect, it } from 'vitest'

import { ticketCount } from './orderView'

describe('ticketCount', () => {
  it('cộng số lượng của từng dòng', () => {
    expect(ticketCount({ items: [{ quantity: 1 }, { quantity: 3 }, {}] })).toBe(5)
  })
  it('đơn không có dòng nào thì là 0', () => {
    expect(ticketCount({})).toBe(0)
  })
})
