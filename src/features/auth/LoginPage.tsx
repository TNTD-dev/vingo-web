import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'

import { API_BASE } from '@/api/config'
import { isApiError } from '@/api/problem'
import { useAuth } from '@/auth/auth-context'
import { Button } from '@/design/ui/button'
import { Input } from '@/design/ui/input'
import { Label } from '@/design/ui/label'

/** Form tối thiểu để đăng nhập được khi dựng khung. Thiết kế lại sau. */
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
      await login({ identifier: String(form.get('identifier')), password: String(form.get('password')) })
      navigate(params.get('next') ?? '/', { replace: true })
    } catch (e) {
      setError(isApiError(e) ? (e.problem?.detail ?? e.message) : 'Không đăng nhập được')
    } finally {
      setPending(false)
    }
  }

  return (
    <form action={onSubmit} className="space-y-4">
      <h1 className="text-xl font-semibold">Đăng nhập</h1>
      <div className="space-y-2">
        <Label htmlFor="identifier">Email hoặc số điện thoại</Label>
        <Input id="identifier" name="identifier" autoComplete="username" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Mật khẩu</Label>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="w-full" disabled={pending}>
        Đăng nhập
      </Button>
      <Button asChild variant="outline" className="w-full">
        <a href={`${API_BASE}/auth/google`}>Đăng nhập bằng Google</a>
      </Button>
      <p className="flex justify-between text-sm text-muted-foreground">
        <Link to="/register">Đăng ký</Link>
        <Link to="/forgot-password">Quên mật khẩu</Link>
      </p>
    </form>
  )
}
