import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'

import type { UserRole } from '@/api/generated/model'
import { FullPageSpinner } from '@/design/FullPageSpinner'

import { useAuth } from './auth-context'
import { SessionError } from './SessionError'

/** Chưa đăng nhập → /login?next=...; sai vai trò → /403. */
export function RequireAuth({ allow, children }: { allow?: UserRole; children: ReactNode }) {
  const { status, user } = useAuth()
  const location = useLocation()

  if (status === 'loading') return <FullPageSpinner />
  if (status === 'error') return <SessionError />
  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search + location.hash)
    return <Navigate to={`/login?next=${next}`} replace />
  }
  if (allow && user.role !== allow) return <Navigate to="/403" replace />
  return children
}
