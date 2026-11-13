import { Bell, Sparkles } from 'lucide-react'
import { Link } from 'react-router'

import { useAuth } from '@/auth/auth-context'
import { logoMark } from '@/design/brand'
import { cn } from '@/lib/cn'

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts.at(-1)?.[0] ?? '') : '')).toUpperCase()
}

/** Thanh trên của màn Copilot (Figma C1): logo + ADMIN, công tắc "Quản trị | Copilot", chuông, tài khoản. */
export function AdminNav({ mode }: { mode: 'admin' | 'copilot' }) {
  const { user } = useAuth()
  const name = user?.full_name ?? user?.email ?? ''
  return (
    <nav aria-label="Điều hướng quản trị" className="flex items-center justify-between gap-3 px-3 pt-3 sm:px-8 sm:pt-4">
      <Link
        to="/admin"
        aria-label="Vingo Admin, về màn quản trị"
        className="flex min-w-0 shrink-0 items-center gap-3 rounded-pill bg-surface p-2 sm:py-2 sm:pr-3 sm:pl-4"
      >
        <img src={logoMark.light} alt="" className="h-[30px] w-auto sm:h-[30px]" />
        <span className="hidden font-brand text-[26px] leading-[1.2] font-semibold tracking-[-0.02em] sm:inline">
          vingo
        </span>
        <span className="hidden items-center gap-1.5 rounded-pill bg-ink px-2.5 py-1 type-mono-small text-on-ink uppercase sm:inline-flex">
          <span aria-hidden className="size-1.5 rounded-full bg-agent" />
          Admin
        </span>
      </Link>
      <div className="flex shrink-0 items-center gap-2.5">
        <div
          role="group"
          aria-label="Chế độ quản trị"
          className="flex items-center gap-0.5 rounded-pill bg-surface p-1"
        >
          <Link
            to="/admin"
            aria-current={mode === 'admin' ? 'page' : undefined}
            className={cn(
              'rounded-pill px-3.5 py-2.5 type-body-m-strong sm:px-4',
              mode === 'admin' ? 'bg-ink text-on-ink' : 'text-ink-secondary',
            )}
          >
            Quản trị
          </Link>
          <Link
            to="/admin/copilot"
            aria-current={mode === 'copilot' ? 'page' : undefined}
            className={cn(
              'flex items-center gap-1.5 rounded-pill px-3.5 py-2.5 type-body-m-strong sm:px-4',
              mode === 'copilot' ? 'bg-ink text-on-ink' : 'text-ink-secondary',
            )}
          >
            <Sparkles className={cn('size-3.5', mode === 'copilot' && 'text-agent')} aria-hidden />
            Copilot
          </Link>
        </div>
        <button
          type="button"
          disabled
          aria-label="Thông báo (sắp có)"
          className="hidden size-12 items-center justify-center rounded-pill bg-surface sm:flex"
        >
          <Bell className="size-[18px]" aria-hidden />
        </button>
        <div className="flex items-center gap-2.5 rounded-pill bg-surface p-1.5 sm:pr-4" title={name}>
          <span className="flex size-9 items-center justify-center rounded-pill bg-agent type-mono-small">
            {initials(name)}
          </span>
          <span className="hidden type-body-m-strong sm:inline">{name}</span>
        </div>
      </div>
    </nav>
  )
}
