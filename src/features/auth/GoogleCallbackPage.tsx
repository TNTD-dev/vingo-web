import { useEffect, useState } from 'react'
import { Navigate } from 'react-router'
import { useSearchParams } from 'react-router'

import { signalSessionChange } from '@/auth/token-store'
import { loginDestination } from '@/auth/redirect'
import { useAuth } from '@/auth/auth-context'
import { SessionError } from '@/auth/SessionError'
import { ArrowButton } from '@/design/ArrowButton'
import { Mascot } from '@/design/Mascot'

import { AuthHeading, FormError } from './authUi'
import { clearNext, googleOutcome, peekNext } from './googleCallback'

/**
 * Backend chuyển về /auth/google?google_login=success|created|failed|email_taken
 * với cookie phiên. AuthProvider kiểm tra /me khi trình duyệt quay về.
 */
export default function GoogleCallbackPage() {
  const [params] = useSearchParams()
  const [next] = useState(peekNext)
  const { status, user } = useAuth()
  const outcome = googleOutcome(params.get('google_login'))
  const signedIn = outcome.kind === 'signed_in'
  useEffect(() => {
    if (status === 'ready' && signedIn && user) {
      clearNext()
      signalSessionChange()
    }
  }, [status, signedIn, user])

  if (status === 'ready' && signedIn && user) return <Navigate to={loginDestination(user.role, next)} replace />

  if (signedIn && status === 'error') return <SessionError />

  if (signedIn && status === 'loading') {
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
