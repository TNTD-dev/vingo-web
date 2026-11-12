import { NavLink, Outlet } from 'react-router'

import { useAuth } from '@/auth/auth-context'
import { Button } from '@/design/ui/button'
import { cn } from '@/lib/cn'

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
  { to: '/', label: 'Chat', end: true },
  { to: '/events', label: 'Sự kiện' },
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
  { to: '/admin', label: 'Copilot', end: true },
  { to: '/admin/dashboard', label: 'Báo cáo' },
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
