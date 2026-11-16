import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router'

import { useAuth } from '@/auth/auth-context'
import { icons } from '@/design/icons'
import { Logo } from '@/design/Logo'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/design/ui/dropdown-menu'
import { cn } from '@/lib/cn'
import { initials } from '@/lib/initials'

import { NotificationsMenu } from './NotificationsMenu'

/*
 * Thanh điều hướng buyer — Figma: Design System › AppNav (Mode=Tự đặt / Vingo).
 * Desktop (≥1280px) đúng một hàng như Figma; hẹp hơn thì tab xuống hàng thứ hai và cuộn ngang.
 */

type Tab = { label: string; to: string; isActive: (path: string) => boolean }

// Chỉ giữ đích thật; lọc thể loại nằm ở sidebar trang Khám phá.
const TABS: Tab[] = [
  { label: 'Khám phá', to: '/events', isActive: (p) => p.startsWith('/events') },
  {
    label: 'Vé của tôi',
    to: '/tickets',
    isActive: (p) => p.startsWith('/tickets') || /^\/orders\/[^/]+\/success$/.test(p),
  },
  { label: 'Đơn hàng', to: '/orders', isActive: (p) => p.startsWith('/orders') && !/\/success$/.test(p) },
]

const pill = 'rounded-pill bg-surface'
const focusRing = 'outline-none focus-visible:ring-2 focus-visible:ring-ring'

function Tabs() {
  const { pathname } = useLocation()
  const activeRef = useRef<HTMLAnchorElement>(null)
  // Màn hẹp: hàng tab cuộn ngang, kéo tab đang chọn vào khung nhìn.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [pathname])
  return (
    <nav aria-label="Điều hướng chính" className="flex items-center gap-8">
      {TABS.map((t) => {
        const active = t.isActive(pathname)
        return (
          <Link
            key={t.label}
            ref={active ? activeRef : undefined}
            to={t.to}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'shrink-0 rounded-sm whitespace-nowrap',
              focusRing,
              active ? 'type-body-m-strong text-foreground' : 'type-body-m text-ink-secondary hover:text-foreground',
            )}
          >
            {t.label}
          </Link>
        )
      })}
    </nav>
  )
}

const SEARCH_SCOPES = [
  { path: '/tickets', placeholder: 'Tìm trong vé của tôi' },
  { path: '/orders', placeholder: 'Tìm trong đơn hàng' },
]

function SearchBox({ wide, focusOnMount, onDone }: { wide?: boolean; focusOnMount?: boolean; onDone?: () => void }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [params] = useSearchParams()
  // Ở Vé của tôi / Đơn hàng thì tìm ngay trong trang đó; còn lại tìm sự kiện ở Khám phá.
  const scope = SEARCH_SCOPES.find((s) => pathname === s.path)
  const [q, setQ] = useState(scope ? (params.get('q') ?? '') : '')
  const inputRef = useRef<HTMLInputElement>(null)
  // Người dùng vừa bấm biểu tượng tìm kiếm nên đưa con trỏ vào ô.
  useEffect(() => {
    if (focusOnMount) inputRef.current?.focus()
  }, [focusOnMount])
  function submit(e: FormEvent) {
    e.preventDefault()
    const query = q.trim()
    if (scope) {
      const next = new URLSearchParams(params)
      if (query) next.set('q', query)
      else next.delete('q')
      navigate({ pathname: scope.path, search: next.toString() }, { replace: true })
    } else {
      navigate(query ? `/events?q=${encodeURIComponent(query)}` : '/events')
    }
    onDone?.()
  }
  return (
    <search>
      <form
        onSubmit={submit}
        className={cn(
          pill,
          'flex h-12 items-center gap-2.5 px-[18px] focus-within:ring-2 focus-within:ring-ring',
          wide ? 'w-full' : 'shrink-0',
        )}
      >
        <img src={icons.search} alt="" className="size-[18px]" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={scope?.placeholder ?? 'Tìm sự kiện'}
          aria-label={scope?.placeholder ?? 'Tìm sự kiện'}
          ref={inputRef}
          className={cn(
            'appearance-none bg-transparent type-body-m text-foreground outline-none placeholder:text-ink-tertiary [&::-webkit-search-cancel-button]:hidden',
            wide ? 'min-w-0 flex-1' : 'w-20 [transition:width_150ms] focus:w-44',
          )}
        />
      </form>
    </search>
  )
}

