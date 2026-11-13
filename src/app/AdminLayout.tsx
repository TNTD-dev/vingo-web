import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router'
import { Menu } from 'lucide-react'

import { useAuth } from '@/auth/auth-context'
import { Logo } from '@/design/Logo'
import { StatusBadge } from '@/design/StatusBadge'
import { Button } from '@/design/ui/button'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/design/ui/sheet'
import { initials } from '@/lib/initials'
import '@/design/admin/admin.css'
import home from '@/design/admin/icons/home.svg'
import chart from '@/design/admin/icons/chart.svg'
import venue from '@/design/admin/icons/venue.svg'
import calendar from '@/design/admin/icons/calendar.svg'
import orders from '@/design/admin/icons/orders.svg'
import ticket from '@/design/admin/icons/ticket.svg'
import scan from '@/design/admin/icons/scan.svg'
import audit from '@/design/admin/icons/audit.svg'
import logoutIcon from '@/design/admin/icons/logout.svg'

const groups = [
  {
    label: 'Vận hành',
    links: [
      { to: '/admin', label: 'Tổng quan', icon: home },
      { to: '/admin/reports', label: 'Báo cáo', icon: chart },
    ],
  },
  {
    label: 'Catalog',
    links: [
      { to: '/admin/venues', label: 'Sân & sơ đồ ghế', icon: venue },
      { to: '/admin/events', label: 'Sự kiện & suất diễn', icon: calendar },
    ],
  },
  {
    label: 'Bán vé',
    links: [
      { to: '/admin/orders', label: 'Đơn hàng', icon: orders },
      { to: '/admin/tickets', label: 'Vé', icon: ticket },
      { to: '/admin/checkin', label: 'Check-in', icon: scan },
    ],
  },
  { label: 'Hệ thống', links: [{ to: '/admin/audit-logs', label: 'Nhật ký audit', icon: audit }] },
]

export function AdminLayout() {
  const { user, logout } = useAuth()
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return
      if (event.key.toLowerCase() === 'k') {
        const input = document.getElementById('admin-search')
        if (input) {
          event.preventDefault()
          input.focus()
        }
      }
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [])
  const navigation = (
    <nav aria-label="Điều hướng quản trị">
      {groups.map((group) => (
        <div key={group.label}>
          <p className="admin-nav-label">{group.label}</p>
          {group.links.map((link) => (
            <NavLink
              className="admin-nav-link"
              to={link.to}
              key={link.to}
              end={link.to === '/admin'}
              onClick={() => setOpen(false)}
            >
              <img src={link.icon} alt="" width="18" height="18" />
              {link.label}
            </NavLink>
          ))}
        </div>
      ))}
    </nav>
  )
  return (
    <div className="admin">
      <a className="sr-only focus:not-sr-only" href="#admin-content">
        Đến nội dung
      </a>
      <aside className="admin-sidebar">
        <Link to="/admin" className="flex items-center justify-between px-2 pb-2">
          <Logo theme="dark" />
          <StatusBadge tone="dark">Admin</StatusBadge>
        </Link>
        {navigation}
        <div className="mt-auto flex items-center gap-3 rounded-md bg-ink-raised p-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-pill bg-agent text-xs text-ink">
            {initials(user?.full_name ?? user?.email ?? 'Admin')}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm">{user?.full_name ?? 'Quản trị viên'}</p>
            <Link to="/events" className="text-xs text-on-ink-secondary hover:underline">
              {import.meta.env.VITE_USE_MOCK === 'true' ? 'Dữ liệu demo · Về trang mua vé' : user?.email}
            </Link>
          </div>
          <button type="button" aria-label="Đăng xuất" onClick={() => void logout()}>
            <img src={logoutIcon} alt="" width="18" height="18" />
          </button>
        </div>
      </aside>
      <div className="admin-main">
        <div className="admin-mobile-bar">
          <Link to="/admin">
            <Logo theme="dark" />
          </Link>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Mở menu quản trị">
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="admin-mobile-nav w-72 flex-col bg-ink text-on-ink">
              <SheetTitle className="px-3 pt-5 text-on-ink">Vingo Admin</SheetTitle>
              {navigation}
              <Button className="mt-auto" onClick={() => void logout()}>
                Đăng xuất
              </Button>
            </SheetContent>
          </Sheet>
        </div>
        <main id="admin-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
