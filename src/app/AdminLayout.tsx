import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useMatch } from 'react-router'
import { Menu, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { Tooltip } from 'radix-ui'

import { useAuth } from '@/auth/auth-context'
import { Logo } from '@/design/Logo'
import { logoMark } from '@/design/brand'
import { MascotLive } from '@/design/MascotLive'
import { StatusBadge } from '@/design/StatusBadge'
import { Button } from '@/design/ui/button'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/design/ui/sheet'
import { initials } from '@/lib/initials'
import '@/design/admin/admin.css'
import '@/design/admin/admin-console-alignment.css'

import { useCopilotShortcut } from './copilotShortcut'
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
      { to: '/admin/users', label: 'Quản lý người dùng', icon: audit },
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
  { label: 'Hệ thống', links: [{ to: '/admin/audit-logs', label: 'Lịch sử hoạt động / Logs', icon: audit }] },
]

/** Nút mở Copilot ở góc màn quản trị (Figma `copilot-launcher`): mascot + "Mở Copilot ⌘J". */
function CopilotLauncher({ compact = false }: { compact?: boolean }) {
  if (compact)
    return (
      <Link
        to="/admin/copilot"
        className="fixed right-4 bottom-3 z-40 rounded-md border border-line bg-surface px-3 py-2 text-xs shadow-float"
        aria-label="Mở Copilot (⌘J)"
      >
        Mở Copilot ⌘J
      </Link>
    )
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

const COLLAPSED_KEY = 'vingo.admin.sidebar-collapsed'
function readCollapsed() {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === '1'
  } catch {
    return false
  }
}

/** Khi sidebar thu gọn chỉ còn icon: hiện tên mục bằng tooltip bên phải. */
function NavTip({ label, show, children }: { label: string; show: boolean; children: React.ReactElement }) {
  if (!show) return children
  return (
    <Tooltip.Root delayDuration={150}>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content side="right" sideOffset={12} className="admin-nav-tip">
          {label}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  )
}

export function AdminLayout() {
  const { user, logout } = useAuth()
  const venueDetail = useMatch('/admin/venues/:venueId')
  const compact = !!venueDetail && venueDetail.params.venueId !== 'new'
  const [open, setOpen] = useState(false),
    [collapsed, setCollapsed] = useState(readCollapsed)
  const toggle = () => setCollapsed((c) => !c)
  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSED_KEY, collapsed ? '1' : '0')
    } catch {
      // Không lưu được thì chỉ mất ghi nhớ giữa các lần mở trang.
    }
  }, [collapsed])
  useCopilotShortcut('/admin/copilot')
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return
      if (event.key.toLowerCase() === 'b') {
        event.preventDefault()
        toggle()
      }
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
  const navigation = (mini: boolean) => (
    <nav aria-label="Điều hướng quản trị">
      {groups.map((group) => (
        <div key={group.label}>
          <p className="admin-nav-label">{group.label}</p>
          {group.links.map((link) => (
            <NavTip key={link.to} label={link.label} show={mini}>
              <NavLink
                className="admin-nav-link"
                to={link.to}
                end={link.to === '/admin'}
                aria-label={mini ? link.label : undefined}
                onClick={() => setOpen(false)}
              >
                <img src={link.icon} alt="" width="18" height="18" />
                <span className="admin-nav-text">{link.label}</span>
              </NavLink>
            </NavTip>
          ))}
        </div>
      ))}
    </nav>
  )
  return (
    <Tooltip.Provider>
      <div
        className={compact ? 'admin admin-venue-console' : 'admin'}
        data-sidebar={collapsed ? 'collapsed' : 'expanded'}
      >
        <a className="sr-only focus:not-sr-only" href="#admin-content">
          Đến nội dung
        </a>
        <aside className="admin-sidebar" data-collapsed={collapsed || undefined}>
          <div className="admin-sidebar-top">
            <Link to="/admin" className="admin-sidebar-brand" aria-label="Vingo Admin · Tổng quan">
              {collapsed ? <img src={logoMark.light} alt="" className="h-[30px] w-auto" /> : <Logo theme="light" />}
              {!collapsed && <StatusBadge tone="dark">Admin</StatusBadge>}
            </Link>
            <NavTip label="Mở rộng (⌘B)" show={collapsed}>
              <button
                type="button"
                className="admin-sidebar-toggle"
                aria-label={collapsed ? 'Mở rộng thanh bên' : 'Thu gọn thanh bên'}
                aria-expanded={!collapsed}
                title={collapsed ? undefined : 'Thu gọn (⌘B)'}
                onClick={toggle}
              >
                {collapsed ? <PanelLeftOpen size={18} aria-hidden /> : <PanelLeftClose size={18} aria-hidden />}
              </button>
            </NavTip>
          </div>
          {navigation(collapsed)}
          <div className="admin-sidebar-user">
            <NavTip label={user?.full_name ?? 'Quản trị viên'} show={collapsed}>
              <span className="flex size-9 shrink-0 items-center justify-center rounded-pill bg-agent text-xs text-ink">
                {initials(user?.full_name ?? user?.email ?? 'Admin')}
              </span>
            </NavTip>
            <div className="admin-sidebar-user-text min-w-0 flex-1">
              <p className="truncate text-sm">{user?.full_name ?? 'Quản trị viên'}</p>
              <Link to="/events" className="text-xs text-on-ink-secondary hover:underline">
                {import.meta.env.VITE_USE_MOCK === 'true' ? 'Dữ liệu demo · Về trang mua vé' : user?.email}
              </Link>
            </div>
            <NavTip label="Đăng xuất" show={collapsed}>
              <button type="button" aria-label="Đăng xuất" onClick={() => void logout()}>
                <img src={logoutIcon} alt="" width="18" height="18" />
              </button>
            </NavTip>
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
                {navigation(false)}
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
        <CopilotLauncher compact={compact} />
      </div>
    </Tooltip.Provider>
  )
}
