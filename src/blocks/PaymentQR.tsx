import { ArrowRight, Clock } from 'lucide-react'

import { IconSweep } from '@/design/IconSweep'
import { StatusPill, type PillTone } from '@/design/StatusPill'
import { formatCountdown, useCountdown } from '@/lib/countdown'
import { formatVnd } from '@/lib/money'

import { parsePaymentQr } from './payloads'
import type { BlockProps } from './types'

const STATUS: Record<string, { label: string; tone: PillTone }> = {
  PENDING: { label: 'PENDING', tone: 'warning' },
  PAID: { label: 'PAID', tone: 'success' },
  EXPIRED: { label: 'EXPIRED', tone: 'neutral' },
  FAILED: { label: 'FAILED', tone: 'neutral' },
}

/**
 * Block `PaymentQR` (tên giữ theo contract): thanh toán bằng cách chuyển sang cổng VNPay, không hiện mã QR trong chat.
 * Số tiền lấy từ API, đếm ngược hạn giữ ghế. Kết quả thanh toán chỉ chốt qua IPN/querydr ở backend;
 * vé phát hành sẽ về lại hội thoại qua stream.
 */
export function PaymentQR({ block, onBlockEvent, readOnly, orderPaid }: BlockProps) {
  const p = { ...parsePaymentQr(block) }
  if (orderPaid) p.status = 'PAID'
  const left = useCountdown(p.status === 'PENDING' ? p.expiresAt : undefined)
  const expired = p.status === 'EXPIRED' || (p.status === 'PENDING' && left === 0)
  const status = STATUS[expired ? 'EXPIRED' : p.status]!
  const gateway = p.paymentUrl?.startsWith('https://') ? p.paymentUrl : undefined

  return (
    <section
      aria-label="Thanh toán VNPay"
      className="w-full max-w-[420px] rounded-lg border border-line bg-surface p-5"
    >
      <header className="flex items-center justify-between">
        <span className="type-mono-label">Thanh toán VNPay</span>
        <StatusPill label={status.label} tone={status.tone} />
      </header>
      <div className="mt-4">
        <p className="type-mono-small text-ink-tertiary">Tổng thanh toán{p.orderCode ? ` · đơn ${p.orderCode}` : ''}</p>
        {p.totalAmount !== undefined && <p className="type-h2 whitespace-nowrap">{formatVnd(p.totalAmount)}</p>}
        {p.status === 'PENDING' && left !== undefined && (
          <p className="mt-1 flex items-center gap-1.5 type-caption text-warning" aria-live="off">
            <Clock className="size-3.5" aria-hidden />
            {left > 0 ? `Còn ${formatCountdown(left)} để thanh toán` : 'Đã hết hạn thanh toán'}
          </p>
        )}
        <p className="mt-2 type-caption text-ink-secondary">
          {p.status === 'PAID'
            ? 'VNPay đã xác nhận thanh toán.'
            : 'Bạn sẽ được chuyển sang cổng VNPay: QR ngân hàng, thẻ ATM hoặc thẻ quốc tế. Thanh toán xong, vé tự phát hành ở đây.'}
        </p>
      </div>
      {p.status === 'PENDING' && !expired && (
        <div className="mt-4 flex flex-wrap gap-2.5">
          {gateway && (
            <a
              href={gateway}
              className="group inline-flex items-center gap-2 rounded-pill bg-ink px-5 py-3 type-body-m-strong text-on-ink"
            >
              Thanh toán qua VNPay
              <IconSweep className="size-4">
                <ArrowRight className="size-4" />
              </IconSweep>
            </a>
          )}
          <button
            type="button"
            disabled={readOnly || !onBlockEvent}
            onClick={() => onBlockEvent?.('payment.cancel', { order_id: p.orderId }, 'Huỷ đơn giúp mình')}
            className="rounded-pill border border-line px-5 py-3 type-body-m-strong disabled:opacity-60"
          >
            Huỷ đơn
          </button>
        </div>
      )}
    </section>
  )
}
