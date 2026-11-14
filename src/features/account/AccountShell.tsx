import { Lock, User } from 'lucide-react'
import { NavLink } from 'react-router'

import { cn } from '@/lib/cn'

const ITEMS = [
  { to: '/me', label: 'Hồ sơ người mua', icon: User, end: true },
  { to: '/me/security', label: 'Đăng nhập & bảo mật', icon: Lock, end: false },
]

/** Khung hai cột của B9 và B17: menu tài khoản bên trái, nội dung bên phải. */
export function AccountShell({ left, children }: { left?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <div className="flex w-full shrink-0 flex-col gap-4 lg:w-[256px]">
        {left}
        {!left && (
          <nav aria-label="Tài khoản" className="flex flex-col gap-1 rounded-[20px] bg-surface p-3">
            <AccountNav />
          </nav>
        )}
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

export function AccountNav() {
  return (
    <>
      {ITEMS.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-[12px] px-4 py-3 type-body-m-strong',
              isActive ? 'bg-ink text-on-ink' : 'text-foreground hover:bg-canvas',
            )
          }
        >
          <Icon className="size-4" aria-hidden />
          {label}
        </NavLink>
      ))}
    </>
  )
}
