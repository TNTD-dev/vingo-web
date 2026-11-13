import { ChevronsRight } from 'lucide-react'
import { useRef, type FormEvent } from 'react'
import { Link } from 'react-router'

import { logoMark } from '@/design/brand'

import footerImage from './assets/footer.jpg'
import { usePrefersReducedMotion, useScrollProgress } from './hooks'

const COLUMNS: { title: string; links: { label: string; to: string }[] }[] = [
  {
    title: 'Khám phá',
    links: [
      { label: 'Bóng đá', to: '/events?category=FOOTBALL' },
      { label: 'Concert', to: '/events?category=CONCERT' },
      { label: 'Sân khấu', to: '/events?category=THEATER' },
      { label: 'Sự kiện khác', to: '/events' },
    ],
  },
  {
    title: 'Tài khoản',
    links: [
      { label: 'Vé của tôi', to: '/tickets' },
      { label: 'Đơn hàng', to: '/orders' },
      { label: 'Hồ sơ', to: '/me' },
      { label: 'Vingo', to: '/vingo' },
    ],
  },
  {
    title: 'Hỗ trợ',
    // Trang điều khoản, bảo mật, liên hệ chưa có route: để nhãn tĩnh, chưa gắn link giả.
    links: [{ label: 'Câu hỏi thường gặp', to: '/#faq' }],
  },
]
const STATIC_SUPPORT = ['Điều khoản', 'Chính sách bảo mật', 'Liên hệ']

/** Footer: ảnh sân đêm parallax 0.6×, chữ "vingo" trồi lên theo tiến độ cuộn (spec #10). */
export function LandingFooter() {
  const reduced = usePrefersReducedMotion()
  const ref = useScrollProgress<HTMLElement>({ startAt: 1, endAt: 0.2, enabled: !reduced, fallback: 1 })
  const mailRef = useRef<HTMLInputElement>(null)

  const subscribe = (e: FormEvent) => {
    e.preventDefault()
    // Chưa có API nhận tin trong contract: chưa gửi đi đâu.
    mailRef.current?.setCustomValidity('Tính năng nhận tin sắp có')
    mailRef.current?.reportValidity()
    mailRef.current?.setCustomValidity('')
  }

  return (
    <footer
      ref={ref}
      className="relative mt-4 flex flex-col gap-14 overflow-hidden rounded-xl px-5 pt-20 sm:px-8 lg:px-16"
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <img
          src={footerImage}
          alt=""
          loading="lazy"
          className="absolute inset-x-0 top-[-15%] h-[130%] w-full object-cover"
          style={{ transform: 'translateY(calc((0.5 - var(--p, 1)) * 20%))' }}
        />
        <div className="absolute inset-0 bg-linear-to-b from-ink/90 via-ink/55 via-55% to-ink/10" />
      </div>

      <div className="relative flex flex-col gap-12 lg:flex-row lg:justify-between">
        <div className="flex w-full max-w-[380px] flex-col items-start gap-5">
          <Link to="/" className="flex items-center gap-2" aria-label="Vingo, trang chủ">
            <img src={logoMark.dark} alt="" className="h-[30px] w-[23px]" />
            <span className="font-brand text-[26px] leading-[1.2] font-semibold tracking-[-0.02em] text-on-ink">
              vingo
            </span>
          </Link>
          <p className="max-w-[340px] type-body-m text-on-ink-secondary">
            Nền tảng đặt vé sự kiện qua chat. Giữ ghế thật, thanh toán VNPay, vé QR tức thì.
          </p>
          <form
            onSubmit={subscribe}
            className="flex w-full max-w-[360px] items-center gap-3 rounded-[14px] bg-glass py-1.5 pr-1.5 pl-4 backdrop-blur"
          >
            <input
              ref={mailRef}
              type="email"
              aria-label="Email nhận tin"
              placeholder="email@cua-ban.vn"
              className="min-w-0 flex-1 bg-transparent type-body-m text-on-ink outline-none placeholder:text-on-ink-secondary"
            />
            <button
              type="submit"
              className="flex shrink-0 items-center gap-1.5 rounded-[10px] bg-surface px-3.5 py-2.5 type-body-m-strong text-ink"
            >
              <ChevronsRight className="size-4" />
              Nhận tin
            </button>
          </form>
        </div>

        <nav aria-label="Chân trang" className="flex flex-wrap gap-x-16 gap-y-10 lg:gap-24">
          {COLUMNS.map((col) => (
            <div key={col.title} className="flex flex-col gap-3.5">
              <p className="type-mono-label text-on-ink">{col.title}</p>
              {col.links.map((l) => (
                <Link key={l.label} to={l.to} className="type-body-m text-on-ink-secondary hover:text-on-ink">
                  {l.label}
                </Link>
              ))}
              {col.title === 'Hỗ trợ' &&
                STATIC_SUPPORT.map((t) => (
                  <span key={t} className="type-body-m text-on-ink-secondary">
                    {t}
                  </span>
                ))}
            </div>
          ))}
        </nav>
      </div>

      <div
        aria-hidden
        className="relative -mb-[0.02em] flex h-[clamp(110px,22vw,300px)] items-start justify-center overflow-hidden"
      >
        <span
          className="text-[clamp(120px,29vw,420px)] leading-[0.8] font-medium tracking-[-0.07em] whitespace-nowrap text-on-ink"
          style={{ transform: 'translateY(calc((1 - var(--p, 1)) * 120px))' }}
        >
          vingo
        </span>
      </div>
    </footer>
  )
}
