/** Mô tả mã phản hồi VNPay (vnp_ResponseCode) bằng tiếng Việt cho trang trở về. */
const MESSAGES: Record<string, string> = {
  '07': 'Giao dịch bị nghi ngờ gian lận',
  '09': 'Thẻ/tài khoản chưa đăng ký dịch vụ',
  '10': 'Xác thực thẻ sai quá số lần',
  '11': 'Hết hạn chờ thanh toán',
  '12': 'Thẻ/tài khoản bị khoá',
  '13': 'Sai mật khẩu xác thực (OTP)',
  '24': 'Khách huỷ giao dịch',
  '51': 'Tài khoản không đủ số dư',
  '65': 'Vượt hạn mức giao dịch trong ngày',
  '75': 'Ngân hàng đang bảo trì',
  '79': 'Nhập sai mật khẩu thanh toán quá số lần',
  '99': 'Lỗi khác',
}

export function responseMessage(code: string | null | undefined): string {
  if (!code) return 'Chưa nhận được phản hồi'
  return MESSAGES[code] ?? 'Giao dịch không thành công'
}

export type ReturnKind = 'confirming' | 'failed'

/** Mã 00 = VNPay báo thành công (vẫn phải chờ IPN chốt đơn); mã khác = chưa thành công. */
export function returnKind(code: string | null | undefined): ReturnKind {
  return code === '00' ? 'confirming' : 'failed'
}

/**
 * Backend chỉ redirect về web kèm `?txn_ref=<mã đơn>-<lần thử>` (vd. VG123-1), không kèm order_id.
 * Mã đơn là phần trước hậu tố lần thử.
 */
export function orderCodeFromTxnRef(txnRef: string | null | undefined): string | undefined {
  if (!txnRef) return undefined
  const code = txnRef.replace(/-\d+$/, '')
  return code || undefined
}

const PAYING_KEY = 'vingo:paying-order'

/** Nhớ đơn đang sang VNPay để trang trả về tìm lại nhanh (không chứa token hay dữ liệu cá nhân). */
export function rememberPayingOrder(order: { id: string; code?: string }): void {
  try {
    sessionStorage.setItem(PAYING_KEY, JSON.stringify({ id: order.id, code: order.code }))
  } catch {
    /* trình duyệt chặn storage: trang trả về sẽ tìm đơn qua danh sách đơn */
  }
}

export function recallPayingOrder(code: string | undefined): string | undefined {
  try {
    const raw = sessionStorage.getItem(PAYING_KEY)
    if (!raw) return undefined
    const saved = JSON.parse(raw) as { id?: string; code?: string }
    return saved.id && saved.code && saved.code === code ? saved.id : undefined
  } catch {
    return undefined
  }
}

export type ReturnView = 'confirming' | 'failed' | 'paid' | 'review'

/**
 * Trang trả về chỉ hiển thị, quyết định theo trạng thái đơn và lần thanh toán đọc từ API.
 * - PAID → thành công; NEEDS_REVIEW → xem đơn; EXPIRED/CANCELLED hoặc lần thanh toán FAILED/EXPIRED → chưa thành công;
 * - còn lại (đơn PENDING, lần thanh toán OPEN/SUCCEEDED) → đang chờ IPN/đối soát chốt đơn.
 * `vnp_ResponseCode` (nếu có trên URL) chỉ dùng khi chưa đọc được gì từ API.
 */
export function returnView(
  order: { status?: string } | undefined,
  payment: { status?: string } | undefined,
  urlCode?: string | null,
): ReturnView {
  if (order?.status === 'PAID') return 'paid'
  if (order?.status === 'NEEDS_REVIEW') return 'review'
  if (order?.status === 'EXPIRED' || order?.status === 'CANCELLED') return 'failed'
  if (payment?.status === 'FAILED' || payment?.status === 'EXPIRED') return 'failed'
  if (!order && !payment && urlCode) return returnKind(urlCode)
  return 'confirming'
}
