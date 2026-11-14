import { beforeEach, describe, expect, it } from 'vitest'

import { clearOtpSession, loadOtpSession, safeNext, saveOtpSession } from './otpSession'

beforeEach(() => sessionStorage.clear())

describe('otpSession', () => {
  it('lưu rồi đọc lại đúng phiên (tải lại trang vẫn còn)', () => {
    saveOtpSession({ sessionId: 's1', email: 'a@b.vn', sentAt: 5, next: '/events/1' })
    expect(loadOtpSession()).toEqual({
      sessionId: 's1',
      email: 'a@b.vn',
      expiresAt: undefined,
      sentAt: 5,
      next: '/events/1',
    })
  })
  it('xoá phiên thì không còn', () => {
    saveOtpSession({ sessionId: 's1', email: '', sentAt: 1 })
    clearOtpSession()
    expect(loadOtpSession()).toBeNull()
  })
  it('dữ liệu hỏng hoặc thiếu sessionId thì coi như không có phiên', () => {
    sessionStorage.setItem('vingo.otp_session', '{bad')
    expect(loadOtpSession()).toBeNull()
    sessionStorage.setItem('vingo.otp_session', JSON.stringify({ email: 'x' }))
    expect(loadOtpSession()).toBeNull()
  })
  it('safeNext chỉ nhận đường dẫn nội bộ', () => {
    expect(safeNext('/events/1')).toBe('/events/1')
    expect(safeNext('//evil.com')).toBeUndefined()
    expect(safeNext('https://evil.com')).toBeUndefined()
    expect(safeNext(null)).toBeUndefined()
  })
})
