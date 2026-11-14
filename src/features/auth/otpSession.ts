/**
 * Phiên OTP đang chờ xác thực, giữ trong sessionStorage để tải lại trang không mất
 * (mất khi đóng tab). Chỉ chứa mã phiên, email, hạn, thời điểm gửi gần nhất và trang cần quay về;
 * không bao giờ chứa mã OTP hay mật khẩu.
 */
export type OtpSession = {
  sessionId: string
  email: string
  /** Hạn của mã (ISO). */
  expiresAt?: string
  /** Lần gửi mã gần nhất (ms), để tính đếm ngược gửi lại. */
  sentAt: number
  next?: string
}

const KEY = 'vingo.otp_session'

export function loadOtpSession(): OtpSession | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    const v = JSON.parse(raw) as Partial<OtpSession>
    if (typeof v.sessionId !== 'string' || !v.sessionId) return null
    return {
      sessionId: v.sessionId,
      email: typeof v.email === 'string' ? v.email : '',
      expiresAt: typeof v.expiresAt === 'string' ? v.expiresAt : undefined,
      sentAt: typeof v.sentAt === 'number' ? v.sentAt : 0,
      next: typeof v.next === 'string' ? v.next : undefined,
    }
  } catch {
    return null
  }
}

export function saveOtpSession(session: OtpSession) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(session))
  } catch {
    // sessionStorage bị chặn: vẫn dùng được trong lần điều hướng này, chỉ mất khi tải lại.
  }
}

export function clearOtpSession() {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    // bỏ qua
  }
}

/** Chỉ nhận đường dẫn nội bộ để tránh chuyển hướng ra ngoài. */
export function safeNext(next: string | null | undefined): string | undefined {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : undefined
}
