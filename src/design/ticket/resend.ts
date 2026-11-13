import { isApiError } from '@/api/problem'

/** "25 phút", "1 giờ", "45 giây": đủ dùng cho thời gian chờ Retry-After. */
export function formatWait(seconds: number): string {
  if (seconds < 60) return `${seconds} giây`
  const minutes = Math.ceil(seconds / 60)
  if (minutes < 60) return `${minutes} phút`
  return `${Math.ceil(minutes / 60)} giờ`
}

/** Câu báo lỗi khi gửi lại vé (POST /tickets/{id}/resend). Xử lý theo mã lỗi, không theo chuỗi detail. */
export function resendErrorMessage(error: unknown): string {
  if (isApiError(error, 'RATE_LIMITED') || (isApiError(error) && error.status === 429)) {
    const wait = isApiError(error) && error.retryAfter ? ` sau ${formatWait(error.retryAfter)}` : ' sau ít phút'
    return `Bạn đã gửi lại vé quá 3 lần trong 1 giờ. Vui lòng thử lại${wait}.`
  }
  if (isApiError(error, 'ORDER_STATE_INVALID')) {
    return error.problem?.detail ?? 'Vé này hiện chưa thể gửi qua email.'
  }
  if (isApiError(error, 'NOT_FOUND') || isApiError(error, 'FORBIDDEN')) return 'Không tìm thấy vé.'
  return 'Chưa gửi được email, thử lại sau.'
}
