import { useEffect } from 'react'
import { Navigate, useSearchParams } from 'react-router'

import { refreshSession } from '@/api/http'
import { useAuth } from '@/auth/auth-context'
import { Placeholder } from '@/design/Placeholder'

/**
 * Backend chuyển về /auth/google?google_login=success|created|failed|email_taken
 * và đã đặt cookie refresh HttpOnly. Đổi cookie lấy access token rồi về trang chủ.
 */
export default function GoogleCallbackPage() {
  const [params] = useSearchParams()
  const { user } = useAuth()
  const status = params.get('google_login')
  const ok = status === 'success' || status === 'created'

  useEffect(() => {
    if (ok) void refreshSession()
  }, [ok])

  if (ok && user) return <Navigate to="/" replace />
  return (
    <Placeholder title="Đăng nhập Google" operations={['refreshToken']}>
      {ok ? 'Đang đăng nhập…' : `Không đăng nhập được (${status ?? 'không rõ'}).`}
    </Placeholder>
  )
}
