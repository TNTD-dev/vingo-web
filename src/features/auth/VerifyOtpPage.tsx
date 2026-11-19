import { Mail, Smartphone } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router'

import { useAuth } from '@/auth/auth-context'
import { ArrowButton } from '@/design/ArrowButton'
import { OtpDialog } from '@/design/OtpDialog'
import { StatusBadge } from '@/design/StatusBadge'
import { maskEmail, maskPhone } from '@/lib/mask'
import { normalizeVnMobile } from '@/lib/phoneVerification'

import { AuthHeading } from './authUi'
import { clearOtpSession, loadOtpSession, safeNext } from './otpSession'

// B8 · Xác thực tài khoản (Figma "Trang Xác thực tài khoản"): sau đăng ký thủ công phải xác thực cả email và số
// điện thoại đã nhập. Email kích hoạt tài khoản và đăng nhập luôn; SMS cần đăng nhập nên mở sau email.
export default function VerifyOtpPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { user } = useAuth()
  // Phiên OTP email lấy từ sessionStorage (do trang đăng ký ghi) nên tải lại trang vẫn còn.
  const [session, setSession] = useState(loadOtpSession)
  const [next] = useState(() => session?.next ?? safeNext(params.get('next')) ?? '/events')
  const [dialog, setDialog] = useState<'EMAIL' | 'SMS' | null>(null)

  if (!session && !user) return <Navigate to="/register" replace />

  // Còn phiên đăng ký chờ mã thì email chưa xác thực, kể cả khi trình duyệt vẫn đăng nhập tài khoản cũ.
  const emailDone = !session && Boolean(user)
  const phoneDone = emailDone && user?.phone_verified === true
  const emailText = maskEmail(session?.email ?? user?.email) || 'email của bạn'
  // Số lúc đăng ký lưu nguyên dạng người dùng gõ (0968...): chuẩn hoá về +84 rồi mới che.
  const phoneText =
    maskPhone(user?.phone ? (normalizeVnMobile(user.phone) ?? user.phone) : undefined) || 'số bạn đã nhập khi đăng ký'

  return (
    <div className="flex flex-col gap-5">
      <AuthHeading eyebrow="Xác thực tài khoản" title="Xác thực tài khoản" />
      <p className="-mt-2 type-body-m text-ink-secondary">
        Để giữ tài khoản an toàn, Vingo cần xác thực cả email và số điện thoại của bạn. Mỗi bước chỉ mất vài giây.
      </p>

      <VerifyCard
        icon={<Mail className="size-5" aria-hidden />}
        title="Xác thực email"
        done={emailDone}
        text={
          emailDone ? `${emailText} đã được xác thực.` : `Vingo đã gửi mã 6 số tới ${emailText}. Mã có hiệu lực 5 phút.`
        }
        action={emailDone ? undefined : { label: 'Xác thực email', onClick: () => setDialog('EMAIL') }}
      />
      <VerifyCard
        icon={<Smartphone className="size-5" aria-hidden />}
        title="Xác thực số điện thoại"
        done={phoneDone}
        text={
          phoneDone
            ? `${phoneText} đã được xác thực.`
            : emailDone
              ? `Vingo gửi mã 6 số qua SMS tới ${phoneText}. Mã có hiệu lực 5 phút.`
              : 'Xác thực email trước, sau đó Vingo gửi mã qua SMS tới số bạn đã nhập khi đăng ký.'
        }
        action={
          phoneDone
            ? undefined
            : { label: 'Xác thực số điện thoại', onClick: () => setDialog('SMS'), disabled: !emailDone }
        }
      />

      {emailDone && phoneDone ? (
        <ArrowButton variant="primary" onClick={() => navigate(next, { replace: true })} className="w-full">
          Tiếp tục khám phá sự kiện
        </ArrowButton>
      ) : (
        !emailDone && (
          <p className="text-center type-caption text-ink-tertiary">
            Nhập sai email?{' '}
            <Link to="/register" onClick={clearOtpSession} className="text-foreground underline">
              Đăng ký lại
            </Link>
          </p>
        )
      )}

      <OtpDialog
        open={dialog === 'EMAIL'}
        onOpenChange={(open) => !open && setDialog(null)}
        channel="EMAIL"
        emailSession={session ?? undefined}
        onVerified={() => {
          clearOtpSession()
          setSession(null)
        }}
      />
      <OtpDialog
        open={dialog === 'SMS'}
        onOpenChange={(open) => !open && setDialog(null)}
        initialPhone={user?.phone}
        onVerified={() => setDialog(null)}
      />
    </div>
  )
}

function VerifyCard({
  icon,
  title,
  done,
  text,
  action,
}: {
  icon: ReactNode
  title: string
  done: boolean
  text: string
  action?: { label: string; onClick: () => void; disabled?: boolean }
}) {
  return (
    <section className="flex flex-col gap-3.5 rounded-[20px] border border-line bg-surface p-5 sm:p-6">
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-pill bg-canvas text-foreground">
          {icon}
        </span>
        <h2 className="min-w-0 flex-1 type-body-m-strong text-foreground">{title}</h2>
        <StatusBadge tone={done ? 'success' : 'neutral'}>{done ? 'Đã xác thực' : 'Bắt buộc'}</StatusBadge>
      </div>
      <p className="type-body-m text-ink-secondary">{text}</p>
      {action && (
        <ArrowButton variant="primary" onClick={action.onClick} disabled={action.disabled} className="w-full">
          {action.label}
        </ArrowButton>
      )}
    </section>
  )
}
