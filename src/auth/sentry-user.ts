import type { User } from '@/api/generated/model'

/** User gửi lên Sentry: chỉ UUID và role, không gửi email/số điện thoại. */
export function toSentryUser(user: User | null | undefined): { id: string; role?: string } | null {
  if (!user?.id) return null
  return user.role ? { id: user.id, role: user.role } : { id: user.id }
}
