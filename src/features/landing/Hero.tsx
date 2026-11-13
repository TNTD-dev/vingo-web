import { ArrowUpRight, Sparkle, User } from 'lucide-react'
import { useRef, useState, type PointerEvent } from 'react'
import { Link, useNavigate } from 'react-router'

import { useAuth } from '@/auth/auth-context'
import { logoMark } from '@/design/brand'
import { cn } from '@/lib/cn'

import { agentPath } from './agentLink'
import { AskBar } from './AskBar'
import heroImage from './assets/hero.jpg'
import { usePrefersReducedMotion } from './hooks'
import { MascotLive } from './MascotLive'
import { EXAMPLE_PROMPTS, HERO_CHIPS } from './prompts'

const NAV = [
  { to: '/events', label: 'Sự kiện' },
  { to: '/events?category=FOOTBALL', label: 'Bóng đá' },
  { to: '/events?category=CONCERT', label: 'Concert' },
  { to: '/events?category=THEATER', label: 'Sân khấu' },
]

function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2" aria-label="Vingo, trang chủ">
      <img src={logoMark.light} alt="" className="h-[30px] w-[23px]" />
      <span className="font-brand text-[26px] leading-[1.2] font-semibold tracking-[-0.02em] text-ink">vingo</span>
    </Link>
  )
}

function Navbar() {
  const { user } = useAuth()
  return (
    <nav aria-label="Điều hướng chính" className="relative flex items-center justify-between gap-3">
      <div className="flex items-center gap-9 rounded-pill bg-surface py-2 pr-8 pl-4 max-lg:pr-4">
        <Logo />
        {NAV.map((n) => (
          <Link key={n.label} to={n.to} className="hidden type-body-m text-ink-secondary hover:text-ink lg:block">
            {n.label}
          </Link>
        ))}
        <Link to="/tickets" className="hidden type-body-m text-ink-secondary hover:text-ink lg:block">
          Vé của tôi
        </Link>
      </div>
      <div className="flex items-center gap-2.5">
        <Link
          to="/tickets"
          className="hidden rounded-pill bg-surface px-[18px] py-3.5 type-body-m-strong text-ink md:block"
        >
          Vé của tôi
        </Link>
        <Link
          to={user ? '/me' : '/login'}
          className="flex items-center gap-2.5 rounded-pill bg-surface py-1.5 pr-4 pl-1.5 type-body-m-strong text-ink"
        >
          <span className="flex size-8 items-center justify-center rounded-[10px] bg-ink text-on-ink">
            <User className="size-4" />
          </span>
          <span className="max-w-[140px] truncate">{user ? (user.full_name ?? 'Tài khoản') : 'Đăng nhập'}</span>
        </Link>
      </div>
    </nav>
  )
}

function FlyingTicket({
  className,
  tone,
  code,
  text,
}: {
  className?: string
  tone: 'lime' | 'dark'
  code: string
  text: string
}) {
  const lime = tone === 'lime'
  return (
    <div
      aria-hidden
      className={cn(
        'relative h-24 w-[170px] rounded-[16px] border-2 border-ink shadow-[0_18px_15px_rgb(0_0_0/0.18)]',
        lime ? 'bg-agent text-ink' : 'h-20 w-[140px] bg-ink text-agent',
        className,
      )}
    >
      <span className="absolute top-1/2 -left-3 size-5 -translate-y-1/2 rounded-full border-2 border-ink bg-canvas" />
      <span className="absolute top-1/2 -right-3 size-5 -translate-y-1/2 rounded-full border-2 border-ink bg-canvas" />
      <p className="absolute top-4 left-4 font-mono text-xs">{code}</p>
      <p className={cn('absolute left-4 text-[22px] font-semibold', lime ? 'top-[52px]' : 'top-9')}>{text}</p>
    </div>
  )
}

