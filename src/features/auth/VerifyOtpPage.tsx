import { Mail } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router'

import { useAuth } from '@/auth/auth-context'
import { ArrowButton } from '@/design/ArrowButton'
import { OtpDialog } from '@/design/OtpDialog'
import { StatusBadge } from '@/design/StatusBadge'
import { maskEmail } from '@/lib/mask'

import { AuthHeading } from './authUi'
import { clearOtpSession, loadOtpSession, safeNext, saveOtpSession } from './otpSession'

// B8 · Xác thực tài khoản (Figma "Trang Xác thực tài khoản"): sau đăng ký thủ công phải xác thực email.
// Email kích hoạt tài khoản và đăng nhập luôn.
export default function VerifyOtpPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { user } = useAuth()
  // Phiên OTP email lấy từ sessionStorage (do trang đăng ký ghi) nên tải lại trang vẫn còn.
  const [session] = useState(loadOtpSession)
  const [next] = useState(() => session?.next ?? safeNext(params.get('next')) ?? '/events')
  const [open, setOpen] = useState(false)

  // Không còn phiên chờ mã: đã đăng nhập thì đi tiếp, chưa thì đăng ký.
  if (!session) return <Navigate to={user ? next : '/register'} replace />

  const emailText = maskEmail(session.email) || 'email của bạn'

  return (
    <div className="flex flex-col gap-5">
      <AuthHeading eyebrow="Xác thực tài khoản" title="Xác thực tài khoản" />
      <p className="-mt-2 type-body-m text-ink-secondary">
        Để giữ tài khoản an toàn, Vingo cần xác thực email của bạn. Chỉ mất vài giây.
      </p>

      <section className="flex flex-col gap-3.5 rounded-[20px] border border-line bg-surface p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-pill bg-canvas text-foreground">
            <Mail className="size-5" aria-hidden />
          </span>
          <h2 className="min-w-0 flex-1 type-body-m-strong text-foreground">Xác thực email</h2>
          <StatusBadge tone="neutral">Bắt buộc</StatusBadge>
        </div>
        <p className="type-body-m text-ink-secondary">Vingo đã gửi mã 6 số tới {emailText}. Mã có hiệu lực 5 phút.</p>
        <ArrowButton variant="primary" onClick={() => setOpen(true)} className="w-full">
          Xác thực email
        </ArrowButton>
      </section>

      <p className="text-center type-caption text-ink-tertiary">
        Nhập sai email?{' '}
        <Link to="/register" onClick={clearOtpSession} className="text-foreground underline">
          Đăng ký lại
        </Link>
      </p>

      <OtpDialog
        open={open}
        onOpenChange={setOpen}
        session={session}
        onResent={(sent) => saveOtpSession({ ...session, ...sent })}
        onVerified={() => {
          clearOtpSession()
          navigate(next, { replace: true })
        }}
      />
    </div>
  )
}
