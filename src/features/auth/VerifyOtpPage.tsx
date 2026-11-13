import { useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router'
import { toast } from 'sonner'

import { resendOtp, verifyOtp } from '@/api/generated/endpoints/auth/auth'
import { isApiError, isNotImplemented, NOT_IMPLEMENTED_MESSAGE } from '@/api/problem'
import { tokenStore } from '@/auth/token-store'
import { ArrowButton } from '@/design/ArrowButton'
import { OtpInput } from '@/design/OtpInput'
import { StatusBadge } from '@/design/StatusBadge'
import { formatCountdown, remainingSeconds } from '@/lib/countdown'
import { maskEmail } from '@/lib/mask'
import { useNow } from '@/lib/useNow'

import { AuthHeading, FormError } from './authUi'

const RESEND_COOLDOWN_MS = 60_000

// B8 · Bước 2 xác thực OTP (Figma 03 · Buyer): kích hoạt tài khoản vừa đăng ký rồi vào thẳng ứng dụng.
export default function VerifyOtpPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const session = params.get('session')
  const email = params.get('email') ?? ''
  const [expiresAt, setExpiresAt] = useState(params.get('exp'))
  const [otp, setOtp] = useState('')
  const [error, setError] = useState<string>()
  const [pending, setPending] = useState(false)
  const [resentAt, setResentAt] = useState(() => Date.now())
  const now = useNow()

  if (!session) return <Navigate to="/register" replace />

  const left = expiresAt ? remainingSeconds(expiresAt, now) : undefined
  const cooldown = Math.max(0, Math.ceil((resentAt + RESEND_COOLDOWN_MS - now) / 1000))

  async function submit() {
    if (otp.length !== 6 || pending) return
    setPending(true)
    setError(undefined)
    try {
      const pair = await verifyOtp({ otp_session_id: session!, otp })
      tokenStore.set({ accessToken: pair.access_token, refreshToken: pair.refresh_token, user: pair.user })
      toast.success('Tài khoản đã được kích hoạt')
      navigate('/events', { replace: true })
    } catch (e) {
      setOtp('')
      setError(
        isNotImplemented(e)
          ? NOT_IMPLEMENTED_MESSAGE
          : isApiError(e) && (e.status === 400 || e.status === 401 || e.status === 422)
            ? 'Mã OTP chưa đúng hoặc đã hết hạn.'
            : 'Chưa xác thực được. Vui lòng thử lại.',
      )
    } finally {
      setPending(false)
    }
  }

  async function resend() {
    try {
      await resendOtp({ otp_session_id: session! })
      setResentAt(Date.now())
      setExpiresAt(new Date(Date.now() + 5 * 60_000).toISOString())
      setOtp('')
      toast.success('Đã gửi lại mã OTP')
    } catch (e) {
      toast.error(isNotImplemented(e) ? NOT_IMPLEMENTED_MESSAGE : 'Chưa gửi lại được mã. Thử lại sau ít phút.')
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <AuthHeading eyebrow="Kích hoạt tài khoản" title="Xác thực OTP" />
      <section className="flex flex-col gap-4 rounded-[20px] bg-canvas p-6">
        <div className="flex items-center justify-between gap-2">
          <p className="type-mono-small text-ink-secondary uppercase">{'// Bước 2 · Xác thực OTP'}</p>
          {left !== undefined && <StatusBadge tone="warning">{formatCountdown(left)}</StatusBadge>}
        </div>
        <p className="type-body-m-strong text-foreground">
          Nhập mã 6 số đã gửi tới {maskEmail(email) || 'email của bạn'}
        </p>
        <OtpInput
          value={otp}
          onChange={(v) => {
            setOtp(v)
            setError(undefined)
          }}
          invalid={!!error}
        />
        {error && <FormError>{error}</FormError>}
        <div className="flex items-center justify-between gap-3">
          <span className="type-caption text-ink-tertiary">Không nhận được mã?</span>
          <button
            type="button"
            disabled={cooldown > 0}
            onClick={() => void resend()}
            className="type-caption text-foreground underline disabled:text-ink-tertiary disabled:no-underline"
          >
            {cooldown > 0 ? `Gửi lại sau ${cooldown}s` : 'Gửi lại mã'}
          </button>
        </div>
      </section>
      <ArrowButton
        variant="primary"
        disabled={otp.length !== 6 || pending}
        onClick={() => void submit()}
        className="w-full"
      >
        {pending ? 'Đang xác thực…' : 'Xác thực'}
      </ArrowButton>
      <p className="text-center type-caption text-ink-tertiary">
        Nhập sai email?{' '}
        <Link to="/register" className="text-foreground underline">
          Đăng ký lại
        </Link>
      </p>
    </div>
  )
}
