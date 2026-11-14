import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'

import { isApiError } from '@/api/problem'
import { useAuth } from '@/auth/auth-context'
import { ArrowButton } from '@/design/ArrowButton'

import { AuthField, AuthHeading, FormError, GoogleButton } from './authUi'

// B8 · Đăng nhập (Figma 03 · Buyer). Bước OTP của B8 dùng ở /verify-otp sau khi đăng ký.
export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(form: FormData) {
    setPending(true)
    setError(null)
    try {
      await login({ identifier: String(form.get('identifier')).trim(), password: String(form.get('password')) })
      const next = params.get('next')
      navigate(next?.startsWith('/') && !next.startsWith('//') ? next : '/events', { replace: true })
    } catch (e) {
      setError(
        isApiError(e) && e.status === 401
          ? 'Email/số điện thoại hoặc mật khẩu chưa đúng.'
          : isApiError(e)
            ? (e.problem?.detail ?? e.message)
            : 'Không đăng nhập được. Vui lòng thử lại.',
      )
    } finally {
      setPending(false)
    }
  }

  return (
    <form action={onSubmit} className="flex flex-col gap-5">
      <AuthHeading eyebrow="Đăng nhập" title="Chào mừng trở lại" />
      <AuthField label="Email hoặc số điện thoại" name="identifier" autoComplete="username" required />
      <AuthField label="Mật khẩu" name="password" type="password" autoComplete="current-password" required />
      <div className="flex justify-end">
        <Link to="/forgot-password" className="type-caption text-ink-secondary hover:text-foreground">
          Quên mật khẩu?
        </Link>
      </div>
      {error && <FormError>{error}</FormError>}
      <ArrowButton variant="primary" type="submit" disabled={pending} className="w-full">
        {pending ? 'Đang đăng nhập…' : 'Đăng nhập'}
      </ArrowButton>
      <GoogleButton next={params.get('next')}>Tiếp tục với Google</GoogleButton>
      <p className="text-center type-caption text-ink-tertiary">
        Chưa có tài khoản?{' '}
        <Link
          to={params.get('next') ? `/register?next=${encodeURIComponent(params.get('next')!)}` : '/register'}
          className="text-foreground underline"
        >
          Đăng ký
        </Link>
      </p>
    </form>
  )
}
