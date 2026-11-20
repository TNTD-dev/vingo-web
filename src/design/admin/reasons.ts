import type { OrderReviewReason } from '@/api/generated/model'

/** Một câu giải thích vì sao đơn cần duyệt và nên làm gì. */
export function reasonHint(reason?: OrderReviewReason): string {
  switch (reason) {
    case 'PAID_AFTER_EXPIRY':
      return 'Tiền đã về sau khi hết hạn giữ ghế. Kiểm tra ghế còn trống rồi phát vé thủ công hoặc ghi nhận hoàn tiền thủ công để đối soát.'
    case 'PAID_AFTER_CANCEL':
      return 'Tiền đã về sau khi đơn bị huỷ. Kiểm tra ghế còn trống rồi phát vé thủ công hoặc ghi nhận hoàn tiền thủ công để đối soát.'
    case 'AMOUNT_MISMATCH':
      return 'Số tiền VNPay nhận không khớp số tiền của đơn. Đối chiếu giao dịch trước khi quyết định.'
    case 'PAYMENT_SUSPECTED':
      return 'Giao dịch thanh toán cần được kiểm tra thủ công trước khi quyết định.'
    default:
      return 'Đơn cần được kiểm tra thủ công trước khi quyết định.'
  }
}

/** Tiêu đề ngắn của đơn cần duyệt; `lateMinutes` là số phút tiền về trễ so với hạn giữ ghế (nếu tính được). */
export function reasonHeadline(reason?: OrderReviewReason, lateMinutes?: number | null): string {
  switch (reason) {
    case 'PAID_AFTER_EXPIRY':
      return lateMinutes && lateMinutes > 0
        ? `Tiền về trễ ${lateMinutes} phút sau khi hết hạn giữ ghế`
        : 'Tiền về sau khi hết hạn giữ ghế'
    case 'PAID_AFTER_CANCEL':
      return 'Tiền về sau khi đơn đã bị huỷ'
    case 'AMOUNT_MISMATCH':
      return 'Số tiền khách trả không khớp với đơn'
    case 'PAYMENT_SUSPECTED':
      return 'Giao dịch thanh toán cần kiểm tra'
    default:
      return 'Đơn cần được duyệt'
  }
}

/** Tiêu đề tóm tắt cho đơn không ở trạng thái cần duyệt. */
export function orderHeadline(status?: string): string {
  switch (status) {
    case 'PAID':
      return 'Đơn đã thanh toán'
    case 'PENDING':
      return 'Đơn đang chờ thanh toán'
    case 'EXPIRED':
      return 'Đơn đã hết hạn giữ ghế'
    case 'CANCELLED':
      return 'Đơn đã huỷ'
    case 'REJECTED':
      return 'Đơn đã ghi nhận hoàn tiền thủ công'
    default:
      return 'Chi tiết đơn hàng'
  }
}
