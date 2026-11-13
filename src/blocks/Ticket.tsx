import { QrCode } from '@/design/QrCode'
import { StatusPill } from '@/design/StatusPill'

import { parseTicket } from './payloads'
import type { BlockProps } from './types'

/** Block `Ticket` (Figma 10:266): vé điện tử nền tối + QR soát vé. Nhiều vé xếp cạnh nhau do khung chat quyết định. */
export function Ticket({ block }: BlockProps) {
  const t = parseTicket(block)
  const fields: [string, string | undefined][] = [
    ['Ngày', t.dateLabel],
    ['Giờ', t.timeLabel],
    ['Khu', t.zone],
    ['Ghế', t.seat],
  ]
  const code = [t.orderCode, t.ticketCode].filter(Boolean)[0]
  return (
    <article aria-label={`Vé ${t.eventTitle}`} className="w-full min-w-[280px] flex-1 overflow-hidden rounded-lg">
      <div className="bg-ink p-5 text-on-ink">
        <div className="flex items-center justify-between gap-2">
          <span className="type-mono-small text-on-ink-secondary">Vé điện tử{code ? ` · #${code}` : ''}</span>
          <StatusPill label={t.status} tone={t.status === 'ISSUED' ? 'agent' : 'neutral'} className="text-ink" />
        </div>
        <h3 className="mt-3 text-[26px] leading-tight font-medium tracking-tight">{t.eventTitle}</h3>
        <dl className="mt-4 flex gap-5">
          {fields
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <div key={k}>
                <dt className="type-mono-small text-on-ink-secondary">{k}</dt>
                <dd className="type-body-m-strong text-base">{v}</dd>
              </div>
            ))}
        </dl>
      </div>
      <div className="flex items-center gap-4 bg-surface p-5">
        <QrCode image={t.qrImage} label="Mã QR soát vé" className="size-[90px] shrink-0 border border-line p-1" />
        <div className="type-caption">
          <p className="text-ink-secondary">Đưa mã này cho nhân viên soát vé tại cổng.</p>
          {t.emailMasked && <p className="mt-1 text-ink-tertiary">Đã gửi tới {t.emailMasked}</p>}
        </div>
      </div>
    </article>
  )
}
