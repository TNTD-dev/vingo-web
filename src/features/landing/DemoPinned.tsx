import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { Fragment, useEffect, useLayoutEffect, useRef } from 'react'

import { cn } from '@/lib/cn'

import { buildDemoTimeline, DEMO_DURATION } from './demoTimeline'
import { MascotLive } from '@/design/MascotLive'
import { QrMini } from './QrMini'

gsap.registerPlugin(ScrollTrigger)

// Sơ đồ ghế minh hoạ (Figma): S = đã bán, . = còn trống, L = ghế Vingo chọn.
const SEAT_ROWS = [
  'S....S....S...',
  '.S....S....S..',
  '..S....S....S.',
  '...S..LLS....S',
  '....S....S....',
  'S....S....S...',
]

const STEPS = ['Tìm', 'Chọn ghế', 'Đồng ý', 'Quét QR', 'Có vé']
const TICKS = ['Tìm trận phù hợp', 'Kiểm tra khu B còn ghế', 'Chọn 2 ghế cạnh nhau']

const STAGE_W = 1280
const STAGE_H = 560

function Seat({ kind }: { kind: string }) {
  if (kind === 'S') return <span className="aspect-square rounded-[6px] bg-seat-sold" />
  if (kind === 'L')
    return (
      <span
        data-demo="seat-pick"
        className="aspect-square rounded-[6px] bg-agent shadow-[0_0_16px_rgb(198_242_78/0.9)]"
      />
    )
  return (
    <span
      data-demo="seat-dim"
      className="aspect-square rounded-[6px] border border-line bg-seat-available opacity-[0.18]"
    />
  )
}

