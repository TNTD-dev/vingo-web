import { useEffect, useState } from 'react'
import { Navigate } from 'react-router'
import { useSearchParams } from 'react-router'

import { refreshSession } from '@/api/http'
import { useAuth } from '@/auth/auth-context'
import { ArrowButton } from '@/design/ArrowButton'
import { Mascot } from '@/design/Mascot'

import { AuthHeading, FormError } from './authUi'
import { clearNext, googleOutcome, peekNext } from './googleCallback'

/**
 * Backend chuyển về /auth/google?google_login=success|created|failed|email_taken
 * và đã đặt cookie refresh HttpOnly. Đổi cookie lấy access token rồi về trang trước (hoặc trang chủ).
 */
export default function GoogleCallbackPage() {
  const [params] = useSearchParams()
  const { user } = useAuth()
  const outcome = googleOutcome(params.get('google_login'))
  const signedIn = outcome.kind === 'signed_in'
  const [refreshFailed, setRefreshFailed] = useState(false)

  useEffect(() => {
    if (!signedIn) return
    let cancelled = false
    void refreshSession().then((ok) => {
      if (!cancelled && !ok) setRefreshFailed(true)
    })
    return () => {
      cancelled = true
    }
  }, [signedIn])

  useEffect(() => {
    if (signedIn && user) clearNext()
  }, [signedIn, user])

  if (signedIn && user) return <Navigate to={peekNext()} replace />

  if (signedIn && !refreshFailed) {
    return (
      <output className="flex flex-col gap-5">
        <AuthHeading eyebrow="Google" title="Đang đăng nhập…" hint="Vingo đang hoàn tất phiên đăng nhập của bạn." />
      </output>
    )
  }

  const message =
    outcome.kind === 'error' ? outcome.message : 'Không hoàn tất được phiên đăng nhập. Vui lòng thử đăng nhập lại.'
  return (
    <div className="flex flex-col gap-5">
      <Mascot state="sorry" className="h-[72px] w-auto self-start" />
      <AuthHeading eyebrow="Google" title="Chưa đăng nhập được" />
      <FormError>{message}</FormError>
      <ArrowButton variant="primary" to="/login" className="w-full">
        Quay lại đăng nhập
      </ArrowButton>
    </div>
  )
}
