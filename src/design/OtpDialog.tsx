import { Check } from 'lucide-react'
import { useId, useRef, useState, type FormEvent } from 'react'

import { resendOtp, verifyOtp } from '@/api/generated/endpoints/auth/auth'
import { requestPhoneOtp, verifyPhoneOtp } from '@/api/generated/endpoints/me/me'
import type { User } from '@/api/generated/model'
import { isApiError } from '@/api/problem'
import { tokenStore } from '@/auth/token-store'
import { OtpInput } from '@/design/OtpInput'
import { requestPhoneOtpMessage, resendOtpMessage, verifyOtpMessage, verifyPhoneOtpMessage } from '@/design/otpErrors'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/design/ui/dialog'
import { cn } from '@/lib/cn'
import { formatCountdown } from '@/lib/countdown'
import { maskEmail, maskPhone } from '@/lib/mask'
import { takeDemoOtp } from '@/lib/demoOtp'
import { formatNationalPhone, normalizeVnMobile } from '@/lib/phoneVerification'
import { useNow } from '@/lib/useNow'

export interface OtpDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Gọi khi người dùng bấm "Tiếp tục" ở bước thành công (SMS: `phone_verified=true`; EMAIL: đã đăng nhập). */
  onVerified: (user: User) => void
  /** `EMAIL`: mã kích hoạt tài khoản đã gửi lúc đăng ký, vào thẳng bước nhập mã. Mặc định `SMS`. */
  channel?: 'SMS' | 'EMAIL'
  /** SMS: số điền sẵn ở bước nhập số (bỏ qua khi `mode='change'`). */
  initialPhone?: string
  /** SMS, `change`: đổi sang số khác, bước thành công không nhắc chuyện giữ ghế. */
  mode?: 'verify' | 'change'
  /** EMAIL: phiên OTP do trang đăng ký tạo; `sentAt` (ms) để tính đếm ngược gửi lại. */
  emailSession?: { sessionId: string; email: string; sentAt: number }
}

const RESEND_COOLDOWN_MS = 60_000
const OTP_LENGTH = 6

type Step = 'phone' | 'code' | 'done'

const primary =
  'type-body-m-strong h-[52px] w-full rounded-pill bg-ink text-on-ink transition-opacity disabled:bg-muted disabled:text-ink-tertiary'
const quiet = 'type-body-m-strong text-center text-ink-tertiary hover:text-foreground'

/**
 * Popup OTP dùng chung (Figma "OtpDialog"). SMS: nhập số → nhập mã 6 số → thành công; EMAIL: nhập mã kích hoạt → thành công.
 * Dùng ở trang xác thực tài khoản, chọn ghế, Tài khoản & bảo mật, chuông thông báo. Không ghi SĐT/OTP vào log, storage hay URL.
 */
