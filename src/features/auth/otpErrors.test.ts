import { describe, expect, it } from 'vitest'

import type { ProblemCode } from '@/api/generated/model'
import { ApiError } from '@/api/problem'

import { registerErrorMessage, resendOtpMessage, verifyOtpMessage } from './otpErrors'

const err = (status: number, code?: ProblemCode, retryAfter?: number) =>
  new ApiError(status, code ? ({ type: 'x', title: 't', status, code } as never) : null, retryAfter)

describe('registerErrorMessage', () => {
  it('EMAIL_TAKEN gợi ý đăng nhập', () => {
    expect(registerErrorMessage(err(409, 'EMAIL_TAKEN'))).toMatch(/Email.*đăng nhập/)
  })
  it('PHONE_TAKEN nói rõ số điện thoại', () => {
    expect(registerErrorMessage(err(409, 'PHONE_TAKEN'))).toMatch(/Số điện thoại/)
  })
  it('503 nói email chưa gửi được', () => {
    expect(registerErrorMessage(err(503, 'SERVICE_UNAVAILABLE'))).toMatch(/Chưa gửi được email/)
    expect(registerErrorMessage(err(503))).toMatch(/Chưa gửi được email/)
  })
  it('429 hiện số giây chờ khi có Retry-After', () => {
    expect(registerErrorMessage(err(429, 'RATE_LIMITED', 30))).toContain('30 giây')
  })
  it('VALIDATION_ERROR và lỗi lạ có câu mặc định', () => {
    expect(registerErrorMessage(err(400, 'VALIDATION_ERROR'))).toMatch(/chưa hợp lệ/)
    expect(registerErrorMessage(new Error('x'))).toMatch(/Chưa tạo được/)
  })
})

describe('verifyOtpMessage', () => {
  it('OTP_INVALID không bắt gửi lại', () => {
    const m = verifyOtpMessage(err(400, 'OTP_INVALID'))
    expect(m.needsResend).toBe(false)
    expect(m.message).toMatch(/chưa đúng/)
  })
  it('OTP_EXPIRED và OTP_TOO_MANY_ATTEMPTS gợi ý gửi lại mã', () => {
    for (const code of ['OTP_EXPIRED', 'OTP_TOO_MANY_ATTEMPTS'] as const) {
      const m = verifyOtpMessage(err(400, code))
      expect(m.needsResend).toBe(true)
      expect(m.message).toMatch(/gửi lại/)
    }
  })
})

describe('resendOtpMessage', () => {
  it('429 trả số giây chờ theo Retry-After', () => {
    const m = resendOtpMessage(err(429, 'RATE_LIMITED', 45))
    expect(m.cooldown).toBe(45)
    expect(m.message).toContain('45 giây')
  })
  it('429 không có Retry-After vẫn có câu rõ ràng', () => {
    const m = resendOtpMessage(err(429, 'RATE_LIMITED'))
    expect(m.cooldown).toBeUndefined()
    expect(m.message).toMatch(/3 lần/)
  })
  it('phiên không hợp lệ bảo đăng ký lại', () => {
    expect(resendOtpMessage(err(400, 'OTP_INVALID')).message).toMatch(/đăng ký lại/)
  })
  it('503 nói email chưa gửi được', () => {
    expect(resendOtpMessage(err(503, 'SERVICE_UNAVAILABLE')).message).toMatch(/Chưa gửi được email/)
  })
})
