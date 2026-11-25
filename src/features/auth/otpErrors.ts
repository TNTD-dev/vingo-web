import { isApiError } from '@/api/problem'

/** Lỗi POST /auth/register → câu tiếng Việt. Theo `code`, không dùng `detail`. */
export function registerErrorMessage(e: unknown): string {
  if (isApiError(e, 'EMAIL_TAKEN')) return 'Email này đã có tài khoản. Hãy đăng nhập hoặc dùng email khác.'
  if (isApiError(e, 'VALIDATION_ERROR')) return 'Thông tin chưa hợp lệ. Vui lòng kiểm tra lại các ô nhập.'
  if (isApiError(e, 'RATE_LIMITED')) return rateLimited('Bạn thử đăng ký quá nhiều lần.', e.retryAfter)
  if (isApiError(e, 'SERVICE_UNAVAILABLE') || (isApiError(e) && e.status === 503)) {
    return 'Chưa gửi được email chứa mã OTP. Vui lòng thử lại sau ít phút.'
  }
  return 'Chưa tạo được tài khoản. Vui lòng thử lại.'
}

function rateLimited(prefix: string, retryAfter?: number): string {
  return retryAfter ? `${prefix} Vui lòng thử lại sau ${retryAfter} giây.` : `${prefix} Vui lòng thử lại sau ít phút.`
}
