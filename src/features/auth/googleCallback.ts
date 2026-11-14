/** Kết quả backend gắn vào `?google_login=` khi chuyển về web sau đăng nhập Google. */
export type GoogleOutcome = { kind: 'signed_in' } | { kind: 'error'; message: string }

const NEXT_KEY = 'vingo.google_next'

export function googleOutcome(status: string | null): GoogleOutcome {
  switch (status) {
    case 'success':
    case 'created':
      return { kind: 'signed_in' }
    case 'email_taken':
      return {
        kind: 'error',
        message: 'Email của tài khoản Google này đã đăng ký bằng mật khẩu. Vui lòng đăng nhập bằng email và mật khẩu.',
      }
    case 'failed':
      return {
        kind: 'error',
        message:
          'Không đăng nhập được bằng Google. Tài khoản Google có thể chưa được hỗ trợ hoặc bạn đã huỷ cấp quyền.',
      }
    default:
      return { kind: 'error', message: 'Liên kết đăng nhập Google không hợp lệ hoặc đã hết hạn.' }
  }
}

function safeNext(next: string | null | undefined): string | null {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : null
}

/** Ghi lại trang muốn quay về trước khi rời sang Google (chỉ là đường dẫn, không phải bí mật). */
export function rememberNext(next: string | null | undefined) {
  try {
    const safe = safeNext(next)
    if (safe) sessionStorage.setItem(NEXT_KEY, safe)
    else sessionStorage.removeItem(NEXT_KEY)
  } catch {
    // sessionStorage bị chặn: bỏ qua, quay về trang chủ.
  }
}

/** Đường dẫn đã ghi (không xoá); không có thì về trang chủ. */
export function peekNext(): string {
  try {
    return safeNext(sessionStorage.getItem(NEXT_KEY)) ?? '/'
  } catch {
    return '/'
  }
}

export function clearNext() {
  try {
    sessionStorage.removeItem(NEXT_KEY)
  } catch {
    // bỏ qua
  }
}
