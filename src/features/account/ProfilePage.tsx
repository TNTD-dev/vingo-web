import { useMutation, useQueryClient } from '@tanstack/react-query'
import { User } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { getGetMeQueryKey, updateMe } from '@/api/generated/endpoints/me/me'
import { useAuth } from '@/auth/auth-context'
import { ArrowButton } from '@/design/ArrowButton'
import { initials } from '@/lib/initials'
import { profileFieldErrors } from '@/lib/profileErrors'
import { isVnPhone } from '@/lib/validate'

import { AccountShell } from './AccountShell'
import { AttendeesSection } from './AttendeesSection'

type Draft = { full_name: string; phone: string }

export default function ProfilePage() {
  const { user } = useAuth()
  const name = user?.full_name ?? ''
  const email = user?.email ?? ''
  const phone = user?.phone ?? ''

  return (
    <div className="flex flex-col gap-8 pt-1">
      <AccountShell
        left={
          <section className="flex flex-col gap-3 rounded-[20px] bg-ink p-6 text-on-ink">
            <span className="flex size-[72px] items-center justify-center rounded-pill bg-agent text-[24px] text-foreground">
              {initials(name) || <User aria-hidden />}
            </span>
            <p className="mt-1 type-h3">{name || 'Tài khoản Vingo'}</p>
            <p className="type-caption break-all text-on-ink-secondary">{email}</p>
          </section>
        }
      >
        <ProfileForm key={`${name}|${phone}`} base={{ full_name: name, phone }} email={email} />
        <AttendeesSection />
      </AccountShell>
    </div>
  )
}

function ProfileForm({ base, email }: { base: Draft; email: string }) {
  const queryClient = useQueryClient()
  const [v, setV] = useState<Draft>(base)
  const [errors, setErrors] = useState<Partial<Record<keyof Draft, string>>>({})

  const save = useMutation({
    mutationFn: () =>
      updateMe({
        full_name: v.full_name.trim(),
        phone: v.phone.trim() ? v.phone.replace(/[\s.-]/g, '') : undefined,
      }),
    onSuccess: (saved) => {
      queryClient.setQueryData(getGetMeQueryKey(), saved)
      toast.success('Đã cập nhật thông tin tài khoản')
    },
    onError: (e) => {
      const found = profileFieldErrors(e)
      if (Object.keys(found).length > 0) setErrors(found)
      toast.error(
        Object.keys(found).length > 0
          ? 'Thông tin chưa hợp lệ. Vui lòng kiểm tra lại.'
          : 'Chưa cập nhật được thông tin. Vui lòng thử lại.',
      )
    },
  })

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const found: typeof errors = {}
    if (!v.full_name.trim()) found.full_name = 'Nhập họ và tên'
    if (v.phone.trim() && !isVnPhone(v.phone)) found.phone = 'Số điện thoại chưa đúng'
    setErrors(found)
    if (Object.keys(found).length === 0) save.mutate()
  }

  const set = (k: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value })

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5 rounded-[20px] bg-surface p-6 sm:p-8">
      <header className="flex flex-col gap-1.5">
        <p className="type-mono-label text-ink-secondary uppercase">{'// Tài khoản của bạn'}</p>
        <h1 className="type-h1 text-foreground">Thông tin cá nhân</h1>
      </header>
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
      <Field label="Email" type="email" value={email} disabled autoComplete="email" />
      <div className="flex items-center justify-end pt-2">
        <ArrowButton type="submit" disabled={save.isPending}>
          {save.isPending ? 'Đang lưu...' : 'Lưu thay đổi'}
        </ArrowButton>
      </div>
    </form>
  )
}

function Field({
  label,
  error,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="type-caption text-ink-secondary">{label}</span>
      <input
        {...rest}
        aria-invalid={!!error}
        className="type-body h-11 rounded-[12px] border border-border bg-white px-4 text-foreground transition-colors outline-none focus:border-foreground disabled:bg-surface disabled:text-ink-secondary"
      />
      {error && <span className="text-error type-caption">{error}</span>}
    </label>
  )
}
