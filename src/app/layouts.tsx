import { Link, NavLink, Outlet, useMatch } from 'react-router'

import { useAuth } from '@/auth/auth-context'
import authStadium from '@/design/brand/auth-stadium.png'
import { Logo } from '@/design/Logo'
import { Button } from '@/design/ui/button'
import { cn } from '@/lib/cn'

import { AppNav } from './AppNav'

type NavItem = { to: string; label: string; end?: boolean }

function Nav({ items, vertical = false }: { items: NavItem[]; vertical?: boolean }) {
  return (
    <nav className={cn('flex gap-1 text-sm', vertical ? 'flex-col' : 'overflow-x-auto')}>
      {items.map((i) => (
        <NavLink
          key={i.to}
          to={i.to}
          end={i.end}
          className={({ isActive }) =>
            cn('rounded-md px-3 py-1.5 whitespace-nowrap hover:bg-accent', isActive && 'bg-accent font-medium')
          }
        >
          {i.label}
        </NavLink>
      ))}
    </nav>
  )
}

function UserMenu() {
  const { user, logout } = useAuth()
  if (!user) {
    return (
      <Button asChild size="sm" variant="outline">
        <NavLink to="/login">Đăng nhập</NavLink>
      </Button>
    )
  }
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="hidden text-muted-foreground sm:inline">{user.full_name ?? user.email}</span>
      <Button size="sm" variant="ghost" onClick={() => void logout()}>
        Đăng xuất
      </Button>
    </div>
  )
}

// Khung buyer theo Figma (B1–B17): nền canvas, AppNav cách đỉnh 16px, lề ngang 32px (16px trên điện thoại),
// nội dung rộng tối đa 1376px, cách nav 28px.
export function BuyerLayout() {
  // B11 (vé & QR toàn màn) dùng nền tối.
  const dark = useMatch('/tickets/:ticketId') !== null
  return (
    <div className={cn('flex min-h-dvh flex-col px-4 pt-4 pb-16 sm:px-8', dark ? 'bg-ink' : 'bg-canvas')}>
      <AppNav />
      <main className="mx-auto mt-7 flex w-full max-w-[1376px] min-w-0 flex-1 flex-col">
        <Outlet />
      </main>
    </div>
  )
}

const adminNav: NavItem[] = [
  { to: '/admin', label: 'Tổng quan', end: true },
  { to: '/admin/reports', label: 'Báo cáo' },
  { to: '/admin/venues', label: 'Sân' },
  { to: '/admin/events', label: 'Sự kiện' },
  { to: '/admin/orders', label: 'Đơn hàng' },
  { to: '/admin/tickets', label: 'Vé' },
  { to: '/admin/audit-logs', label: 'Nhật ký' },
]

export function AdminLayout() {
  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <aside className="border-b p-3 md:w-56 md:border-r md:border-b-0">
        <div className="mb-3 flex items-center justify-between">
          <NavLink to="/admin" className="font-semibold">
            Vingo Admin
          </NavLink>
          <div className="md:hidden">
            <UserMenu />
          </div>
        </div>
        <div className="md:hidden">
          <Nav items={adminNav} />
        </div>
        <div className="hidden md:block">
          <Nav items={adminNav} vertical />
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="hidden justify-end border-b px-4 py-2 md:flex">
          <UserMenu />
        </header>
        <main className="flex flex-1 flex-col">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

// Khung đăng nhập/đăng ký theo Figma B8, B14, B15: ảnh sân + khẩu hiệu bên trái, form trên nền trắng bên phải.
export function AuthLayout() {
  return (
    <div className="grid min-h-dvh gap-4 bg-canvas p-4 lg:grid-cols-[772fr_620fr]">
      <aside className="relative hidden flex-col justify-between overflow-hidden rounded-[30px] p-10 lg:flex">
        <img src={authStadium} alt="" className="absolute inset-0 size-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-canvas/0 from-35% to-canvas/95" />
        <Link to="/" aria-label="Vingo" className="relative w-fit">
          <Logo />
        </Link>
        <div className="relative flex flex-col gap-3">
          <p className="type-display-l text-foreground">
            Vé thật.
            <br />
            Ghế thật.
            <br />
            Chỉ một câu chat.
          </p>
          <p className="type-body-l text-ink-secondary">Đăng nhập để giữ ghế, thanh toán và nhận vé QR.</p>
        </div>
      </aside>
      <main className="flex items-center justify-center rounded-[30px] bg-surface px-6 py-10 sm:px-12">
        <div className="flex w-full max-w-[476px] flex-col gap-8">
          <Link to="/" aria-label="Vingo" className="w-fit lg:hidden">
            <Logo />
          </Link>
          <Outlet />
        </div>
      </main>
    </div>
  )
}

export function PlainLayout() {
  return (
    <main className="flex min-h-dvh flex-col">
      <Outlet />
    </main>
  )
}
