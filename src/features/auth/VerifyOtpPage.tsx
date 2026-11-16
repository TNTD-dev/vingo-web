import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'
import { toast } from 'sonner'

import { resendOtp, verifyOtp } from '@/api/generated/endpoints/auth/auth'
import { tokenStore } from '@/auth/token-store'
import { ArrowButton } from '@/design/ArrowButton'
import { OtpInput } from '@/design/OtpInput'
import { StatusBadge } from '@/design/StatusBadge'
import { formatCountdown, remainingSeconds } from '@/lib/countdown'
import { maskEmail } from '@/lib/mask'
import { useNow } from '@/lib/useNow'

import { AuthHeading, FormError } from './authUi'
import { resendOtpMessage, verifyOtpMessage } from './otpErrors'
import { clearOtpSession, loadOtpSession, saveOtpSession, type OtpSession } from './otpSession'

const RESEND_COOLDOWN_S = 60
const OTP_TTL_MS = 5 * 60_000

// B8 · Bước 2 xác thực OTP (Figma 03 · Buyer): kích hoạt tài khoản vừa đăng ký rồi đăng nhập luôn.
export default function VerifyOtpPage() {
  const navigate = useNavigate()
  // Phiên OTP lấy từ sessionStorage (do trang đăng ký ghi) nên tải lại trang vẫn còn.
  const [session, setSession] = useState<OtpSession | null>(loadOtpSession)
  const [otp, setOtp] = useState('')
  const [error, setError] = useState<string>()
  const [needsResend, setNeedsResend] = useState(false)
  const [pending, setPending] = useState(false)
  const [resending, setResending] = useState(false)
  // Thời điểm được phép gửi lại (ms); 429 kèm Retry-After có thể đẩy xa hơn 60 giây.
  const [resendAt, setResendAt] = useState(() => (session?.sentAt ?? 0) + RESEND_COOLDOWN_S * 1000)
  const now = useNow()

  if (!session) return <Navigate to="/register" replace />

  const left = session.expiresAt ? remainingSeconds(session.expiresAt, now) : undefined
  const cooldown = Math.max(0, Math.ceil((resendAt - now) / 1000))

  async function submit() {
    if (!session || otp.length !== 6 || pending) return
    setPending(true)
    setError(undefined)
    try {
      const pair = await verifyOtp({ otp_session_id: session.sessionId, otp })
      tokenStore.set({ accessToken: pair.access_token, refreshToken: pair.refresh_token, user: pair.user })
      clearOtpSession()
      toast.success('Tài khoản đã được kích hoạt')
      navigate(session.next ?? '/events', { replace: true })
    } catch (e) {
      const m = verifyOtpMessage(e)
      setOtp('')
      setError(m.message)
      setNeedsResend(m.needsResend)
    } finally {
      setPending(false)
    }
  }

  async function resend() {
    if (!session || resending || cooldown > 0) return
    setResending(true)
    try {
      await resendOtp({ otp_session_id: session.sessionId })
      const sentAt = Date.now()
      const next = { ...session, sentAt, expiresAt: new Date(sentAt + OTP_TTL_MS).toISOString() }
      saveOtpSession(next)
      setSession(next)
      setResendAt(sentAt + RESEND_COOLDOWN_S * 1000)
      setOtp('')
      setError(undefined)
      setNeedsResend(false)
      toast.success('Đã gửi lại mã OTP')
    } catch (e) {
      const m = resendOtpMessage(e)
      if (m.cooldown) setResendAt(Date.now() + m.cooldown * 1000)
      setError(m.message)
    } finally {
      setResending(false)
    }
  }

  const expired = left === 0

  return (
    <div className="flex flex-col gap-5">
      <AuthHeading eyebrow="Kích hoạt tài khoản" title="Xác thực OTP" />
      <section className="flex flex-col gap-4 rounded-[20px] bg-canvas p-6">
        <div className="flex items-center justify-between gap-2">
          <p className="type-mono-small text-ink-secondary uppercase">{'// Bước 2 · Xác thực OTP'}</p>
          {left !== undefined && (
            <StatusBadge tone={expired ? 'danger' : 'warning'}>
              {expired ? 'Hết hạn' : formatCountdown(left)}
            </StatusBadge>
          )}
        </div>
        <p className="type-body-m-strong text-foreground">
          Nhập mã 6 số đã gửi tới {maskEmail(session.email) || 'email của bạn'}
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
        {expired && !error && <FormError>Mã OTP đã hết hạn. Hãy gửi lại mã mới.</FormError>}
        <div className="flex items-center justify-between gap-3">
          <span className="type-caption text-ink-tertiary">Không nhận được mã?</span>
          <button
            type="button"
            disabled={cooldown > 0 || resending}
            onClick={() => void resend()}
            className={
              'type-caption underline disabled:text-ink-tertiary disabled:no-underline ' +
              (needsResend || expired ? 'font-medium text-foreground' : 'text-foreground')
            }
          >
            {resending ? 'Đang gửi…' : cooldown > 0 ? `Gửi lại sau ${cooldown}s` : 'Gửi lại mã'}
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
        <Link to="/register" onClick={clearOtpSession} className="text-foreground underline">
          Đăng ký lại
        </Link>
      </p>
    </div>
  )
}
