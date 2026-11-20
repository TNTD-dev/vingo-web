import type { BadgeTone } from '@/design/StatusBadge'

/** Nhãn tiếng Việt cho trạng thái đơn, vé và lý do cần duyệt; không để lộ tên kỹ thuật cho admin. */
export const stateLabels: Record<string, string> = {
  PENDING: 'Chờ thanh toán',
  PAID: 'Đã thanh toán',
  EXPIRED: 'Hết hạn',
  CANCELLED: 'Đã huỷ',
  NEEDS_REVIEW: 'Cần xử lý',
  REJECTED: 'Đã hoàn tiền',
  PAID_AFTER_EXPIRY: 'Tiền về sau hạn',
  PAID_AFTER_CANCEL: 'Tiền về sau khi huỷ',
  AMOUNT_MISMATCH: 'Sai số tiền',
  PAYMENT_SUSPECTED: 'Cần kiểm tra giao dịch',
  ISSUED: 'Hợp lệ',
  USED: 'Đã quét',
  VOID: 'Đã huỷ',
  DRAFT: 'Nháp',
  PUBLISHED: 'Đã công bố',
  ENDED: 'Đã kết thúc',
  SCHEDULED: 'Sắp mở bán',
  ON_SALE: 'Đang bán',
  SALES_CLOSED: 'Đã đóng bán',
  FINISHED: 'Đã diễn',
  OK: 'Hợp lệ',
  ALREADY_USED: 'Đã dùng',
  TICKET_VOID: 'Vé đã huỷ',
  WRONG_SHOWTIME: 'Sai suất',
  INVALID_QR: 'Mã QR không hợp lệ',
}

/** Tab trạng thái đơn: nhãn ngắn hơn nhãn huy hiệu. */
export const orderTabLabels: Record<string, string> = {
  '': 'Tất cả',
  NEEDS_REVIEW: 'Cần xử lý',
  PENDING: 'Chờ thanh toán',
  PAID: 'Đã thanh toán',
  EXPIRED: 'Hết hạn',
  CANCELLED: 'Đã huỷ',
  REJECTED: 'Hoàn tiền',
}

/** Màu chấm theo ý nghĩa: vé hợp lệ là trạng thái bình thường nên trung tính. */
export const stateTones: Record<string, BadgeTone> = {
  PUBLISHED: 'success',
  PAID: 'success',
  USED: 'success',
  ON_SALE: 'success',
  NEEDS_REVIEW: 'warning',
  HELD: 'warning',
  PAID_AFTER_EXPIRY: 'warning',
  PAID_AFTER_CANCEL: 'warning',
  PAYMENT_SUSPECTED: 'warning',
  ALREADY_USED: 'warning',
  PENDING: 'info',
  DRAFT: 'info',
  SCHEDULED: 'info',
  REJECTED: 'info',
  WRONG_SHOWTIME: 'info',
  CANCELLED: 'danger',
  VOID: 'danger',
  AMOUNT_MISMATCH: 'danger',
  TICKET_VOID: 'danger',
  OK: 'success',
}

export function stateLabel(value?: string | null): string {
  if (!value) return '—'
  return stateLabels[value] ?? value.replaceAll('_', ' ')
}