function IconButton({
  label,
  icon,
  to,
  onClick,
  pressed,
}: {
  label: string
  icon: string
  to?: string
  onClick?: () => void
  pressed?: boolean
}) {
  const cls = cn(pill, focusRing, 'flex size-12 shrink-0 items-center justify-center')
  const img = <img src={icon} alt="" className="size-[18px]" />
  return to ? (
    <Link to={to} aria-label={label} className={cls}>
      {img}
    </Link>
  ) : (
    <button type="button" aria-label={label} aria-expanded={pressed} onClick={onClick} className={cls}>
      {img}
    </button>
  )
}

/** Pill tài khoản; landing dùng chung để giống các trang khác. */
export function UserPill() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  if (!user) {
    return (
      <Link to="/login" className={cn(pill, focusRing, 'flex h-12 shrink-0 items-center px-5 type-body-m-strong')}>
        Đăng nhập
      </Link>
    )
  }

  const name = user.full_name || user.email || ''
  const item = (to: string, label: ReactNode) => (
    <DropdownMenuItem onSelect={() => navigate(to)}>{label}</DropdownMenuItem>
  )
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(pill, focusRing, 'flex h-12 shrink-0 items-center gap-2.5 p-1.5 lg:pr-4')}
        aria-label="Tài khoản"
      >
        <span className="flex size-9 items-center justify-center rounded-pill bg-ink type-mono-small text-on-ink">
          {initials(name)}
        </span>
        <span className="hidden max-w-40 truncate type-body-m-strong lg:inline">{name}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="min-w-48 rounded-md">
        {user.role === 'ADMIN' && item('/admin', 'Quản trị')}
        {item('/me', 'Hồ sơ')}
        {item('/me/security', 'Tài khoản & bảo mật')}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void logout()}>Đăng xuất</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function AppNav() {
  const { user } = useAuth()
  const { pathname } = useLocation()
  const agent = pathname.startsWith('/vingo')
  // Nhớ trang đã mở ô tìm kiếm: đổi trang thì tự coi như đóng (không cần effect).
  const [openAt, setOpenAt] = useState<string>()
  const searchOpen = openAt === pathname

  return (
    <header className="mx-auto w-full max-w-[1376px]">
      <div className="flex items-center justify-between gap-2.5">
        <div className={cn(pill, 'flex shrink-0 items-center gap-8 py-2 pr-6 pl-4 xl:pr-7')}>
          <Link to="/" aria-label="Vingo — trang chủ" className={cn('rounded-sm', focusRing)}>
            <Logo />
          </Link>
          <div className="hidden xl:block">
            <Tabs />
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {!agent && (
            <>
              <div className="hidden md:block">
                <SearchBox />
              </div>
              <div className="md:hidden">
                <IconButton
                  label={SEARCH_SCOPES.find((x) => x.path === pathname)?.placeholder ?? 'Tìm sự kiện'}
                  icon={icons.search}
                  pressed={searchOpen}
                  onClick={() => setOpenAt(searchOpen ? undefined : pathname)}
                />
              </div>
            </>
          )}
          {user ? <NotificationsMenu /> : <IconButton label="Thông báo" icon={icons.bell} to="/login" />}
          <UserPill />
        </div>
      </div>

      {/* Mobile: ô tìm kiếm mở ngay tại trang hiện tại, chỉ chuyển sang Khám phá khi gửi. */}
      {!agent && searchOpen && (
        <div className="mt-2.5 md:hidden">
          <SearchBox wide focusOnMount onDone={() => setOpenAt(undefined)} />
        </div>
      )}

      {/* Màn hẹp: tab ở hàng thứ hai, cuộn ngang. */}
      <div className="mt-2.5 flex [scrollbar-width:none] items-center gap-2.5 overflow-x-auto xl:hidden">
        <div className={cn(pill, 'flex h-12 shrink-0 items-center px-6')}>
          <Tabs />
        </div>
      </div>
    </header>
  )
}
