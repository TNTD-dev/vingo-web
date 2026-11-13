import { ArrowUpRight, Check, ChevronDown, ChevronUp, Clock, Sparkles } from 'lucide-react'
import { Link } from 'react-router'

import { StatusPill, type PillTone } from '@/design/StatusPill'
import { formatCountdown, useCountdown } from '@/lib/countdown'
import { cn } from '@/lib/cn'
import { formatVnd } from '@/lib/money'

import type { OrderPanelView, PanelStatus, PanelStep } from './orderView'

const TONE: Record<PanelStatus, PillTone> = {
  NHÁP: 'neutral',
  'CHỜ XÁC NHẬN': 'agent',
  PENDING: 'warning',
  PAID: 'success',
}

/** Panel "Đơn đang làm" (Figma M1b–M3): thông tin đơn + các bước agent, thu gọn được. */
export function OrderPanel({ view, onCollapse }: { view: OrderPanelView; onCollapse: () => void }) {
  const { order, steps, status } = view
  const rows: [string, string | undefined][] = [
    ['Khu', [order.zone, undefined].filter(Boolean).join('') || undefined],
    ['Ghế', order.seats.join(', ') || undefined],
    ['Tạm tính', order.totalAmount === undefined ? undefined : formatVnd(order.totalAmount)],
  ]
  const shown = rows.filter(([, v]) => v)
  return (
    <aside
      aria-label="Đơn đang làm"
      className="absolute inset-x-3 top-[64px] z-20 max-h-[calc(100%-210px)] overflow-y-auto rounded-lg border border-line bg-surface shadow-float sm:inset-x-auto sm:right-4 sm:w-[340px]"
    >
      <div className="p-5 pb-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="type-mono-small text-ink-secondary">Đơn đang làm</h2>
          <div className="flex items-center gap-2">
            <StatusPill label={status} tone={TONE[status]} />
            <button
              type="button"
              onClick={onCollapse}
              aria-label="Thu gọn đơn đang làm"
              className="flex size-8 items-center justify-center rounded-full bg-canvas"
            >
              <ChevronUp className="size-4" />
            </button>
          </div>
        </div>

        {order.eventTitle ? (
          <div className="mt-4 flex items-center gap-3">
            {order.imageUrl ? (
              <img src={order.imageUrl} alt="" className="size-14 shrink-0 rounded-md object-cover" />
            ) : (
              <span aria-hidden className="size-14 shrink-0 rounded-md bg-canvas" />
            )}
            <div className="min-w-0">
              <p className="text-[15px] font-medium">{order.eventTitle}</p>
              {order.subtitle && <p className="type-caption text-ink-tertiary">{order.subtitle}</p>}
            </div>
          </div>
        ) : (
          <p className="mt-4 rounded-md bg-canvas px-4 py-3 type-body-m text-ink-tertiary">Chưa chọn sự kiện</p>
        )}

        {shown.length > 0 && (
          <dl className="mt-3 space-y-2.5 rounded-md bg-canvas p-4">
            {shown.map(([k, v]) => (
              <div key={k} className="flex items-baseline justify-between gap-3">
                <dt className="type-caption text-ink-secondary">{k}</dt>
                <dd className={cn('text-right', k === 'Tạm tính' ? 'type-h4' : 'type-body-m-strong')}>{v}</dd>
              </div>
            ))}
          </dl>
        )}

        <h3 className="mt-5 type-mono-small text-ink-secondary">Các bước</h3>
        <ol className="mt-2 space-y-1">
          {steps.map((s) => (
            <Step key={s.key} step={s} />
          ))}
        </ol>
      </div>
      {order.fullMapUrl?.startsWith('/') && (
        <Link to={order.fullMapUrl} className="block bg-canvas px-5 py-4">
          <span className="flex items-center gap-2 type-body-m-strong">
            <ArrowUpRight className="size-3.5" aria-hidden /> Mở trên sơ đồ đầy đủ
          </span>
          <span className="mt-1 block type-caption text-ink-tertiary">
            Chuyển sang Tự đặt, giữ nguyên ghế và đơn đang làm.
          </span>
        </Link>
      )}
    </aside>
  )
}

function Step({ step }: { step: PanelStep }) {
  return (
    <li
      aria-current={step.status === 'active' ? 'step' : undefined}
      className={cn('flex items-center gap-3 rounded-md px-3 py-2.5', step.status === 'active' && 'bg-agent-soft')}
    >
      <span
        aria-hidden
        className={cn(
          'flex size-6 shrink-0 items-center justify-center rounded-full',
          step.status === 'done' && 'bg-ink text-on-ink',
          step.status === 'active' && 'bg-ink text-agent',
          step.status === 'todo' && 'bg-canvas text-ink-tertiary',
        )}
      >
        {step.status === 'done' ? (
          <Check className="size-3.5" />
        ) : step.status === 'active' ? (
          <Sparkles className="size-3" />
        ) : (
          <Clock className="size-3" />
        )}
      </span>
      <span className="min-w-0">
        <span
          className={cn('block text-[15px]', step.status === 'todo' ? 'text-ink-tertiary' : 'font-normal text-ink')}
        >
          {step.title}
        </span>
        <span className="block type-mono-small text-ink-tertiary">
          {step.code}
          {step.detail ? ` · ${step.detail}` : ''}
        </span>
      </span>
    </li>
  )
}

/** Pill trên header khi panel thu gọn (Figma M4/M5): bấm để mở lại. */
export function OrderPill({ view, onExpand }: { view: OrderPanelView; onExpand: () => void }) {
  const { order, status } = view
  const left = useCountdown(status === 'PENDING' ? order.expiresAt : undefined)
  const summary = [
    order.seats.join(', ') || order.eventTitle,
    status === 'PAID'
      ? 'đã thanh toán'
      : [
          order.totalAmount === undefined ? undefined : formatVnd(order.totalAmount),
          left ? formatCountdown(left) : undefined,
        ]
          .filter(Boolean)
          .join(' · '),
  ]
    .filter(Boolean)
    .join(' · ')
  return (
    <button
      type="button"
      onClick={onExpand}
      aria-label="Mở đơn đang làm"
      className="inline-flex max-w-[60vw] items-center gap-2.5 rounded-pill border border-line bg-surface py-1.5 pr-1.5 pl-4"
    >
      <span className="hidden type-mono-small text-ink-tertiary md:inline">Đơn đang làm</span>
      <span className="truncate type-body-m-strong">{summary || 'Chưa chọn sự kiện'}</span>
      <StatusPill label={status} tone={TONE[status]} />
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-canvas">
        <ChevronDown className="size-4" />
      </span>
    </button>
  )
}
