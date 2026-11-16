import type { ReactNode } from 'react'
import { Navigate, useSearchParams } from 'react-router'

import { FullPageSpinner } from '@/design/FullPageSpinner'
import { useAuth } from './auth-context'
import { loginDestination } from './redirect'

/** Đợi khôi phục phiên trước khi quyết định trang chủ hoặc trang đăng nhập cho ADMIN. */
export function EntryRedirect({ children }: { children: ReactNode }) {
  const { ready, user } = useAuth()
  const [params] = useSearchParams()
  if (!ready) return <FullPageSpinner />
  if (user?.role === 'ADMIN') return <Navigate to={loginDestination(user.role, params.get('next'))} replace />
  return children
}
