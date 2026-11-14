import { isApiError } from '@/api/problem'

/** Lỗi POST /auth/register → câu tiếng Việt. Theo `code`, không dùng `detail`. */
export function registerErrorMessage(e: unknown): string {
  if (isApiError(e, 'EMAIL_TAKEN')) return 'Email này đã có tài khoản. Hãy đăng nhập hoặc dùng email khác.'
  if (isApiError(e, 'PHONE_TAKEN')) return 'Số điện thoại này đã có tài khoản. Hãy đăng nhập hoặc dùng số khác.'
  if (isApiError(e, 'VALIDATION_ERROR')) return 'Thông tin chưa hợp lệ. Vui lòng kiểm tra lại các ô nhập.'
  if (isApiError(e, 'RATE_LIMITED')) return rateLimited('Bạn thử đăng ký quá nhiều lần.', e.retryAfter)
  if (isApiError(e, 'SERVICE_UNAVAILABLE') || (isApiError(e) && e.status === 503)) {
    return 'Chưa gửi được email chứa mã OTP. Vui lòng thử lại sau ít phút.'
  }
  return 'Chưa tạo được tài khoản. Vui lòng thử lại.'
}

/** Lỗi POST /auth/otp/verify. `expired` cho trang gợi ý gửi lại mã. */
export function verifyOtpMessage(e: unknown): { message: string; needsResend: boolean } {
  if (isApiError(e, 'OTP_INVALID'))
    return { message: 'Mã OTP chưa đúng. Kiểm tra lại mã trong email.', needsResend: false }
  if (isApiError(e, 'OTP_EXPIRED')) {
    return { message: 'Mã OTP đã hết hạn (hiệu lực 5 phút). Hãy gửi lại mã mới.', needsResend: true }
  }
  if (isApiError(e, 'OTP_TOO_MANY_ATTEMPTS')) {
    return { message: 'Bạn đã nhập sai quá 5 lần. Hãy gửi lại mã mới để tiếp tục.', needsResend: true }
  }
  if (isApiError(e, 'RATE_LIMITED'))
    return { message: rateLimited('Bạn thử quá nhiều lần.', e.retryAfter), needsResend: false }
  return { message: 'Chưa xác thực được. Vui lòng thử lại.', needsResend: false }
}

/** Lỗi POST /auth/otp/resend. `cooldown` (giây) khi backend yêu cầu chờ. */
export function resendOtpMessage(e: unknown): { message: string; cooldown?: number } {
  if (isApiError(e, 'RATE_LIMITED')) {
    return {
      message: rateLimited('Bạn đã gửi lại mã quá nhiều lần (tối đa 3 lần mỗi 15 phút).', e.retryAfter),
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

function rateLimited(prefix: string, retryAfter?: number): string {
  return retryAfter ? `${prefix} Vui lòng thử lại sau ${retryAfter} giây.` : `${prefix} Vui lòng thử lại sau ít phút.`
}
