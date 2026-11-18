import { describe, expect, it } from 'vitest'

import { formatNationalPhone, formatPhone, needsPhoneVerification, normalizeVnMobile } from '@/lib/phoneVerification'

describe('normalizeVnMobile', () => {
  it.each([
    '0912345678',
    '0912 345 678',
    '0912.345-678',
    '+84912345678',
    '+84 912 345 678',
    '84912345678',
    '912345678',
  ])('chuẩn hoá %s về +84912345678', (input) => {
    expect(normalizeVnMobile(input)).toBe('+84912345678')
  })

  it.each(['', '123', '0212345678', '+84112345678', '+12025550123', '0912abc678', '09123456789', '84 91234567'])(
    'từ chối %s vì không phải số di động Việt Nam',
    (input) => {
      expect(normalizeVnMobile(input)).toBeNull()
    },
  )

  it.each(['32', '52', '72', '82', '92'])('nhận đầu số di động 0%s', (prefix) => {
    expect(normalizeVnMobile(`0${prefix}3456789`)).toBe(`+84${prefix}3456789`)
  })
})

describe('formatPhone', () => {
  it('nhóm số +84 thành ba cụm ba chữ số', () => {
    expect(formatPhone('+84912345678')).toBe('+84 912 345 678')
  })

  it('giữ nguyên chuỗi không đúng dạng và trả rỗng khi thiếu', () => {
    expect(formatPhone('0912345678')).toBe('0912345678')
    expect(formatPhone(undefined)).toBe('')
    expect(formatPhone(null)).toBe('')
  })
})

describe('formatNationalPhone', () => {
  it('đổi E.164 sang dạng điền sẵn có số 0 đầu', () => {
    expect(formatNationalPhone('+84912345678')).toBe('0912 345 678')
  })

  it('trả rỗng với số không phải di động Việt Nam hoặc thiếu', () => {
    expect(formatNationalPhone('+12025550123')).toBe('')
    expect(formatNationalPhone('0212345678')).toBe('')
    expect(formatNationalPhone(undefined)).toBe('')
  })
})

describe('needsPhoneVerification', () => {
  it('BUYER có phone_verified=false cần xác minh', () => {
    expect(needsPhoneVerification({ role: 'BUYER', phone_verified: false })).toBe(true)
  })

  it('BUYER đã xác minh không bị chặn', () => {
    expect(needsPhoneVerification({ role: 'BUYER', phone_verified: true })).toBe(false)
  })

  it('BUYER thiếu cờ vẫn tương thích backend và mock cũ', () => {
    expect(needsPhoneVerification({ role: 'BUYER' })).toBe(false)
  })

  it('ADMIN được miễn dù phone_verified=false', () => {
    expect(needsPhoneVerification({ role: 'ADMIN', phone_verified: false })).toBe(false)
  })

  it('không có user thì không yêu cầu xác minh điện thoại', () => {
    expect(needsPhoneVerification(null)).toBe(false)
  })
})
