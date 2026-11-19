import { isApiError } from '@/api/problem'

const PHONE_TAKEN = 'Số điện thoại này đã được tài khoản khác xác minh. Hãy dùng số khác.'
const SMS_UNAVAILABLE = 'Chưa gửi được SMS. Vui lòng thử lại sau ít phút.'

function rateLimited(retryAfter?: number): string {
  return `Bạn thử quá nhiều lần. Vui lòng thử lại sau ${waitText(retryAfter)}.`
}

/** Retry-After (giây) → câu dễ đọc: hạn mức 24 giờ có thể trả hàng chục nghìn giây. */
function waitText(seconds?: number): string {
  if (!seconds) return 'ít phút'
  if (seconds < 120) return `${seconds} giây`
  if (seconds < 3600) return `${Math.ceil(seconds / 60)} phút`
  return `khoảng ${Math.ceil(seconds / 3600)} giờ`
}

function smsUnavailable(error: unknown): boolean {
  return isApiError(error, 'SERVICE_UNAVAILABLE') || (isApiError(error) && error.status === 503)
}

/** Lỗi POST /me/phone/otp → câu tiếng Việt; `cooldown` (giây) khi backend yêu cầu chờ. Theo `code`, không theo `detail`. */
export function requestPhoneOtpMessage(error: unknown): { message: string; cooldown?: number } {
  if (isApiError(error, 'VALIDATION_ERROR'))
    return { message: 'Số điện thoại Việt Nam chưa hợp lệ, ví dụ 0912 345 678.' }
  if (isApiError(error, 'PHONE_TAKEN')) return { message: PHONE_TAKEN }
  if (isApiError(error, 'RATE_LIMITED')) {
    return error.retryAfter
      ? { message: rateLimited(error.retryAfter), cooldown: error.retryAfter }
      : { message: rateLimited() }
  }
  if (smsUnavailable(error)) return { message: SMS_UNAVAILABLE }
  return { message: 'Chưa gửi được mã. Vui lòng thử lại.' }
}

/** Lỗi POST /me/phone/verify: gợi ý gửi lại mã (hết hạn, sai quá nhiều) hoặc quay về nhập số (PHONE_TAKEN). */
export function verifyPhoneOtpMessage(error: unknown): {
  message: string
  needsResend: boolean
  changePhone: boolean
  cooldown?: number
} {
  if (isApiError(error, 'OTP_INVALID')) {
    return { message: 'Mã chưa đúng. Kiểm tra lại mã trong tin nhắn.', needsResend: false, changePhone: false }
  }
  if (isApiError(error, 'OTP_EXPIRED')) {
    return { message: 'Mã đã hết hạn (hiệu lực 5 phút). Hãy gửi lại mã mới.', needsResend: true, changePhone: false }
  }
  if (isApiError(error, 'OTP_TOO_MANY_ATTEMPTS')) {
    return {
      message: 'Bạn đã nhập sai quá 5 lần. Hãy gửi lại mã mới để tiếp tục.',
      needsResend: true,
      changePhone: false,
    }
  }
  if (isApiError(error, 'PHONE_TAKEN')) return { message: PHONE_TAKEN, needsResend: false, changePhone: true }
  if (isApiError(error, 'RATE_LIMITED')) {
    return error.retryAfter
      ? { message: rateLimited(error.retryAfter), needsResend: false, changePhone: false, cooldown: error.retryAfter }
      : { message: rateLimited(), needsResend: false, changePhone: false }
  }
  return { message: 'Chưa xác minh được. Vui lòng thử lại.', needsResend: false, changePhone: false }
}

/** Lỗi POST /auth/otp/verify (email kích hoạt tài khoản); `needsResend` để gợi ý gửi lại mã. */
export function verifyOtpMessage(e: unknown): { message: string; needsResend: boolean } {
  if (isApiError(e, 'OTP_INVALID'))
    return { message: 'Mã OTP chưa đúng. Kiểm tra lại mã trong email.', needsResend: false }
  if (isApiError(e, 'OTP_EXPIRED')) {
    return { message: 'Mã OTP đã hết hạn (hiệu lực 5 phút). Hãy gửi lại mã mới.', needsResend: true }
  }
  if (isApiError(e, 'OTP_TOO_MANY_ATTEMPTS')) {
    return { message: 'Bạn đã nhập sai quá 5 lần. Hãy gửi lại mã mới để tiếp tục.', needsResend: true }
  }
  if (isApiError(e, 'RATE_LIMITED')) return { message: rateLimited(e.retryAfter), needsResend: false }
  return { message: 'Chưa xác thực được. Vui lòng thử lại.', needsResend: false }
}

/** Lỗi POST /auth/otp/resend (email); `cooldown` (giây) khi backend yêu cầu chờ. */
export function resendOtpMessage(e: unknown): { message: string; cooldown?: number } {
  if (isApiError(e, 'RATE_LIMITED')) {
    return {
      message: `Bạn đã gửi lại mã quá nhiều lần (tối đa 3 lần mỗi 15 phút). Vui lòng thử lại sau ${waitText(e.retryAfter)}.`,
      cooldown: e.retryAfter,
    }
  }
  if (isApiError(e, 'SERVICE_UNAVAILABLE') || (isApiError(e) && e.status === 503)) {
    return { message: 'Chưa gửi được email chứa mã OTP. Vui lòng thử lại sau ít phút.' }
  }
  if (isApiError(e, 'OTP_INVALID') || isApiError(e, 'NOT_FOUND')) {
    return { message: 'Phiên xác thực không còn hiệu lực. Vui lòng đăng ký lại.' }
  }
  return { message: 'Chưa gửi lại được mã. Vui lòng thử lại sau ít phút.' }
}