export function Hero() {
  const navigate = useNavigate()
  const reduced = usePrefersReducedMotion()
  const rootRef = useRef<HTMLElement>(null)
  const [listening, setListening] = useState(false)

  const go = (q?: string) => void navigate(agentPath(q))

  // Parallax ngược hướng chuột, tối đa 20px (tắt khi giảm chuyển động).
  const onPointerMove = (e: PointerEvent<HTMLElement>) => {
    const el = rootRef.current
    if (reduced || !el || e.pointerType === 'touch') return
    const r = el.getBoundingClientRect()
    el.style.setProperty('--mx', String(((e.clientX - r.left) / r.width - 0.5) * 2))
    el.style.setProperty('--my', String(((e.clientY - r.top) / r.height - 0.5) * 2))
  }

  return (
    <header
      ref={rootRef}
      onPointerMove={onPointerMove}
      className="relative flex min-h-[760px] flex-col overflow-hidden rounded-xl px-4 pt-4 pb-6 sm:px-8 sm:pt-6 sm:pb-8 lg:min-h-[900px]"
    >
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <img src={heroImage} alt="" className="size-full object-cover" fetchPriority="high" />
        <div className="absolute inset-0 bg-linear-to-r from-canvas/95 via-canvas/55 via-42% to-canvas/0 to-62% max-lg:from-canvas/90 max-lg:via-canvas/75 max-lg:to-canvas/50" />
      </div>

      <Navbar />

      <div className="relative flex flex-1 flex-col items-start justify-end gap-10 pt-24 lg:flex-row lg:items-end lg:justify-between lg:pt-24">
        <div className="flex w-full max-w-[720px] flex-col items-start gap-6">
          <h1 className="flex flex-col items-start type-display-l">
            <span className="block overflow-hidden pb-[0.12em] text-ink-tertiary">
              {'Săn vé mọi sự kiện.'.split(' ').map((w, i) => (
                <span key={i} className="lp-word" style={{ ['--i' as string]: i }}>
                  {w}
                  {' '}
                </span>
              ))}
            </span>
            <span className="relative -mt-1 inline-block max-w-full px-5 pb-1.5 lg:rotate-[1.5deg]">
              <span aria-hidden className="lp-marker-bg absolute inset-0 rounded-[28px] bg-agent" />
              <span className="lp-marker-text relative text-ink">Chỉ cần nói một câu.</span>
            </span>
          </h1>
          <p className="max-w-[520px] type-body-l text-ink-secondary">
            Gõ như nhắn tin cho bạn bè. Vingo tìm suất, chọn ghế liền nhau, giữ chỗ và đưa QR VNPay — bạn chỉ việc gật
            đầu. Thích tự chọn? Mọi thứ vẫn bấm được như app vé quen thuộc.
          </p>
          <AskBar
            sentences={EXAMPLE_PROMPTS}
            idleText="Tìm sự kiện, hoặc nói “2 vé HAGL cuối tuần, khán đài B”"
            onSubmit={go}
            onListeningChange={setListening}
          />
          <div className="flex w-full max-w-[720px] flex-wrap gap-2">
            {HERO_CHIPS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => go(c)}
                className="flex items-center gap-1.5 rounded-pill border border-line bg-glass px-3.5 py-2 text-left type-caption text-ink backdrop-blur transition-colors duration-150 hover:bg-surface"
              >
                <Sparkle className="size-3 shrink-0" />
                {c}
              </button>
            ))}
          </div>
        </div>

        <aside
          aria-label="Ví dụ Vingo đang giữ ghế"
          className="lp-slide-right w-full max-w-[340px] shrink-0 rounded-lg border border-white/10 bg-glass p-2 shadow-float backdrop-blur"
        >
          <div className="flex flex-col gap-2.5 rounded-md bg-surface p-4">
            <p className="self-end rounded-[20px] rounded-tr-[6px] bg-ink px-4 py-3 type-body-m text-on-ink">
              2 vé concert tối T7, dưới 2tr/vé
            </p>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 rounded-pill bg-agent px-2.5 py-[5px] type-mono-small text-ink">
                <span className="lp-badge-dot size-1.5 rounded-full bg-ink" />
                Đang giữ ghế
              </span>
              <span className="type-caption text-ink-secondary">A1-07, A1-08</span>
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 px-3 py-2">
            <div>
              <p className="type-body-m-strong text-ink">Vingo đang giữ ghế cho Minh Anh</p>
              <p className="type-mono-small text-ink-tertiary">{'// 2 phút trước · HAGL vs HN'}</p>
            </div>
            <ArrowUpRight className="size-5 shrink-0 text-ink" />
          </div>
        </aside>
      </div>

      <div className="relative flex flex-col gap-3 pt-10 text-ink lg:flex-row lg:items-end lg:justify-between">
        <p className="type-mono-label">Ghế giữ thật 10 phút · Thanh toán VNPay · Vé QR gửi qua email</p>
        <ul className="hidden items-center gap-12 type-mono-label lg:flex">
          {['V.League', 'Live concert', 'Nhà hát', 'Lễ hội', 'Stand-up', 'E-sports'].map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </div>

      {/* Vingo + 2 cuống vé trôi (chỉ từ lg: màn nhỏ không đủ chỗ) */}
      <div aria-hidden className="pointer-events-none absolute inset-0 hidden lg:block">
        <div className="lp-parallax absolute top-[329px] left-[832px]" style={{ ['--k' as string]: 0.8 }}>
          <div className="lp-float-a -rotate-12">
            <FlyingTicket tone="lime" code="HAGL · B-14" text="VÉ" />
          </div>
        </div>
        <div className="lp-parallax absolute top-[140px] right-[48px]" style={{ ['--k' as string]: 1 }}>
          <div className="lp-float-b rotate-[14deg]">
            <FlyingTicket tone="dark" code="KỊCH · F-08" text="VÉ" />
          </div>
        </div>
        <div className="lp-parallax absolute top-[441px] left-[682px]" style={{ ['--k' as string]: 0.5 }}>
          <MascotLive mood={listening ? 'listening' : 'wave'} className="size-[168px]" />
        </div>
      </div>
    </header>
  )
}
