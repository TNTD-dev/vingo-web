import { useId, type ComponentProps, type ReactNode } from 'react'

import { API_BASE } from '@/api/config'
import { cn } from '@/lib/cn'

/** Tiêu đề form: dòng mono nhỏ phía trên + tiêu đề lớn (Figma B8: "// ĐĂNG NHẬP" / "Chào mừng trở lại"). */
export function AuthHeading({ eyebrow, title, hint }: { eyebrow: string; title: string; hint?: string }) {
  return (
    <header className="flex flex-col gap-1.5">
      <p className="type-mono-label text-ink-secondary uppercase">{`// ${eyebrow}`}</p>
      <h1 className="type-h1 text-foreground">{title}</h1>
      {hint && <p className="type-caption text-ink-tertiary">{hint}</p>}
    </header>
  )
}

/** Ô nhập kiểu Figma: nhãn mono viết hoa, ô bo tròn viền nhạt cao 46px. */
export function AuthField({
  label,
  error,
  className,
  tone = 'surface',
  ...input
}: { label: string; error?: string; tone?: 'surface' | 'canvas' } & Omit<ComponentProps<'input'>, 'className'> & {
    className?: string
  }) {
  const id = useId()
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <label htmlFor={id} className="type-mono-small text-ink-secondary uppercase">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-err` : undefined}
        {...input}
        className={cn(
          'h-[46px] w-full rounded-[14px] border px-4 type-body-m text-foreground outline-none placeholder:text-ink-tertiary focus:border-foreground',
          tone === 'surface' ? 'border-line bg-surface' : 'border-transparent bg-surface',
          error && 'border-danger',
        )}
      />
      {error && (
        <p id={`${id}-err`} className="type-caption text-danger">
          {error}
        </p>
      )}
    </div>
  )
}

/** Nút Google (đăng nhập qua trình duyệt, không qua client sinh: CLAUDE.md mục 3). */
export function GoogleButton({ children }: { children: ReactNode }) {
  return (
    <a
      href={`${API_BASE}/auth/google`}
      className="flex h-[54px] items-center justify-center gap-2.5 rounded-[14px] border border-line bg-surface type-body-m-strong text-foreground"
    >
      <span aria-hidden className="flex size-[18px] items-center justify-center text-[15px] font-semibold">
        G
      </span>
      {children}
    </a>
  )
}

export function FormError({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="rounded-[12px] bg-danger/10 px-4 py-3 type-body-m text-danger">
      {children}
    </p>
  )
}
