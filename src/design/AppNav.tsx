import { Bell } from 'lucide-react'
import { Link, NavLink } from 'react-router'

import { useAuth } from '@/auth/auth-context'
import { logoMark } from '@/design/brand'
import { cn } from '@/lib/cn'

const LINKS = [
  { to: '/events', label: 'Khám phá' },
  { to: '/tickets', label: 'Vé của tôi' },
  { to: '/orders', label: 'Đơn hàng' },
] as const

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts.at(-1)?.[0] ?? '') : '')).toUpperCase()
}

/** AppNav của Agent mode (Figma 10:70, Mode=Vingo): logo + liên kết, chuông, tài khoản. Về tự đặt qua tab "Khám phá". */
export function AppNav() {
  const { user } = useAuth()
  const name = user?.full_name ?? user?.email ?? ''
  return (
    <nav aria-label="Điều hướng chính" className="flex items-center justify-between gap-3 px-3 pt-3 sm:px-8 sm:pt-4">
      <div className="flex min-w-0 items-center gap-8 rounded-pill bg-surface py-2 pr-4 pl-4 lg:pr-7">
        <Link to="/" className="flex items-center gap-2" aria-label="Vingo, về trang chủ">
          <img src={logoMark.light} alt="" className="h-[30px] w-auto" />
          <span className="font-brand text-[26px] leading-[1.2] font-semibold tracking-[-0.02em]">vingo</span>
        </Link>
        <ul className="hidden items-center gap-8 lg:flex">
          {LINKS.map((l) => (
            <li key={l.label}>
              <NavLink to={l.to} className={cn('type-body-m', 'text-ink-secondary hover:text-ink')}>
                {l.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </div>
      <div className="flex shrink-0 items-center gap-2.5">
        <button
          type="button"
          disabled
          aria-label="Thông báo (sắp có)"
          className="hidden size-12 items-center justify-center rounded-pill bg-surface sm:flex"
        >
          <Bell className="size-[18px]" aria-hidden />
        </button>
        {user ? (
          <Link
            to="/me"
            className="flex items-center gap-2.5 rounded-pill bg-surface p-1.5 sm:pr-4"
            aria-label="Tài khoản"
          >
            <span className="flex size-9 items-center justify-center rounded-pill bg-ink type-mono-small text-on-ink">
              {initials(name)}
            </span>
            <span className="hidden type-body-m-strong sm:inline">{name}</span>
          </Link>
        ) : (
          <Link to="/login" className="rounded-pill bg-surface px-5 py-3 type-body-m-strong">
            Đăng nhập
          </Link>
        )}
      </div>
    </nav>
  )
}
