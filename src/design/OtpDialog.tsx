import { Check } from 'lucide-react'
import { useRef, useState, type FormEvent } from 'react'

import { resendOtp, verifyOtp } from '@/api/generated/endpoints/auth/auth'
import type { User } from '@/api/generated/model'
import { sessionStore } from '@/auth/token-store'
import { OtpInput } from '@/design/OtpInput'
import { resendOtpMessage, verifyOtpMessage } from '@/design/otpErrors'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/design/ui/dialog'
import { cn } from '@/lib/cn'
import { formatCountdown } from '@/lib/countdown'
import { maskEmail } from '@/lib/mask'
import { useNow } from '@/lib/useNow'

export interface OtpDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Gọi khi người dùng đóng bước thành công; lúc này đã đăng nhập. */
  onVerified: (user: User) => void
  /** Phiên OTP do trang đăng ký tạo; `sentAt` (ms) để tính đếm ngược gửi lại. */
  session: { sessionId: string; email: string; sentAt: number }
  /** Gửi lại mã tạo phiên mới, phiên cũ hết hiệu lực: người gọi lưu lại để tải lại trang vẫn dùng được. */
  onResent: (next: { sessionId: string; sentAt: number; expiresAt?: string }) => void
}

const RESEND_COOLDOWN_MS = 60_000
const OTP_LENGTH = 6

const primary =
  'type-body-m-strong h-[52px] w-full rounded-pill bg-ink text-on-ink transition-opacity disabled:bg-muted disabled:text-ink-tertiary'
const quiet = 'type-body-m-strong text-center text-ink-tertiary hover:text-foreground'

/** Popup nhập mã kích hoạt gửi qua email (Figma "OtpDialog"). Không ghi OTP vào log, storage hay URL. */
export function OtpDialog(props: OtpDialogProps) {
  // Dựng nội dung ở lần mở đầu và giữ lại khi đóng: mở lại vẫn đúng phiên và đếm ngược cũ.
  const [mounted, setMounted] = useState(false)
  const verified = useRef<User | undefined>(undefined)
  if (props.open && !mounted) setMounted(true)

  function close() {
    const user = verified.current
    if (user) {
      // Đã xác thực: bấm "Tiếp tục" hay nút đóng đều báo người gọi.
      verified.current = undefined
      setMounted(false)
      props.onVerified(user)
    }
    props.onOpenChange(false)
  }

  return (
    <Dialog open={props.open} onOpenChange={(open) => (open ? props.onOpenChange(true) : close())}>
      {mounted && (
        <OtpContent
          {...props}
          onClose={close}
          onDone={(user) => {
            verified.current = user
          }}
        />
      )}
    </Dialog>
  )
}

