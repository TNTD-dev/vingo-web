import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { useAuth } from '@/auth/auth-context'
import { tokenStore } from '@/auth/token-store'
import { isApiError } from '@/api/problem'
import { Logo } from '@/design/Logo'
import { mascot } from '@/design/brand'

import { Field } from '@/design/admin/AdminUi'
import { AdminAction } from '@/design/admin/AdminAction'
import '@/design/admin/admin.css'
export default function AdminLoginPage() {
  const { login } = useAuth(),
    navigate = useNavigate(),
    [params] = useSearchParams(),
    [error, setError] = useState(''),
    [pending, setPending] = useState(false)
  async function submit(form: FormData) {
    setPending(true)
    setError('')
    try {
      await login({
        identifier: String(form.get('identifier')),
        password: String(form.get('password')),
        device: 'Vingo Admin Web',
      })
      if (tokenStore.get()?.user?.role !== 'ADMIN') {
        setError('Tài khoản này không có quyền ADMIN.')
        return
      }
      const next = params.get('next')
      navigate(next && (next === '/admin' || next.startsWith('/admin/')) && !next.includes('\\') ? next : '/admin', {
        replace: true,
      })
    } catch (e) {
      setError(
        isApiError(e) && e.code === 'ACCOUNT_LOCKED'
          ? 'Tài khoản đã bị khóa tạm thời. Vui lòng thử lại sau.'
          : 'Không đăng nhập được. Kiểm tra email và mật khẩu rồi thử lại.',
      )
    } finally {
      setPending(false)
    }
  }
  return (
    <main className="admin admin-login">
      <section className="admin-login-brand">
        <div className="flex items-center gap-3">
          <Logo theme="dark" />
          <span className="admin-audit-badge is-agent text-ink">● ADMIN</span>
        </div>
        <img className="admin-login-mascot" src={mascot.listening} alt="Vingo" />
        <div>
          <h1>
            Bảng điều khiển
            <br />
            vận hành Vingo
          </h1>
          <p>Quản lý sự kiện, sơ đồ ghế, đơn hàng và check-in tại một nơi.</p>
        </div>
      </section>
      <section className="admin-login-form">
        <form action={submit}>
          <p className="admin-caption">// ĐĂNG NHẬP QUẢN TRỊ</p>
          <h2>Chào mừng trở lại</h2>
          {error && (
            <p role="alert" className="admin-login-error">
              △ {error}
            </p>
          )}
          <fieldset className="space-y-5" disabled={pending}>
            <Field label="Email công việc">
              <input name="identifier" type="email" required autoComplete="username" />
            </Field>
            <Field label="Mật khẩu">
              <input name="password" type="password" required autoComplete="current-password" />
            </Field>
          </fieldset>
          <div className="admin-login-help">
            <span>Phiên đăng nhập được bảo vệ</span>
            <Link to="/forgot-password">Quên mật khẩu?</Link>
          </div>
          <AdminAction className="w-full justify-start" disabled={pending}>
            {pending ? 'Đang đăng nhập…' : 'Đăng nhập'}
          </AdminAction>
          <p className="admin-login-note">Chỉ tài khoản có vai trò ADMIN. Mọi thao tác được ghi vào nhật ký audit.</p>
          {import.meta.env.VITE_USE_MOCK === 'true' && (
            <p className="mt-4 text-xs text-ink-secondary">Bản demo — không sử dụng tài khoản thật.</p>
          )}
        </form>
      </section>
    </main>
  )
}
