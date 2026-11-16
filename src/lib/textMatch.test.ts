import { describe, expect, it } from 'vitest'

import { matchesQuery } from './textMatch'

describe('matchesQuery', () => {
  it('khớp không phân biệt dấu và hoa thường', () => {
    expect(matchesQuery('viet nam', 'Việt Nam vs Thái Lan')).toBe(true)
    expect(matchesQuery('dem', 'Đêm nhạc')).toBe(true)
    expect(matchesQuery('đêm', 'Dem nhac')).toBe(true)
  })
  it('mọi từ phải có mặt, ở trường nào cũng được', () => {
    expect(matchesQuery('hagl a1', 'HAGL vs HN', 'Khu A1')).toBe(true)
    expect(matchesQuery('hagl b9', 'HAGL vs HN', 'Khu A1')).toBe(false)
  })
  it('query rỗng khớp tất cả', () => {
    expect(matchesQuery('  ', 'bất kỳ')).toBe(true)
  })
})
