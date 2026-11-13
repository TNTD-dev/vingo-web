import { formatVnd } from '@/lib/money'

import { parseOrderSummary } from './payloads'
import type { BlockProps } from './types'

/** Block `OrderSummary`: tóm tắt đơn trong chat (số tiền lấy từ API, không tự cộng). */
export function OrderSummary({ block }: BlockProps) {
  const o = parseOrderSummary(block)
  const rows: [string, string | undefined][] = [
    ['Khu', o.zone],
    ['Ghế', o.seats.join(', ') || undefined],
    ['Tạm tính', o.totalAmount === undefined ? undefined : formatVnd(o.totalAmount)],
  ]
  return (
    <section aria-label="Tóm tắt đơn" className="w-full max-w-[420px] rounded-lg border border-line bg-surface p-5">
      <p className="type-mono-label text-ink-secondary">Đơn{o.orderCode ? ` #${o.orderCode}` : ''}</p>
      {o.eventTitle && <h3 className="mt-2 type-h4">{o.eventTitle}</h3>}
      {o.subtitle && <p className="type-caption text-ink-tertiary">{o.subtitle}</p>}
      <dl className="mt-3 space-y-1.5 rounded-md bg-canvas p-4 text-sm">
        {rows
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4">
              <dt className="type-caption text-ink-secondary">{k}</dt>
              <dd className="type-body-m text-ink">{v}</dd>
            </div>
          ))}
      </dl>
    </section>
  )
}
