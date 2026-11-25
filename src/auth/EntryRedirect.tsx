import type { ReactNode } from 'react'
import { Navigate, useSearchParams } from 'react-router'

import { useAuth } from './auth-context'
import { loginDestination } from './redirect'

/** Trang công khai hiện ngay; chỉ chuyển ADMIN khi đã xác định được phiên. */
export function EntryRedirect({ children }: { children: ReactNode }) {
  const { status, user } = useAuth()
  const [params] = useSearchParams()
  if (status === 'ready' && user?.role === 'ADMIN')
    return <Navigate to={loginDestination(user.role, params.get('next'))} replace />
  return children
}
