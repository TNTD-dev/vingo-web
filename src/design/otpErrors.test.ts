import { describe, expect, it } from 'vitest'

import type { ProblemCode } from '@/api/generated/model'
import { ApiError } from '@/api/problem'
import { requestPhoneOtpMessage, resendOtpMessage, verifyOtpMessage, verifyPhoneOtpMessage } from '@/design/otpErrors'

const error = (status: number, code?: ProblemCode, retryAfter?: number) =>
  new ApiError(status, code ? { type: 'about:blank', title: 'Lỗi', status, code } : null, retryAfter)

const phoneTaken = 'Số điện thoại này đã được tài khoản khác xác minh. Hãy dùng số khác.'
const smsUnavailable = 'Chưa gửi được SMS. Vui lòng thử lại sau ít phút.'
const requestFallback = 'Chưa gửi được mã. Vui lòng thử lại.'
const verifyFallback = 'Chưa xác minh được. Vui lòng thử lại.'

describe('requestPhoneOtpMessage', () => {
  it('VALIDATION_ERROR giải thích định dạng số Việt Nam', () => {
    expect(requestPhoneOtpMessage(error(400, 'VALIDATION_ERROR'))).toEqual({
      message: 'Số điện thoại Việt Nam chưa hợp lệ, ví dụ 0912 345 678.',
    })
  })

  it('PHONE_TAKEN nói rõ số đã được tài khoản khác xác minh', () => {
    expect(requestPhoneOtpMessage(error(409, 'PHONE_TAKEN'))).toEqual({ message: phoneTaken })
  })

  it('RATE_LIMITED có Retry-After trả thông điệp và cooldown đúng số giây', () => {
    expect(requestPhoneOtpMessage(error(429, 'RATE_LIMITED', 90))).toEqual({
      message: 'Bạn thử quá nhiều lần. Vui lòng thử lại sau 90 giây.',
      cooldown: 90,
    })
  })

  it('RATE_LIMITED thiếu Retry-After yêu cầu chờ ít phút', () => {
    const result = requestPhoneOtpMessage(error(429, 'RATE_LIMITED'))
    expect(result.message).toBe('Bạn thử quá nhiều lần. Vui lòng thử lại sau ít phút.')
    expect(result.cooldown).toBeUndefined()
  })

  it('SERVICE_UNAVAILABLE được nhận bằng code dù status khác 503', () => {
    expect(requestPhoneOtpMessage(error(500, 'SERVICE_UNAVAILABLE')).message).toBe(smsUnavailable)
  })

  it('HTTP 503 không có code vẫn báo chưa gửi được SMS', () => {
    expect(requestPhoneOtpMessage(error(503)).message).toBe(smsUnavailable)
  })

  it('401 dùng thông điệp dự phòng', () => {
    expect(requestPhoneOtpMessage(error(401, 'UNAUTHORIZED')).message).toBe(requestFallback)
  })

  it('lỗi mạng dùng thông điệp dự phòng', () => {
    expect(requestPhoneOtpMessage(new Error('network')).message).toBe(requestFallback)
  })

  it('không suy đoán mã lỗi từ detail của backend', () => {
    const result = requestPhoneOtpMessage(
      new ApiError(400, { title: 'Lỗi', status: 400, code: 'VALIDATION_ERROR', detail: 'PHONE_TAKEN' }),
    )
    expect(result.message).toBe('Số điện thoại Việt Nam chưa hợp lệ, ví dụ 0912 345 678.')
  })
})

describe('verifyPhoneOtpMessage', () => {
  it('OTP_INVALID cho nhập lại, không yêu cầu gửi lại hay đổi số', () => {
    expect(verifyPhoneOtpMessage(error(400, 'OTP_INVALID'))).toEqual({
      message: 'Mã chưa đúng. Kiểm tra lại mã trong tin nhắn.',
      needsResend: false,
      changePhone: false,
    })
  })

  it('OTP_EXPIRED yêu cầu gửi mã mới', () => {
    expect(verifyPhoneOtpMessage(error(400, 'OTP_EXPIRED'))).toEqual({
      message: 'Mã đã hết hạn (hiệu lực 5 phút). Hãy gửi lại mã mới.',
      needsResend: true,
      changePhone: false,
    })
  })

  it('OTP_TOO_MANY_ATTEMPTS yêu cầu gửi lại sau năm lần sai', () => {
    expect(verifyPhoneOtpMessage(error(400, 'OTP_TOO_MANY_ATTEMPTS'))).toEqual({
      message: 'Bạn đã nhập sai quá 5 lần. Hãy gửi lại mã mới để tiếp tục.',
      needsResend: true,
      changePhone: false,
    })
  })

  it('PHONE_TAKEN yêu cầu quay về nhập số', () => {
    expect(verifyPhoneOtpMessage(error(409, 'PHONE_TAKEN'))).toEqual({
      message: phoneTaken,
      needsResend: false,
      changePhone: true,
    })
  })

  it('RATE_LIMITED có Retry-After trả đúng cooldown', () => {
    expect(verifyPhoneOtpMessage(error(429, 'RATE_LIMITED', 75))).toEqual({
      message: 'Bạn thử quá nhiều lần. Vui lòng thử lại sau 75 giây.',
      needsResend: false,
      changePhone: false,
      cooldown: 75,
    })
  })

  it('RATE_LIMITED không có Retry-After vẫn có thông điệp rõ ràng', () => {
    const result = verifyPhoneOtpMessage(error(429, 'RATE_LIMITED'))
    expect(result).toMatchObject({
      message: 'Bạn thử quá nhiều lần. Vui lòng thử lại sau ít phút.',
      needsResend: false,
      changePhone: false,
    })
    expect(result.cooldown).toBeUndefined()
  })

  it('VALIDATION_ERROR dùng thông điệp xác minh dự phòng', () => {
    expect(verifyPhoneOtpMessage(error(400, 'VALIDATION_ERROR'))).toEqual({
      message: verifyFallback,
      needsResend: false,
      changePhone: false,
    })
  })

  it('401 không yêu cầu gửi lại hoặc đổi số', () => {
    expect(verifyPhoneOtpMessage(error(401, 'UNAUTHORIZED'))).toEqual({
      message: verifyFallback,
      needsResend: false,
      changePhone: false,
    })
  })

  it('503 ở bước xác minh dùng thông điệp xác minh dự phòng', () => {
    expect(verifyPhoneOtpMessage(error(503, 'SERVICE_UNAVAILABLE')).message).toBe(verifyFallback)
  })

  it('lỗi không phải API dùng thông điệp xác minh dự phòng', () => {
    expect(verifyPhoneOtpMessage(new Error('network')).message).toBe(verifyFallback)
  })

  it('detail không được thay thế code trong quyết định gửi lại', () => {
    const result = verifyPhoneOtpMessage(
      new ApiError(400, { title: 'Lỗi', status: 400, code: 'OTP_INVALID', detail: 'OTP_EXPIRED' }),
    )
    expect(result).toEqual({
      message: 'Mã chưa đúng. Kiểm tra lại mã trong tin nhắn.',
      needsResend: false,
      changePhone: false,
    })
  })
})

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
    expect(requestPhoneOtpMessage(error(429, 'RATE_LIMITED', 600)).message).toContain('sau 10 phút')
    const m = requestPhoneOtpMessage(error(429, 'RATE_LIMITED', 31826))
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
