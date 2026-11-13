import { useState } from 'react'
import { Link, useNavigate } from 'react-router'

import { register } from '@/api/generated/endpoints/auth/auth'
import { isApiError, isNotImplemented, NOT_IMPLEMENTED_MESSAGE } from '@/api/problem'
import { ArrowButton } from '@/design/ArrowButton'
import { cn } from '@/lib/cn'
import { passwordStrength, STRENGTH_HINT } from '@/lib/validate'

import { AuthField, AuthHeading, FormError, GoogleButton } from './authUi'
import { validateRegister, type RegisterErrors, type RegisterFields } from './registerForm'

// B14 · Đăng ký (Figma 03 · Buyer). Tạo tài khoản xong chuyển sang /verify-otp để kích hoạt.
export default function RegisterPage() {
  const navigate = useNavigate()
  const [v, setV] = useState<RegisterFields>({ full_name: '', phone: '', email: '', password: '', confirm: '' })
  const [terms, setTerms] = useState(false)
  const [errors, setErrors] = useState<RegisterErrors>({})
  const [formError, setFormError] = useState<string>()
  const [pending, setPending] = useState(false)
  const strength = passwordStrength(v.password)
  const set = (k: keyof RegisterFields) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setV({ ...v, [k]: e.target.value })

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const found = validateRegister(v, terms)
    setErrors(found)
    setFormError(undefined)
    if (Object.keys(found).length) return
    setPending(true)
    try {
      const session = await register({
        full_name: v.full_name.trim(),
        email: v.email.trim(),
        phone: v.phone.replace(/[\s.-]/g, ''),
        password: v.password,
      })
      const qs = new URLSearchParams({ session: session.otp_session_id ?? '', email: v.email.trim() })
      if (session.expires_at) qs.set('exp', session.expires_at)
      navigate(`/verify-otp?${qs}`)
    } catch (err) {
      if (isNotImplemented(err)) setFormError(NOT_IMPLEMENTED_MESSAGE)
      else if (isApiError(err) && err.status === 409) {
        setFormError('Email hoặc số điện thoại này đã có tài khoản. Hãy đăng nhập hoặc dùng thông tin khác.')
      } else setFormError(isApiError(err) ? (err.problem?.detail ?? err.message) : 'Chưa tạo được tài khoản.')
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} noValidate className="flex flex-col gap-4">
      <AuthHeading eyebrow="Đăng ký" title="Tạo tài khoản Vingo" />
      <div className="grid gap-4 sm:grid-cols-2">
        <AuthField
          label="Họ và tên"
          value={v.full_name}
          onChange={set('full_name')}
          error={errors.full_name}
          autoComplete="name"
        />
        <AuthField
          label="Số điện thoại"
          value={v.phone}
          onChange={set('phone')}
          error={errors.phone}
          autoComplete="tel"
          inputMode="tel"
        />
      </div>
      <AuthField
        label="Email"
        type="email"
        value={v.email}
        onChange={set('email')}
        error={errors.email}
        autoComplete="email"
      />
      <div className="flex flex-col gap-2">
        <AuthField
          label="Mật khẩu"
          type="password"
          value={v.password}
          onChange={set('password')}
          error={errors.password}
          autoComplete="new-password"
        />
        {v.password && (
          <>
            <div className="flex gap-1.5" aria-hidden>
              {[1, 2, 3, 4].map((n) => (
                <span
                  key={n}
                  className={cn('h-[3px] w-[58px] rounded-pill', n <= strength ? 'bg-success' : 'bg-line')}
                />
              ))}
            </div>
            <p className="type-caption text-ink-tertiary">{STRENGTH_HINT[strength]}</p>
          </>
        )}
      </div>
      <AuthField
        label="Nhập lại mật khẩu"
        type="password"
        value={v.confirm}
        onChange={set('confirm')}
        error={errors.confirm}
        autoComplete="new-password"
      />
      <div className="flex flex-col gap-1">
        <label className="flex items-center gap-3 type-caption text-ink-secondary">
          <input
            type="checkbox"
            checked={terms}
            onChange={(e) => setTerms(e.target.checked)}
            className="size-4 accent-ink"
          />
          Tôi đồng ý Điều khoản và Chính sách bảo mật của Vingo
        </label>
        {errors.terms && <p className="type-caption text-danger">{errors.terms}</p>}
      </div>
      {formError && <FormError>{formError}</FormError>}
      <ArrowButton variant="primary" type="submit" disabled={pending} className="w-full">
        {pending ? 'Đang tạo…' : 'Tạo tài khoản'}
      </ArrowButton>
      <GoogleButton>Đăng ký bằng Google</GoogleButton>
      <p className="type-caption text-ink-tertiary">
        Đã có tài khoản?{' '}
        <Link to="/login" className="text-foreground underline">
          Đăng nhập
        </Link>
      </p>
      <p className="flex items-center gap-3 rounded-[16px] bg-canvas px-4 py-3 type-caption text-ink-secondary">
        <span className="shrink-0 rounded-pill border border-line bg-surface px-2.5 py-[5px] type-mono-small uppercase">
          ● Bước tiếp
        </span>
        Sau khi tạo, nhập mã OTP 6 số gửi tới email để kích hoạt tài khoản.
      </p>
    </form>
  )
}
