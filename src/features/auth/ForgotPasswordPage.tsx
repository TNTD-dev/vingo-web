import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'

import { forgotPassword, resetPassword } from '@/api/generated/endpoints/auth/auth'
import type { OtpSession } from '@/api/generated/model'
import { isApiError } from '@/api/problem'
import { ArrowButton } from '@/design/ArrowButton'
import { OtpInput } from '@/design/OtpInput'
import { StatusBadge } from '@/design/StatusBadge'
import { maskEmail } from '@/lib/mask'
import { isEmail, MIN_PASSWORD } from '@/lib/validate'

import { AuthField, AuthHeading, FormError } from './authUi'

// B15 · Quên và đặt lại mật khẩu (Figma 03 · Buyer): bước 1 gửi mã về email, bước 2 nhập mã và mật khẩu mới.
export default function ForgotPasswordPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [emailError, setEmailError] = useState<string>()
  const [session, setSession] = useState<OtpSession>()
  const [sending, setSending] = useState(false)
  const [otp, setOtp] = useState('')
  const [pw, setPw] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState<{ pw?: string; confirm?: string; otp?: string }>({})
  const [formError, setFormError] = useState<string>()
  const [resetting, setResetting] = useState(false)

  async function send(e: React.FormEvent) {
    e.preventDefault()
    if (!isEmail(email)) return setEmailError('Email chưa đúng')
    setEmailError(undefined)
    setSending(true)
    try {
      // Backend luôn trả phiên OTP dù email có tồn tại hay không, để không lộ tài khoản.
      setSession(await forgotPassword({ email: email.trim() }))
      toast.success('Đã gửi mã đặt lại')
    } catch (err) {
      setEmailError(
        isApiError(err) && err.status === 429
          ? 'Bạn thử quá nhanh, vui lòng đợi một lát.'
          : 'Chưa gửi được mã. Thử lại sau.',
      )
    } finally {
      setSending(false)
    }
  }

  async function reset(e: React.FormEvent) {
    e.preventDefault()
    const found: typeof errors = {}
    if (otp.length !== 6) found.otp = 'Nhập đủ 6 số'
    if (pw.length < MIN_PASSWORD) found.pw = `Mật khẩu tối thiểu ${MIN_PASSWORD} ký tự`
    if (confirm !== pw) found.confirm = 'Mật khẩu nhập lại chưa khớp'
    setErrors(found)
    setFormError(undefined)
    if (Object.keys(found).length || !session?.otp_session_id) return
    setResetting(true)
    try {
      await resetPassword({ otp_session_id: session.otp_session_id, otp, new_password: pw })
      toast.success('Đã đặt lại mật khẩu. Hãy đăng nhập lại.')
      navigate('/login', { replace: true })
    } catch (err) {
      setFormError(
        isApiError(err) && (err.status === 400 || err.status === 401 || err.status === 422)
          ? 'Mã OTP chưa đúng hoặc đã hết hạn.'
          : 'Chưa đặt lại được mật khẩu. Vui lòng thử lại.',
      )
    } finally {
      setResetting(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <AuthHeading
        eyebrow="Quên mật khẩu · Bước 1"
        title="Lấy lại mật khẩu"
        hint="Nhập email đã đăng ký, Vingo gửi mã đặt lại có hiệu lực 10 phút."
      />
      <form onSubmit={(e) => void send(e)} noValidate className="flex flex-col gap-4">
        <AuthField
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={emailError}
          autoComplete="email"
        />
        <ArrowButton variant="primary" type="submit" disabled={sending} className="w-full">
          {sending ? 'Đang gửi…' : session ? 'Gửi lại mã' : 'Gửi mã đặt lại'}
        </ArrowButton>
      </form>

      {session && (
        <form onSubmit={(e) => void reset(e)} noValidate className="flex flex-col gap-4 rounded-[20px] bg-canvas p-6">
          <div className="flex items-center justify-between gap-2">
            <p className="type-mono-small text-ink-secondary uppercase">{'// Bước 2 · Đặt mật khẩu mới'}</p>
            <StatusBadge tone="success">Đã gửi mã</StatusBadge>
          </div>
          <p className="type-body-m-strong text-foreground">Mã 6 số trong email {maskEmail(email)}</p>
          <OtpInput value={otp} onChange={setOtp} invalid={!!errors.otp} />
          {errors.otp && <p className="type-caption text-danger">{errors.otp}</p>}
          <AuthField
            tone="canvas"
            label="Mật khẩu mới"
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            error={errors.pw}
            autoComplete="new-password"
          />
          <AuthField
            tone="canvas"
            label="Nhập lại mật khẩu mới"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            error={errors.confirm}
            autoComplete="new-password"
          />
          {formError && <FormError>{formError}</FormError>}
          <ArrowButton variant="primary" type="submit" disabled={resetting} className="w-full">
            {resetting ? 'Đang lưu…' : 'Đặt lại mật khẩu'}
          </ArrowButton>
          <p className="type-caption text-ink-tertiary">Đặt lại xong, mọi phiên đăng nhập cũ sẽ bị đăng xuất.</p>
        </form>
      )}

      <p className="text-center type-caption text-ink-tertiary">
        <Link to="/login" className="text-foreground underline">
          Quay lại đăng nhập
        </Link>
      </p>
    </div>
  )
}
