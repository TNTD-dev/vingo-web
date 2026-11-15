import type { UserRole } from '@/api/generated/model'

const origin = 'https://vingo.invalid'
const authPaths = [
  '/login',
  '/admin/login',
  '/register',
  '/verify-otp',
  '/auth/google',
  '/forgot-password',
  '/reset-password',
]

/** Chọn trang đích theo quyền, chỉ nhận đường dẫn nội bộ và tránh quay lại luồng đăng nhập. */
export function loginDestination(role: UserRole | undefined, next?: string | null): string {
  const fallback = role === 'ADMIN' ? '/admin' : '/events'
  if (
    !next?.startsWith('/') ||
    next.startsWith('//') ||
    next.includes('\\') ||
    /\s/.test(next) ||
    hasControlCharacter(next)
  )
    return fallback
  try {
    const url = new URL(next, origin)
    const pathname = decodeURIComponent(url.pathname).replace(/\/+$/, '') || '/'
    if (url.origin !== origin || pathname.includes('\\') || hasControlCharacter(pathname) || pathname.startsWith('//'))
      return fallback
    if (pathname === '/') return fallback
    if (authPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`))) return fallback
    const admin = pathname === '/admin' || pathname.startsWith('/admin/')
    const checkin = pathname === '/checkin' || pathname.startsWith('/checkin/')
    if (role === 'ADMIN' ? !admin && !checkin : admin || checkin) return fallback
    return url.pathname + url.search + url.hash
  } catch {
    return fallback
  }
}

function hasControlCharacter(value: string): boolean {
  return Array.from(value).some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)
}