function Ticket() {
  return (
    <div className="w-[344px] max-w-full overflow-hidden rounded-[16px] bg-ink text-on-ink shadow-float">
      <div className="flex flex-col gap-2.5 p-4">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[8px] tracking-[0.04em] text-on-ink-secondary uppercase">
            Vé điện tử · #VG-8F2K
          </span>
          <span className="flex items-center gap-1 rounded-pill bg-agent px-2 py-1 font-mono text-[8px] tracking-[0.04em] text-ink uppercase">
            <span className="size-1 rounded-full bg-ink" />
            Issued
          </span>
        </div>
        <p className="text-[17px] leading-[1.2] tracking-[-0.01em]">HAGL vs Hà Nội FC</p>
        <dl className="flex gap-6">
          {[
            ['Ngày', 'T7 21/11'],
            ['Giờ', '17:00'],
            ['Khu', 'B'],
            ['Ghế', 'B-14'],
          ].map(([k, v]) => (
            <div key={k} className="flex flex-col gap-[3px]">
              <dt className="font-mono text-[8px] tracking-[0.04em] text-on-ink-secondary uppercase">{k}</dt>
              <dd className="text-[11.5px] leading-[1.4] font-medium">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="mx-4 border-t border-dashed border-line-inverse" />
      <div className="mt-4 flex items-center gap-3 bg-surface p-4 text-ink">
        <QrMini className="size-[74px] shrink-0 border border-line" />
        <div className="flex flex-col gap-1 text-[9.8px] leading-[1.4] font-light tracking-[0.01em]">
          <p className="text-ink-secondary">Đưa mã này cho nhân viên soát vé tại cổng 3.</p>
          <p className="text-ink-tertiary">Đã gửi tới m***@gmail.com</p>
        </div>
      </div>
    </div>
  )
}

const CONFETTI = [
  { cls: 'left-[860px] top-[37px] -rotate-[20deg] bg-mascot-cheek' },
  { cls: 'left-[1222px] top-[90px] rotate-[25deg] bg-[color-mix(in_srgb,var(--vg-status-info)_45%,white)]' },
  { cls: 'left-[900px] top-[414px] -rotate-[35deg] bg-agent' },
  { cls: 'left-[1200px] top-[38px] -rotate-[10deg] bg-white' },
  { cls: 'left-[1045px] top-[30px] rotate-[15deg] bg-agent' },
]

export function DemoPinned() {
  const rootRef = useRef<HTMLElement>(null)
  const areaRef = useRef<HTMLDivElement>(null)

  // Co sơ đồ 1280×560 cho vừa khung (chỉ có tác dụng từ lg; dưới lg bố cục xếp dọc).
  useEffect(() => {
    const area = areaRef.current
    if (!area || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(([entry]) => {
      if (!entry) return
      const { width, height } = entry.contentRect
      const s = Math.min(1, width / STAGE_W, height / STAGE_H)
      area.style.setProperty('--s', String(Math.max(s, 0.3)))
    })
    ro.observe(area)
    return () => ro.disconnect()
  }, [])

  // GSAP + ScrollTrigger chỉ dùng ở đây (phần ghim). Giảm chuyển động → không tạo gì, DOM ở trạng thái cuối.
  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return
    const mm = gsap.matchMedia()
    const ctx = gsap.context(() => {
      mm.add('(min-width: 1024px) and (prefers-reduced-motion: no-preference)', () => {
        const tl = buildDemoTimeline(root)
        ScrollTrigger.create({
          trigger: root,
          start: 'top top',
          end: '+=200%',
          pin: true,
          scrub: 0.6,
          anticipatePin: 1,
          animation: tl,
        })
      })
      // Điện thoại: không ghim, tự chạy một lần khi vào khung (không dùng ScrollTrigger).
      mm.add('(max-width: 1023px) and (prefers-reduced-motion: no-preference)', () => {
        const tl = buildDemoTimeline(root)
        tl.timeScale(DEMO_DURATION / 6)
        if (typeof IntersectionObserver === 'undefined') {
          tl.play()
          return
        }
        const io = new IntersectionObserver(
          ([entry]) => {
            if (entry?.isIntersecting) {
              tl.play()
              io.disconnect()
            }
          },
          { threshold: 0.3 },
        )
        io.observe(root)
        return () => io.disconnect()
      })
    }, root)
    return () => {
      mm.revert()
      ctx.revert()
    }
  }, [])

  const abs = 'lg:absolute'
  return (
    <section
      ref={rootRef}
      aria-labelledby="demo-title"
      className="relative flex flex-col overflow-hidden rounded-xl bg-ink text-on-ink lg:h-svh lg:min-h-[640px]"
    >
      <div className="relative px-5 pt-12 sm:px-8 lg:px-[calc(var(--lp-gutter)+4rem)] lg:pt-10">
        <p className="type-mono-label text-agent">{'// Một lượt đặt vé với Vingo'}</p>
        <h2
          id="demo-title"
          className="mt-3 text-[56px] leading-none font-medium tracking-[-0.05em] sm:text-[80px] lg:text-[clamp(48px,9.5svh,96px)]"
        >
          Bạn nói.
          <br />
          Vingo làm.
        </h2>
        <p className="mt-4 max-w-[440px] type-body-l text-on-ink-secondary lg:absolute lg:top-[clamp(80px,14svh,150px)] lg:right-[calc(var(--lp-gutter)+4rem)] lg:mt-0">
          Vingo tìm suất, chọn ghế và tạo QR thanh toán. Mọi bước giữ ghế hay trả tiền đều chờ bạn bấm “Đồng ý”.
        </p>
      </div>

      <div
        ref={areaRef}
        className="relative mt-8 px-4 sm:px-8 lg:mt-4 lg:min-h-0 lg:flex-1 lg:px-[calc(var(--lp-gutter)+4rem)]"
        style={{ ['--s' as string]: 1 }}
      >
        <div className="relative h-full lg:flex lg:justify-center">
          <div
            className={cn(
              'relative flex flex-col gap-4 rounded-[28px] bg-ink-raised p-5 sm:p-8',
              'lg:block lg:h-[560px] lg:w-[1280px] lg:shrink-0 lg:origin-top lg:[transform:scale(var(--s))] lg:p-0',
            )}
          >
            <p
              data-demo="user"
              className={cn(
                'w-full max-w-[360px] rounded-[20px] rounded-tr-[6px] bg-surface px-4 py-3 type-body-m text-ink',
                abs,
                'lg:top-10 lg:left-10',
              )}
            >
              2 vé HAGL cuối tuần, khán đài B, ngồi cạnh nhau
            </p>

            <div
              data-demo="assistant"
              className={cn(
                'w-full max-w-[420px] rounded-[20px] rounded-tl-[6px] bg-canvas px-4 py-3 text-ink',
                abs,
                'lg:top-[150px] lg:left-10',
              )}
            >
              <div className="flex items-center gap-2">
                <span aria-hidden className="relative size-8 shrink-0 overflow-hidden rounded-full bg-agent/35">
                  <MascotLive className="absolute top-[-14px] left-[-14px] w-[64px] max-w-none" />
                </span>
                <span className="type-mono-small text-ink-tertiary">Vingo</span>
              </div>
              <p className="mt-2 type-body-m">
                Có 1 trận 17:00 T7. Mình chọn D-14, D-15 ngay giữa sân — bạn đồng ý nhé?
              </p>
            </div>

            <ul className={cn('flex flex-col gap-2.5', abs, 'lg:top-[300px] lg:left-10')}>
              {TICKS.map((t) => (
                <li key={t} data-demo="tick" className="flex items-center gap-2">
                  <span data-demo="tick-dot" className="size-[18px] rounded-full bg-agent" />
                  <span className="type-mono-small text-on-ink-secondary">{t}</span>
                </li>
              ))}
            </ul>

            <div
              data-demo="seatcard"
              className={cn(
                'flex w-full max-w-[430px] flex-col items-center gap-[7px] self-center rounded-[22px] bg-ink p-4 sm:p-[22px]',
                abs,
                'lg:top-[60px] lg:left-[470px] lg:self-auto',
              )}
            >
              <div className="flex h-5 w-full items-center justify-center rounded-[8px] bg-[color-mix(in_srgb,var(--vg-accent-agent)_40%,var(--vg-bg-inverse))] type-mono-small text-on-ink">
                Sân
              </div>
              {SEAT_ROWS.map((row, r) => (
                <div key={r} className="grid w-full grid-cols-[repeat(14,minmax(0,1fr))] gap-1.5">
                  {[...row].map((kind, c) => (
                    <Seat key={c} kind={kind} />
                  ))}
                </div>
              ))}
            </div>
            <div className={cn('hidden justify-center', abs, 'lg:top-[312px] lg:left-[470px] lg:flex lg:w-[430px]')}>
              <span data-demo="seat-label" className="rounded-pill bg-agent px-3 py-1.5 type-mono-label text-ink">
                D-14 · D-15
              </span>
            </div>

            <div className={cn('relative', abs, 'lg:top-[440px] lg:left-10')}>
              <button
                type="button"
                data-demo="consent"
                tabIndex={-1}
                aria-hidden
                className="cursor-default rounded-[16px] bg-agent px-[22px] py-4 type-body-m-strong text-ink shadow-agent-glow"
              >
                Đồng ý giữ ghế
              </button>
              <span
                data-demo="ripple"
                aria-hidden
                className="pointer-events-none absolute top-6 left-[116px] size-11 rounded-full border-2 border-on-ink opacity-0"
              />
            </div>

            <div className={cn('flex justify-center', abs, 'lg:top-[90px] lg:left-[868px] lg:block')}>
              <div data-demo="ticket" className="origin-center">
                <div className="rotate-[8deg]">
                  <Ticket />
                </div>
              </div>
            </div>

            <div data-demo="mascot" className={cn('mx-auto', abs, 'lg:top-[330px] lg:left-[1110px]')}>
              <MascotLive mood="celebrate" className="size-[168px]" />
            </div>

            {CONFETTI.map((c, i) => (
              <span
                key={i}
                data-demo="confetti"
                aria-hidden
                className={cn('absolute hidden h-[18px] w-2.5 rounded-[3px] lg:block', c.cls)}
              />
            ))}
          </div>
        </div>
      </div>

      <ol
        aria-label="5 bước đặt vé"
        className="relative mx-auto mt-6 mb-8 flex w-full max-w-[1030px] items-start justify-center px-4 sm:px-8 lg:mt-2 lg:mb-6"
      >
        {STEPS.map((s, i) => (
          <Fragment key={s}>
            <li className="flex w-14 shrink-0 flex-col items-center gap-2 sm:w-[150px]">
              <span data-demo="step-dot" className="size-3.5 rounded-full bg-agent" />
              <span data-demo="step-label" className="type-mono-small whitespace-nowrap text-on-ink max-sm:text-[9px]">
                {s}
              </span>
            </li>
            {i < STEPS.length - 1 && (
              <li
                aria-hidden
                className="mt-1.5 h-0.5 min-w-2 flex-1 bg-agent sm:w-[70px] sm:flex-none"
                data-demo="step-line"
              />
            )}
          </Fragment>
        ))}
      </ol>
    </section>
  )
}
