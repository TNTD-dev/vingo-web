import { describe, expect, it } from 'vitest'

import type { ProblemCode } from '@/api/generated/model'
import { ApiError } from '@/api/problem'
import { resendOtpMessage, verifyOtpMessage } from '@/design/otpErrors'

const error = (status: number, code?: ProblemCode, retryAfter?: number) =>
  new ApiError(status, code ? { type: 'about:blank', title: 'Lỗi', status, code } : null, retryAfter)

describe('verifyOtpMessage', () => {
  it('OTP_INVALID không bắt gửi lại', () => {
    const m = verifyOtpMessage(error(400, 'OTP_INVALID'))
    expect(m.needsResend).toBe(false)
    expect(m.message).toMatch(/chưa đúng/)
  })
  it('OTP_EXPIRED và OTP_TOO_MANY_ATTEMPTS gợi ý gửi lại mã', () => {
    for (const code of ['OTP_EXPIRED', 'OTP_TOO_MANY_ATTEMPTS'] as const) {
      const m = verifyOtpMessage(error(400, code))
      expect(m.needsResend).toBe(true)
      expect(m.message).toMatch(/gửi lại/)
    }
  })
})

describe('resendOtpMessage', () => {
  it('Retry-After dài đổi sang phút hoặc giờ cho dễ đọc', () => {
    expect(resendOtpMessage(error(429, 'RATE_LIMITED', 600)).message).toContain('sau 10 phút')
    const m = resendOtpMessage(error(429, 'RATE_LIMITED', 31826))
    expect(m.message).toContain('sau khoảng 9 giờ')
    expect(m.cooldown).toBe(31826)
  })

  it('429 trả số giây chờ theo Retry-After', () => {
    const m = resendOtpMessage(error(429, 'RATE_LIMITED', 45))
    expect(m.cooldown).toBe(45)
    expect(m.message).toContain('45 giây')
  })
  it('429 không có Retry-After vẫn có câu rõ ràng', () => {
    const m = resendOtpMessage(error(429, 'RATE_LIMITED'))
    expect(m.cooldown).toBeUndefined()
    expect(m.message).toMatch(/3 lần/)
  })
  it('phiên không hợp lệ bảo đăng ký lại', () => {
    expect(resendOtpMessage(error(400, 'OTP_INVALID')).message).toMatch(/đăng ký lại/)
  })
  it('503 nói email chưa gửi được', () => {
    expect(resendOtpMessage(error(503, 'SERVICE_UNAVAILABLE')).message).toMatch(/Chưa gửi được email/)
  })
})