function OtpContent({
  onClose,
  onDone,
  session,
  onResent,
}: OtpDialogProps & { onClose: () => void; onDone: (user: User) => void }) {
  const [done, setDone] = useState(false)
  const [sessionId, setSessionId] = useState(session.sessionId)
  const [otp, setOtp] = useState('')
  const [error, setError] = useState<string>()
  const [needsResend, setNeedsResend] = useState(false)
  const [pending, setPending] = useState(false)
  // Thời điểm (ms) được gửi lại; Retry-After của 429 có thể đẩy xa hơn 60 giây nhưng không bao giờ rút ngắn.
  const [resendAt, setResendAt] = useState(session.sentAt + RESEND_COOLDOWN_MS)
  const now = useNow()

  const cooldown = Math.max(0, Math.ceil((resendAt - now) / 1000))
  const shown = maskEmail(session.email) || 'email của bạn'

  async function resend() {
    if (pending) return
    setPending(true)
    setError(undefined)
    setNeedsResend(false)
    try {
      const next = await resendOtp({ otp_session_id: sessionId })
      if (!next.otp_session_id) throw new Error('Thiếu otp_session_id')
      const sentAt = Date.now()
      setSessionId(next.otp_session_id)
      setOtp('')
      setResendAt(sentAt + RESEND_COOLDOWN_MS)
      onResent({ sessionId: next.otp_session_id, sentAt, expiresAt: next.expires_at })
    } catch (e) {
      const m = resendOtpMessage(e)
      setError(m.message)
      const wait = m.cooldown
      if (wait) setResendAt((prev) => Math.max(prev, Date.now() + wait * 1000))
    } finally {
      setPending(false)
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (otp.length !== OTP_LENGTH || pending) return
    setPending(true)
    setError(undefined)
    try {
      const { user } = await verifyOtp({ otp_session_id: sessionId, otp })
      sessionStore.set(user, true)
      onDone(user)
      setDone(true)
    } catch (e) {
      const m = verifyOtpMessage(e)
      setError(m.message)
      setNeedsResend(m.needsResend)
      setOtp('')
    } finally {
      setPending(false)
    }
  }

  return (
    <DialogContent className="max-w-[min(440px,calc(100%-2rem))] gap-5 rounded-xl border-0 bg-surface p-6 shadow-float sm:max-w-[min(440px,calc(100%-2rem))] sm:p-8">
      {done ? (
        <div className="flex flex-col items-center gap-5 text-center">
          <span className="flex size-[72px] items-center justify-center rounded-pill bg-agent">
            <Check className="size-8 text-foreground" aria-hidden />
          </span>
          <Heading
            eyebrow="// ĐÃ XÁC THỰC"
            title="Đã xác thực email"
            hint={`${shown} đã gắn với tài khoản của bạn.`}
            centered
          />
          <button type="button" onClick={onClose} className={primary}>
            Tiếp tục
          </button>
        </div>
      ) : (
        <form onSubmit={(event) => void submit(event)} noValidate className="flex min-w-0 flex-col gap-5">
          <Heading
            eyebrow="// XÁC THỰC EMAIL"
            title="Nhập mã gồm 6 số"
            hint={`Mã đã gửi tới ${shown}, có hiệu lực 5 phút. Kiểm tra cả thư rác nếu chưa thấy.`}
          />
          {/* Ô OtpInput nền trắng dành cho khung xám; trên popup trắng cần viền, và fieldset phải co được để không tràn. */}
          <div className="min-w-0 [&_fieldset]:min-w-0 [&_input]:border [&_input]:border-line">
            <OtpInput
              value={otp}
              onChange={(value) => {
                setOtp(value)
                if (error) setError(undefined)
              }}
              length={OTP_LENGTH}
              invalid={Boolean(error)}
            />
          </div>
          {error && (
            <p role="alert" className="rounded-[12px] bg-danger/10 px-4 py-3 type-body-m text-danger">
              {error}
            </p>
          )}
          <div className="flex items-center justify-between gap-3">
            <span className="type-caption text-ink-tertiary">Không nhận được mã?</span>
            <button
              type="button"
              disabled={cooldown > 0 || pending}
              onClick={() => void resend()}
              className={cn('type-caption text-foreground disabled:text-ink-tertiary', needsResend && 'underline')}
            >
              {cooldown > 0 ? `Gửi lại sau ${formatCountdown(cooldown)}` : 'Gửi lại mã'}
            </button>
          </div>
          <button type="submit" disabled={otp.length !== OTP_LENGTH || pending} className={primary}>
            Xác thực
          </button>
          <button type="button" onClick={onClose} className={quiet}>
            Để sau
          </button>
        </form>
      )}
    </DialogContent>
  )
}

function Heading({
  eyebrow,
  title,
  hint,
  centered,
}: {
  eyebrow: string
  title: string
  hint: string
  centered?: boolean
}) {
  return (
    <div className={cn('flex flex-col gap-2', centered && 'items-center')}>
      <p className="type-mono-label text-ink-secondary uppercase">{eyebrow}</p>
      <DialogTitle className="type-h3 text-foreground">{title}</DialogTitle>
      <DialogDescription className="type-body-m text-ink-secondary">{hint}</DialogDescription>
    </div>
  )
}
