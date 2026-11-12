import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'

import type { UserRole } from '@/api/generated/model'
import { FullPageSpinner } from '@/design/FullPageSpinner'

import { useAuth } from './auth-context'

/** Chưa đăng nhập → /login?next=...; sai vai trò → /403. */
export function RequireAuth({ allow, children }: { allow?: UserRole; children: ReactNode }) {
  const { ready, user } = useAuth()
  const location = useLocation()

  if (!ready) return <FullPageSpinner />
  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/login?next=${next}`} replace />
  }
  if (allow && user.role !== allow) return <Navigate to="/403" replace />
  return children
}
