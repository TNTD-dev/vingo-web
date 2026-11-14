import { useMutation, useQueryClient } from '@tanstack/react-query'
import { User } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { getGetBuyerProfileQueryKey, putBuyerProfile, useGetBuyerProfile } from '@/api/generated/endpoints/me/me'
import { isApiError } from '@/api/problem'
import { useAuth } from '@/auth/auth-context'
import { ArrowButton } from '@/design/ArrowButton'
import { Skeleton } from '@/design/ui/skeleton'
import { initials } from '@/lib/initials'
import { profileFieldErrors } from '@/lib/profileErrors'
import { isEmail, isVnPhone } from '@/lib/validate'

import { AccountShell } from './AccountShell'

type Draft = { full_name: string; phone: string; email: string }

// B9 · Hồ sơ người mua (Figma 03 · Buyer). Hồ sơ này được dùng cho thanh toán và đặt hộ qua Vingo.
export default function ProfilePage() {
  const me = { data: useAuth().user }
  const profile = useGetBuyerProfile({ query: { retry: false } })
  const missing = profile.isError && isApiError(profile.error, 'NOT_FOUND')

  if (profile.isPending && !profile.isError) return <Skeleton className="h-[420px] rounded-[20px]" />
  const name = profile.data?.full_name ?? me.data?.full_name ?? ''
  const base: Draft = {
    full_name: profile.data?.full_name ?? me.data?.full_name ?? '',
    phone: profile.data?.phone ?? me.data?.phone ?? '',
    email: profile.data?.email ?? me.data?.email ?? '',
  }

  return (
    <div className="flex flex-col gap-8 pt-1">
      <AccountShell
        left={
          <section className="flex flex-col gap-3 rounded-[20px] bg-ink p-6 text-on-ink">
            <span className="flex size-[72px] items-center justify-center rounded-pill bg-agent text-[24px] text-foreground">
              {initials(name) || <User aria-hidden />}
            </span>
            <p className="mt-1 type-h3">{name || 'Tài khoản Vingo'}</p>
            <p className="type-caption break-all text-on-ink-secondary">{base.email}</p>
          </section>
        }
      >
        <ProfileForm key={`${base.full_name}|${base.phone}|${base.email}`} base={base} missing={missing} />
      </AccountShell>
    </div>
  )
}

function ProfileForm({ base, missing }: { base: Draft; missing: boolean }) {
  const queryClient = useQueryClient()
  const [v, setV] = useState<Draft>(base)
  const [errors, setErrors] = useState<Partial<Record<keyof Draft, string>>>({})

  const save = useMutation({
    mutationFn: () =>
      putBuyerProfile({ full_name: v.full_name.trim(), phone: v.phone.replace(/[\s.-]/g, ''), email: v.email.trim() }),
    onSuccess: (saved) => {
      queryClient.setQueryData(getGetBuyerProfileQueryKey(), saved)
      toast.success('Đã lưu hồ sơ')
    },
    onError: (e) => {
      const found = profileFieldErrors(e)
      if (Object.keys(found).length > 0) setErrors(found)
      toast.error(
        Object.keys(found).length > 0
          ? 'Thông tin chưa hợp lệ. Vui lòng kiểm tra lại.'
          : 'Chưa lưu được hồ sơ. Vui lòng thử lại.',
      )
    },
  })

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const found: typeof errors = {}
    if (!v.full_name.trim()) found.full_name = 'Nhập họ và tên'
    if (!isVnPhone(v.phone)) found.phone = 'Số điện thoại chưa đúng'
    if (!isEmail(v.email)) found.email = 'Email chưa đúng'
    setErrors(found)
    if (Object.keys(found).length === 0) save.mutate()
  }

  const set = (k: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value })

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5 rounded-[20px] bg-surface p-6 sm:p-8">
      <header className="flex flex-col gap-1.5">
        <p className="type-mono-label text-ink-secondary uppercase">{'// Hồ sơ người mua'}</p>
        <h1 className="type-h1 text-foreground">Thông tin cá nhân</h1>
      </header>
      {missing && (
        <p className="flex items-center gap-3 rounded-[12px] border border-agent bg-agent-soft px-4 py-3 type-caption text-ink-secondary">
          <User className="size-3.5 shrink-0" aria-hidden />
          Hoàn thiện hồ sơ để đặt vé. Vingo cũng dùng thông tin này khi đặt hộ bạn.
        </p>
      )}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="Họ và tên"
          value={v.full_name}
          onChange={set('full_name')}
          error={errors.full_name}
          autoComplete="name"
        />
        <Field
          label="Số điện thoại"
          value={v.phone}
          onChange={set('phone')}
          error={errors.phone}
          autoComplete="tel"
          inputMode="tel"
        />
      </div>
      <Field
        label="Email"
        type="email"
        value={v.email}
        onChange={set('email')}
        error={errors.email}
        autoComplete="email"
      />
      <div className="flex flex-wrap gap-3">
        <ArrowButton variant="primary" type="submit" disabled={save.isPending}>
          {save.isPending ? 'Đang lưu…' : 'Lưu hồ sơ'}
        </ArrowButton>
        <ArrowButton to="/me/security">Đổi mật khẩu</ArrowButton>
      </div>
    </form>
  )
}

function Field({ label, error, ...input }: { label: string; error?: string } & React.ComponentProps<'input'>) {
  return (
    <label className="flex flex-col gap-2">
      <span className="type-mono-small text-ink-secondary uppercase">{label}</span>
      <input
        {...input}
        aria-invalid={error ? true : undefined}
        className="h-[46px] rounded-[14px] border border-line bg-surface px-4 type-body-m text-foreground outline-none focus:border-foreground aria-[invalid=true]:border-danger"
      />
      {error && <span className="type-caption text-danger">{error}</span>}
    </label>
  )
}
