import { describe, expect, it } from 'vitest'

import { buildIcs } from './ics'
import { maskEmail } from './mask'

describe('maskEmail', () => {
  it('giữ ký tự đầu và tên miền', () => {
    expect(maskEmail('minhanh@gmail.com')).toBe('m***@gmail.com')
  })
  it('trả chuỗi rỗng khi thiếu email', () => {
    expect(maskEmail(undefined)).toBe('')
  })
})

describe('buildIcs', () => {
  it('ghi giờ bắt đầu UTC và mặc định kết thúc sau 2 giờ', () => {
    const ics = buildIcs({ uid: 'a', title: 'HAGL, vs HN', startIso: '2026-11-21T10:00:00.000Z' })
    expect(ics).toContain('DTSTART:20261121T100000Z')
    expect(ics).toContain('DTEND:20261121T120000Z')
    expect(ics).toContain('SUMMARY:HAGL\\, vs HN')
  })
})
