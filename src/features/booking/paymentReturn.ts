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
