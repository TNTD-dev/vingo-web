import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router'

import type { EventCategory } from '@/api/generated/model'
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
 * Desktop (≥1320px) đúng một hàng như Figma; hẹp hơn thì tab xuống hàng thứ hai và cuộn ngang.
 */

type Tab = { label: string; to: string; isActive: (path: string, category: string | null) => boolean }

const TABS: Tab[] = [
  { label: 'Khám phá', to: '/events', isActive: (p, c) => p.startsWith('/events') && !c },
  ...(
    [
      ['Bóng đá', 'FOOTBALL'],
      ['Concert', 'CONCERT'],
      ['Sân khấu', 'THEATER'],
    ] as const satisfies readonly (readonly [string, EventCategory])[]
  ).map(([label, category]) => ({
    label,
    to: `/events?category=${category}`,
    isActive: (p: string, c: string | null) => p === '/events' && c === category,
  })),
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
  const [params] = useSearchParams()
  const category = params.get('category')
  const activeRef = useRef<HTMLAnchorElement>(null)
  // Màn hẹp: hàng tab cuộn ngang, kéo tab đang chọn vào khung nhìn.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [pathname, category])
  return (
    <nav aria-label="Điều hướng chính" className="flex items-center gap-8">
      {TABS.map((t) => {
        const active = t.isActive(pathname, category)
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

function ModeSwitch({ agent, className }: { agent: boolean; className?: string }) {
  const option = (active: boolean) =>
    cn(
      'flex items-center gap-1.5 rounded-pill px-4 py-2.5 type-body-m-strong whitespace-nowrap',
      focusRing,
      active ? 'bg-ink text-on-ink' : 'text-ink-secondary hover:text-foreground',
    )
  return (
    <div className={cn(pill, 'flex shrink-0 items-center gap-0.5 p-1', className)}>
      <Link to="/events" aria-current={!agent ? 'page' : undefined} className={option(!agent)}>
        Tự đặt
      </Link>
      <Link
        to="/vingo"
        aria-current={agent ? 'page' : undefined}
        className={cn(option(agent), !agent && 'text-foreground')}
      >
        <img src={agent ? icons.sparkAgent : icons.spark} alt="" className="size-3.5" />
        Vingo
      </Link>
    </div>
  )
}

function SearchBox() {
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  function submit(e: FormEvent) {
    e.preventDefault()
    const query = q.trim()
    navigate(query ? `/events?q=${encodeURIComponent(query)}` : '/events')
  }
  return (
    <search>
      <form
        onSubmit={submit}
        className={cn(
          pill,
          'flex h-12 shrink-0 items-center gap-2.5 px-[18px] focus-within:ring-2 focus-within:ring-ring',
        )}
      >
        <img src={icons.search} alt="" className="size-[18px]" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Tìm sự kiện"
          aria-label="Tìm sự kiện"
          className="w-20 appearance-none bg-transparent type-body-m text-foreground outline-none [transition:width_150ms] placeholder:text-ink-tertiary focus:w-44 [&::-webkit-search-cancel-button]:hidden"
        />
      </form>
    </search>
  )
}

function IconButton({ label, icon, to }: { label: string; icon: string; to?: string }) {
  const cls = cn(pill, focusRing, 'flex size-12 shrink-0 items-center justify-center')
  const img = <img src={icon} alt="" className="size-[18px]" />
  return to ? (
    <Link to={to} aria-label={label} className={cls}>
      {img}
    </Link>
  ) : (
    <button type="button" aria-label={label} className={cls}>
      {img}
    </button>
  )
}

function UserPill() {
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

  return (
    <header className="mx-auto w-full max-w-[1376px]">
      <div className="flex items-center justify-between gap-2.5">
        <div className={cn(pill, 'flex shrink-0 items-center gap-8 py-2 pr-6 pl-4 min-[1320px]:pr-7')}>
          <Link to="/" aria-label="Vingo — trang chủ" className={cn('rounded-sm', focusRing)}>
            <Logo />
          </Link>
          <div className="hidden min-[1320px]:block">
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
                <IconButton label="Tìm sự kiện" icon={icons.search} to="/events" />
              </div>
            </>
          )}
          <ModeSwitch agent={agent} className="hidden sm:flex" />
          {user ? <NotificationsMenu /> : <IconButton label="Thông báo" icon={icons.bell} to="/login" />}
          <UserPill />
        </div>
      </div>

      {/* Màn hẹp: chế độ + tab ở hàng thứ hai, cuộn ngang. */}
      <div className="mt-2.5 flex [scrollbar-width:none] items-center gap-2.5 overflow-x-auto min-[1320px]:hidden">
        <ModeSwitch agent={agent} className="sm:hidden" />
        <div className={cn(pill, 'flex h-12 shrink-0 items-center px-6')}>
          <Tabs />
        </div>
      </div>
    </header>
  )
}
