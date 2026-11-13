import { Lock } from 'lucide-react'
import { useEffect, useState } from 'react'

import { cn } from '@/lib/cn'

import { useInView, usePrefersReducedMotion } from './hooks'
import { MascotLive } from './MascotLive'
import { QR_CELLS } from './qrPattern'

/** Độ trễ giả-ngẫu-nhiên nhưng cố định (không đổi giữa các lần render), trong 600ms. */
const qrDelay = (i: number) => ((i * 37) % 100) * 6

function QrArt({ show, className }: { show: boolean; className?: string }) {
  const reduced = usePrefersReducedMotion()
  return (
    <div aria-hidden className={cn('relative rounded-[14px] bg-white', className)}>
      {QR_CELLS.map((c, i) => (
        <span
          key={i}
          className="absolute size-2 rounded-[2px] bg-ink transition-opacity duration-150"
          style={{
            left: 12 + c.x * 9,
            top: 12 + c.y * 9,
            opacity: show || reduced ? 1 : 0,
            transitionDelay: reduced ? '0ms' : `${qrDelay(i)}ms`,
          }}
        />
      ))}
    </div>
  )
}

function Cell({ i, className, children }: { i: number; className?: string; children: React.ReactNode }) {
  const [ref, inView] = useInView<HTMLDivElement>()
  return (
    <div
      ref={ref}
      data-in={inView}
      className={cn('lp-reveal rounded-lg p-7', className)}
      style={{ ['--d' as string]: `${i * 90}ms` }}
    >
      {children}
    </div>
  )
}

/** Ô ví dụ chat: tin người dùng hiện trước, Vingo "đang gõ…" 800ms rồi mới hiện câu trả lời. */
function ExampleChat() {
  const reduced = usePrefersReducedMotion()
  const [ref, inView] = useInView<HTMLDivElement>()
  const [done, setDone] = useState(false)
  const stage = reduced || done ? 'done' : inView ? 'typing' : 'idle'

  useEffect(() => {
    if (reduced || !inView) return
    const t = setTimeout(() => setDone(true), 800 + 500)
    return () => clearTimeout(t)
  }, [inView, reduced])

  return (
    <div ref={ref} className="flex flex-col gap-3">
      <div className="flex justify-end">
        <p
          className={cn(
            'w-[260px] max-w-full rounded-[20px] rounded-tr-[6px] bg-ink px-4 py-3 type-body-m text-on-ink transition-opacity duration-500',
            stage === 'idle' && !reduced && 'opacity-0',
          )}
        >
          2 vé khán đài B trận HAGL cuối tuần
        </p>
      </div>
      <div className="w-[270px] max-w-full rounded-[20px] rounded-tl-[6px] bg-canvas px-4 py-3">
        <div className="flex items-center gap-2">
          <span aria-hidden className="relative size-8 shrink-0 overflow-hidden rounded-full bg-agent/35">
            <MascotLive className="absolute top-[-14px] left-[-14px] w-[64px] max-w-none" />
          </span>
          <span className="type-mono-small text-ink-tertiary">Vingo</span>
        </div>
        {stage === 'done' ? (
          <p className="mt-2 type-body-m text-ink">Mình chọn D-14, D-15 giữa sân. Bạn đồng ý nhé?</p>
        ) : (
          <p aria-label="Vingo đang gõ" className="mt-2 flex h-[21px] items-center gap-1">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className={cn('lp-typing-dot size-1.5 rounded-full bg-ink-tertiary', stage === 'idle' && 'opacity-0')}
                style={{ ['--i' as string]: i }}
              />
            ))}
          </p>
        )}
      </div>
    </div>
  )
}

export function Bento() {
  const [qrRef, qrIn] = useInView<HTMLDivElement>()
  return (
    <section aria-label="Vì sao đặt vé với Vingo" className="px-5 pb-16 sm:px-8 lg:px-16 lg:pb-24">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Cell i={0} className="flex min-h-[320px] flex-col justify-between overflow-hidden bg-ink lg:min-h-[412px]">
          <span className="flex size-12 items-center justify-center rounded-[12px] bg-agent text-ink">
            <Lock className="size-[22px]" />
          </span>
          <div className="flex flex-col gap-2.5">
            <p className="type-h1 text-on-ink">10 phút</p>
            <p className="max-w-[250px] type-body-m text-on-ink-secondary">
              Ghế được khoá cho riêng bạn. Hết hạn mà chưa thanh toán thì tự trả lại.
            </p>
          </div>
        </Cell>

        <div className="flex flex-col gap-4">
          <Cell i={1} className="flex flex-1 flex-col items-center justify-center gap-3 bg-surface text-center">
            <MascotLive className="size-[108px]" />
            <p className="max-w-[220px] type-body-m text-ink-secondary">
              Vingo luôn hỏi trước khi giữ ghế hay trả tiền.
            </p>
          </Cell>
          <Cell i={1} className="flex flex-col justify-center gap-1.5 bg-muted">
            <p className="type-h2 tracking-[-0.015em]">VNPay</p>
            <p className="type-caption text-ink-secondary">QR ngân hàng, thẻ ATM, thẻ quốc tế</p>
          </Cell>
        </div>

        <Cell i={2} className="flex min-h-[320px] flex-col justify-between gap-6 bg-muted lg:min-h-[412px]">
          <div ref={qrRef}>
            <QrArt show={qrIn} className="size-[120px]" />
          </div>
          <div className="flex flex-col gap-2">
            <p className="type-h3 text-ink">Vé QR qua email</p>
            <p className="max-w-[260px] type-caption text-ink-secondary">
              Chỉ phát hành sau khi VNPay xác nhận thanh toán.
            </p>
          </div>
        </Cell>

        <Cell i={3} className="bg-surface">
          <p className="mb-3 type-mono-label text-ink-tertiary">Ví dụ một đoạn chat</p>
          <ExampleChat />
        </Cell>
      </div>
    </section>
  )
}
