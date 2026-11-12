import { describe, expect, it } from 'vitest'

import { formatVnd } from './money'
import { formatDateTime } from './time'

describe('format', () => {
  it('formatVnd hiển thị số nguyên VND', () => {
    expect(formatVnd(1_500_000).replace(/\s/g, ' ')).toBe('1.500.000 ₫')
  })

  it('formatDateTime đổi UTC sang giờ Việt Nam', () => {
    expect(formatDateTime('2026-11-14T12:30:00Z')).toBe('19:30 14/11/2026')
  })
})
