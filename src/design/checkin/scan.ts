import { checkIn } from '@/api/generated/endpoints/check-in/check-in'
import type { CheckinResult } from '@/api/generated/model'
import { ApiError, isApiError } from '@/api/problem'

export type ScanRequest = { qr_token: string; showtime_id: string; gate?: string }

/** Chữ hiển thị to ở cổng cho từng kết quả quét. */
export const scanLabels: Record<NonNullable<CheckinResult['result']>, string> = {
  OK: 'HỢP LỆ · CHO VÀO',
  ALREADY_USED: 'VÉ ĐÃ DÙNG',
  TICKET_VOID: 'VÉ ĐÃ HUỶ',
  WRONG_SHOWTIME: 'SAI SUẤT DIỄN',
}

/** Giải thích ngắn bên dưới chữ lớn, nhân viên cổng đọc là biết xử lý. */
export const scanHints: Record<NonNullable<CheckinResult['result']>, string> = {
  OK: 'Vé hợp lệ, đã ghi nhận vào cổng.',
  ALREADY_USED: 'Vé này đã được quét trước đó. Không cho vào.',
  TICKET_VOID: 'Vé đã bị vô hiệu hoá. Không cho vào.',
  WRONG_SHOWTIME: 'Vé thuộc suất diễn khác. Không cho vào.',
}

/** Contract: 409 trả CheckinResult (không phải Problem), nên http.ts ném ApiError mang body đó. */
export function resultFromConflict(error: unknown): CheckinResult | null {
  if (!isApiError(error) || error.status !== 409) return null
  const body: unknown = error.problem
  if (body && typeof body === 'object' && 'result' in body && typeof body.result === 'string') {
    return body as CheckinResult
  }
  return null
}

/** Quét vé; 409 từ chối quét được trả như kết quả bình thường, lỗi khác ném tiếp. */
export async function scanTicket(request: ScanRequest): Promise<CheckinResult> {
  try {
    return await checkIn(request)
  } catch (error) {
    const result = resultFromConflict(error)
    if (result) return result
    throw error
  }
}

/** Thông báo lỗi khi không quét được (không phải kết quả từ chối của vé). */
export function scanErrorText(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 404) return 'MÃ QR KHÔNG TỒN TẠI. Kiểm tra lại mã hoặc quét lại.'
    if (error.status === 403) return 'TÀI KHOẢN KHÔNG CÓ QUYỀN SOÁT VÉ. Đăng nhập bằng tài khoản quản trị.'
    if (error.status === 401) return 'PHIÊN ĐĂNG NHẬP ĐÃ HẾT. Đăng nhập lại để tiếp tục soát vé.'
    if (error.status === 400) return 'MÃ QR KHÔNG HỢP LỆ. Kiểm tra lại nội dung mã.'
    return 'KHÔNG QUÉT ĐƯỢC. Vui lòng thử lại.'
  }
  return 'KHÔNG KẾT NỐI ĐƯỢC. Kiểm tra mạng rồi quét lại.'
}
