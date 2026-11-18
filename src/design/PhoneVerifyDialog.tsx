import { Check } from 'lucide-react'
import { useId, useState, type FormEvent } from 'react'

import { requestPhoneOtp, verifyPhoneOtp } from '@/api/generated/endpoints/me/me'
import type { User } from '@/api/generated/model'
import { isApiError } from '@/api/problem'
import { tokenStore } from '@/auth/token-store'
import { OtpInput } from '@/design/OtpInput'
import { requestPhoneOtpMessage, verifyPhoneOtpMessage } from '@/design/phoneVerifyErrors'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/design/ui/dialog'
import { cn } from '@/lib/cn'
import { formatCountdown } from '@/lib/countdown'
import { maskPhone } from '@/lib/mask'
import { formatNationalPhone, normalizeVnMobile } from '@/lib/phoneVerification'
import { useNow } from '@/lib/useNow'

export interface PhoneVerifyDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Gọi khi người dùng bấm "Tiếp tục" ở bước thành công; user đã có `phone_verified=true`. */
  onVerified: (user: User) => void
  /** Số điền sẵn ở bước nhập số (bỏ qua khi `mode='change'`). */
  initialPhone?: string
  /** `change`: đổi sang số khác, bước thành công không nhắc chuyện giữ ghế. */
  mode?: 'verify' | 'change'
}

const RESEND_COOLDOWN_MS = 60_000
const OTP_LENGTH = 6

type Step = 'phone' | 'code' | 'done'

const primary =
  'type-body-m-strong h-[52px] w-full rounded-pill bg-ink text-on-ink transition-opacity disabled:bg-muted disabled:text-ink-tertiary'
const quiet = 'type-body-m-strong text-center text-ink-tertiary hover:text-foreground'

/** "+84912345678" → "+84 912 345 ***": che ba số cuối khi hiển thị lại số vừa gửi. */
function maskedPhone(e164: string): string {
  return maskPhone(e164).replace(/^(\+84)(\d{3})(\d{3})\*{3}$/, '$1 $2 $3 ***')
}

/**
 * Popup xác minh số điện thoại bằng SMS OTP (Figma "PhoneVerifyDialog"): nhập số → nhập mã 6 số → thành công.
 * Dùng ở chọn ghế, Tài khoản & bảo mật và liên kết từ chuông thông báo. Không ghi SĐT/OTP vào log, storage hay URL.
 */
export function PhoneVerifyDialog(props: PhoneVerifyDialogProps) {
  // Chỉ dựng nội dung khi mở để mỗi lần mở bắt đầu lại từ bước nhập số, và đồng hồ đếm ngược không chạy khi đóng.
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      {props.open && <PhoneVerifyContent {...props} />}
    </Dialog>
  )
}

function PhoneVerifyContent({ onOpenChange, onVerified, initialPhone, mode = 'verify' }: PhoneVerifyDialogProps) {
  const inputId = useId()
  const [step, setStep] = useState<Step>('phone')
  const [phoneText, setPhoneText] = useState(() => (mode === 'change' ? '' : formatNationalPhone(initialPhone)))
  const [sentPhone, setSentPhone] = useState('')
  const [sessionId, setSessionId] = useState('')
  const [otp, setOtp] = useState('')
  const [error, setError] = useState<string>()
  const [needsResend, setNeedsResend] = useState(false)
  const [pending, setPending] = useState(false)
  // Thời điểm (ms) được gửi lại; Retry-After của 429 có thể đẩy xa hơn 60 giây nhưng không bao giờ rút ngắn.
  const [resendAt, setResendAt] = useState(0)
  const [verifiedUser, setVerifiedUser] = useState<User>()
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
    try {
      const session = await requestPhoneOtp({ phone })
      if (!session.otp_session_id) throw new Error('Thiếu otp_session_id')
      setSentPhone(phone)
      setSessionId(session.otp_session_id)
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
      const user = await verifyPhoneOtp({ otp_session_id: sessionId, otp })
      // Cập nhật phiên ngay để mọi nơi dùng useAuth() thấy phone_verified=true, giữ nguyên token.
      const current = tokenStore.get()
      if (current) tokenStore.set({ ...current, user })
      setVerifiedUser(user)
      setStep('done')
    } catch (e) {
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

  function finish() {
    if (verifiedUser) onVerified(verifiedUser)
    onOpenChange(false)
  }

  const shown = maskedPhone(sentPhone)
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
          <button type="button" onClick={() => onOpenChange(false)} className={quiet}>
            Để sau
          </button>
        </form>
      )}

      {step === 'code' && (
        <form onSubmit={submitCode} noValidate className="flex min-w-0 flex-col gap-5">
          <Heading
            eyebrow="// BƯỚC 2 · NHẬP MÃ"
            title="Nhập mã gồm 6 số"
            hint={`Mã đã gửi tới ${shown}, có hiệu lực 5 phút.`}
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
            Xác minh
          </button>
          <button type="button" onClick={backToPhone} className={quiet}>
            Đổi số điện thoại
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
            title="Đã xác minh số điện thoại"
            hint={`Số ${shown} đã gắn với tài khoản của bạn.${mode === 'verify' ? ' Bạn có thể giữ ghế ngay bây giờ.' : ''}`}
            centered
          />
          <button type="button" onClick={finish} className={primary}>
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
