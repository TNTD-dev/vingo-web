import { useMemo, useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router'

import { useAuth } from '@/auth/auth-context'
import { AdminNav } from '@/design/AdminNav'
import { AppNav } from '@/design/AppNav'
import stadium from '@/design/brand/stadium.jpg'
import { MascotLive } from '@/design/MascotLive'
import { Button } from '@/design/ui/button'
import { cn } from '@/lib/cn'

import { useCopilotShortcut } from './copilotShortcut'

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

const buyerNav: NavItem[] = [
  { to: '/events', label: 'Sự kiện' },
  { to: '/vingo', label: 'Vingo' },
  { to: '/orders', label: 'Đơn' },
  { to: '/tickets', label: 'Vé' },
  { to: '/me', label: 'Tài khoản' },
]

export function BuyerLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center gap-4 border-b px-4 py-2">
        <NavLink to="/" className="font-semibold">
          Vingo
        </NavLink>
        <div className="min-w-0 flex-1">
          <Nav items={buyerNav} />
        </div>
        <UserMenu />
      </header>
      <main className="flex flex-1 flex-col">
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

/** Nút mở Copilot ở góc màn quản trị (Figma `copilot-launcher`): mascot + "Mở Copilot ⌘J". */
function CopilotLauncher() {
  return (
    <Link
      to="/admin/copilot"
      aria-label="Mở Copilot (⌘J)"
      className="group fixed right-3 bottom-3 z-40 flex items-center sm:right-5 sm:bottom-5"
    >
      <span className="mr-1 hidden items-center gap-2 rounded-[16px] border border-line bg-surface py-2.5 pr-2.5 pl-3.5 shadow-float transition-transform group-hover:-translate-x-0.5 sm:flex">
        <span className="type-body-m-strong">Mở Copilot</span>
        <kbd className="rounded-[6px] bg-canvas px-1.5 py-0.5 type-mono-small text-ink-tertiary">⌘J</kbd>
      </span>
      <MascotLive mood="rest" className="size-[72px] drop-shadow-md sm:size-[91px]" />
    </Link>
  )
}

export function AdminLayout() {
  useCopilotShortcut('/admin/copilot')
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
      <CopilotLauncher />
    </div>
  )
}

/** Admin Copilot (Figma C1–C6): màn riêng, không có sidebar; công tắc "Quản trị | Copilot" và ⌘J để quay lại. */
export function CopilotLayout() {
  useCopilotShortcut('/admin')
  return (
    <div className="relative isolate flex h-dvh min-h-[560px] flex-col gap-3 bg-canvas sm:gap-4">
      <AdminNav mode="copilot" />
      <main className="flex min-h-0 flex-1 flex-col">
        <Outlet />
      </main>
    </div>
  )
}

/** Agent mode (Figma page 04): nền canvas, AppNav kiểu Figma, khung chat chiếm phần còn lại của màn hình. */
/** Trang con bật nền ảnh sân (màn chào Agent mode, Figma M1) qua `useOutletContext<AgentOutletContext>()`. */
export type AgentOutletContext = { setBackdrop: (on: boolean) => void }

export function AgentLayout() {
  const [backdrop, setBackdrop] = useState(false)
  const ctx = useMemo<AgentOutletContext>(() => ({ setBackdrop }), [])
  return (
    <div className="relative isolate flex h-dvh min-h-[560px] flex-col gap-3 bg-canvas sm:gap-4">
      {backdrop && (
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <img src={stadium} alt="" className="size-full object-cover" fetchPriority="high" />
          <div className="absolute inset-0 bg-linear-to-r from-canvas/90 via-canvas/60 via-50% to-canvas/15" />
        </div>
      )}
      <AppNav mode="vingo" />
      <main className="flex min-h-0 flex-1 flex-col">
        <Outlet context={ctx} />
      </main>
    </div>
  )
}

export function AuthLayout() {
  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <Outlet />
      </div>
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
