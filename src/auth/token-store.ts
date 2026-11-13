import type { User } from '@/api/generated/model'

/**
 * Giữ access token trong bộ nhớ (không localStorage). Refresh token:
 * - Google login: backend đặt cookie HttpOnly, web không thấy.
 * - Mật khẩu: backend trả trong JSON → giữ trong bộ nhớ, mất khi tải lại trang.
 */
type Session = { accessToken: string; refreshToken?: string; user: User }

let session: Session | null = null
const listeners = new Set<() => void>()

export const tokenStore = {
  get: () => session,
  set(next: Session | null) {
    session = next
    listeners.forEach((l) => l())
  },
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
}