export function OtpDialog(props: OtpDialogProps) {
  // Dựng nội dung ở lần mở đầu và giữ lại khi đóng: mở lại vẫn ở bước nhập mã với phiên đã gửi (không gửi lại
  // rồi dính 429). Chỉ dựng phiên mới sau khi xác minh xong.
  const [mounted, setMounted] = useState(false)
  const [round, setRound] = useState(0)
  const verified = useRef<User | undefined>(undefined)
  if (props.open && !mounted) setMounted(true)

  function close() {
    const user = verified.current
    if (user) {
      // Đã xác minh: bấm "Tiếp tục" hay nút đóng đều báo người gọi, lần mở sau bắt đầu lại.
      verified.current = undefined
      setMounted(false)
      setRound((r) => r + 1)
      props.onVerified(user)
    }
    props.onOpenChange(false)
  }

  return (
    <Dialog open={props.open} onOpenChange={(open) => (open ? props.onOpenChange(true) : close())}>
      {mounted && (
        <OtpContent
          key={round}
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
  channel = 'SMS',
  initialPhone,
  mode = 'verify',
  emailSession,
}: OtpDialogProps & { onClose: () => void; onDone: (user: User) => void }) {
  const email = channel === 'EMAIL'
  const inputId = useId()
  const [step, setStep] = useState<Step>(email ? 'code' : 'phone')
  const [phoneText, setPhoneText] = useState(() => (mode === 'change' ? '' : formatNationalPhone(initialPhone)))
  const [sentPhone, setSentPhone] = useState('')
  const [sessionId, setSessionId] = useState(emailSession?.sessionId ?? '')
  const [otp, setOtp] = useState('')
  const [error, setError] = useState<string>()
  const [needsResend, setNeedsResend] = useState(false)
  const [pending, setPending] = useState(false)
  // Thời điểm (ms) được gửi lại; Retry-After của 429 có thể đẩy xa hơn 60 giây nhưng không bao giờ rút ngắn.
  const [resendAt, setResendAt] = useState(() => (emailSession ? emailSession.sentAt + RESEND_COOLDOWN_MS : 0))
  // Chỉ có khi demo (VITE_DEMO_OTP=true và backend SMS_PROVIDER=demo): mã hiện thẳng trên màn hình thay cho SMS.
  const [demoCode, setDemoCode] = useState<string>()
  const now = useNow()

  const cooldown = Math.max(0, Math.ceil((resendAt - now) / 1000))
  const e164 = normalizeVnMobile(phoneText)

  function lockResend(ms: number) {
    setResendAt((prev) => Math.max(prev, Date.now() + ms))
  }

  async function send(phone: string) {
    if (pending) return
    setPending(true)
    setError(undefined)
    setNeedsResend(false)
    if (email) {
      try {
        await resendOtp({ otp_session_id: sessionId })
        setOtp('')
        setResendAt(Date.now() + RESEND_COOLDOWN_MS)
      } catch (e) {
        const m = resendOtpMessage(e)
        setError(m.message)
        if (m.cooldown) lockResend(m.cooldown * 1000)
      } finally {
        setPending(false)
      }
      return
    }
    try {
      const session = await requestPhoneOtp({ phone })
      if (!session.otp_session_id) throw new Error('Thiếu otp_session_id')
      setSentPhone(phone)
      setSessionId(session.otp_session_id)
      setDemoCode(takeDemoOtp())
      setOtp('')
      setResendAt(Date.now() + RESEND_COOLDOWN_MS)
      setStep('code')
    } catch (e) {
      const m = requestPhoneOtpMessage(e)
      setError(m.message)
      if (m.cooldown) lockResend(m.cooldown * 1000)
      // Số đã thuộc người khác: quay về ô nhập số (kể cả khi bấm gửi lại từ bước nhập mã).
      if (isApiError(e, 'PHONE_TAKEN')) setStep('phone')
    } finally {
      setPending(false)
    }
  }

  async function verify() {
    if (otp.length !== OTP_LENGTH || pending) return
    setPending(true)
    setError(undefined)
    try {
      if (email) {
        // Kích hoạt tài khoản: backend trả cặp token, đăng nhập luôn.
        const pair = await verifyOtp({ otp_session_id: sessionId, otp })
        tokenStore.set({ accessToken: pair.access_token, refreshToken: pair.refresh_token, user: pair.user })
        onDone(pair.user)
      } else {
        const user = await verifyPhoneOtp({ otp_session_id: sessionId, otp })
        // Cập nhật phiên ngay để mọi nơi dùng useAuth() thấy phone_verified=true, giữ nguyên token.
        const current = tokenStore.get()
        if (current) tokenStore.set({ ...current, user })
        onDone(user)
      }
      setStep('done')
    } catch (e) {
      if (email) {
        const m = verifyOtpMessage(e)
        setError(m.message)
        setNeedsResend(m.needsResend)
        setOtp('')
        return
      }
      const m = verifyPhoneOtpMessage(e)
      setError(m.message)
      setNeedsResend(m.needsResend)
      setOtp('')
      if (m.cooldown) lockResend(m.cooldown * 1000)
      if (m.changePhone) setStep('phone')
    } finally {
      setPending(false)
    }
  }

  function submitPhone(event: FormEvent) {
    event.preventDefault()
    if (e164 && cooldown === 0) void send(e164)
  }

  function submitCode(event: FormEvent) {
    event.preventDefault()
    void verify()
  }

  function backToPhone() {
    setStep('phone')
    setOtp('')
    setError(undefined)
    setNeedsResend(false)
  }

  const shown = email ? maskEmail(emailSession?.email ?? '') || 'email của bạn' : maskPhone(sentPhone)
  const banner = error && (
    <p role="alert" className="rounded-[12px] bg-danger/10 px-4 py-3 type-body-m text-danger">
      {error}
    </p>
  )

  return (
    <DialogContent className="max-w-[min(440px,calc(100%-2rem))] gap-5 rounded-xl border-0 bg-surface p-6 shadow-float sm:max-w-[min(440px,calc(100%-2rem))] sm:p-8">
      {step === 'phone' && (
        <form onSubmit={submitPhone} noValidate className="flex flex-col gap-5">
          <Heading
            eyebrow="// XÁC MINH SỐ ĐIỆN THOẠI"
            title="Xác minh số điện thoại"
            hint="Vingo gửi mã 6 số qua SMS để chắc chắn bạn là người thật, tránh bị đặt vé tự động chiếm ghế. Chỉ nhận số Việt Nam."
          />
          <div className="flex flex-col gap-2">
            <label htmlFor={inputId} className="type-mono-small text-ink-secondary uppercase">
              Số điện thoại
            </label>
            <div className="flex h-[46px] items-center gap-3 rounded-[14px] border border-line bg-surface px-4 focus-within:border-foreground">
              <span className="type-body-m-strong text-foreground">+84</span>
              <span aria-hidden className="h-[18px] w-px bg-line" />
              <input
                id={inputId}
                type="tel"
                inputMode="tel"
                autoComplete="tel-national"
                placeholder="912 345 678"
                value={phoneText}
                onChange={(event) => {
                  setPhoneText(event.target.value)
                  if (error) setError(undefined)
                }}
                className="min-w-0 flex-1 bg-transparent type-body-m text-foreground outline-none placeholder:text-ink-tertiary"
              />
            </div>
          </div>
          {banner}
          <button type="submit" disabled={!e164 || pending || cooldown > 0} className={primary}>
            Gửi mã xác minh
          </button>
          <button type="button" onClick={onClose} className={quiet}>
            Để sau
          </button>
        </form>
      )}

      {step === 'code' && (
        <form onSubmit={submitCode} noValidate className="flex min-w-0 flex-col gap-5">
          <Heading
            eyebrow={email ? '// XÁC THỰC EMAIL' : '// BƯỚC 2 · NHẬP MÃ'}
            title="Nhập mã gồm 6 số"
            hint={`Mã đã gửi tới ${shown}, có hiệu lực 5 phút.${email ? ' Kiểm tra cả thư rác nếu chưa thấy.' : ''}`}
          />
          {demoCode && (
            <div
              role="status"
              className="flex items-center justify-between gap-3 rounded-[12px] bg-agent px-4 py-3 type-body-m text-foreground"
            >
              <span>
                Mã demo (không gửi SMS): <strong className="font-mono tracking-widest">{demoCode}</strong>
              </span>
              <button type="button" onClick={() => setOtp(demoCode)} className="type-caption underline">
                Điền mã
              </button>
            </div>
          )}
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
          {banner}
          <div className="flex items-center justify-between gap-3">
            <span className="type-caption text-ink-tertiary">Không nhận được mã?</span>
            <button
              type="button"
              disabled={cooldown > 0 || pending}
              onClick={() => void send(sentPhone)}
              className={cn(
                'type-caption disabled:text-ink-tertiary',
                needsResend ? 'text-foreground underline' : 'text-foreground',
              )}
            >
              {cooldown > 0 ? `Gửi lại sau ${formatCountdown(cooldown)}` : 'Gửi lại mã'}
            </button>
          </div>
          <button type="submit" disabled={otp.length !== OTP_LENGTH || pending} className={primary}>
            {email ? 'Xác thực' : 'Xác minh'}
          </button>
          <button type="button" onClick={email ? onClose : backToPhone} className={quiet}>
            {email ? 'Để sau' : 'Đổi số điện thoại'}
          </button>
        </form>
      )}

      {step === 'done' && (
        <div className="flex flex-col items-center gap-5 text-center">
          <span className="flex size-[72px] items-center justify-center rounded-pill bg-agent">
            <Check className="size-8 text-foreground" aria-hidden />
          </span>
          <Heading
            eyebrow="// ĐÃ XÁC MINH"
            title={email ? 'Đã xác thực email' : 'Đã xác minh số điện thoại'}
            hint={
              email
                ? `${shown} đã gắn với tài khoản của bạn.`
                : `Số ${shown} đã gắn với tài khoản của bạn.${mode === 'verify' ? ' Bạn có thể giữ ghế ngay bây giờ.' : ''}`
            }
            centered
          />
          <button type="button" onClick={onClose} className={primary}>
            Tiếp tục
          </button>
        </div>
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
