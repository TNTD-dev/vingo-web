import type { Ticket } from '@/api/generated/model'
import { StatusBadge, type BadgeTone } from '@/design/StatusBadge'
import { cn } from '@/lib/cn'
import { formatHm, formatWeekdayDayMonth } from '@/lib/time'

import { seatLabel } from './seat'
import { QrImage } from './QrImage'

const STATUS: Record<NonNullable<Ticket['status']>, { label: string; tone: BadgeTone }> = {
  ISSUED: { label: 'Hợp lệ', tone: 'dark' },
  USED: { label: 'Đã sử dụng', tone: 'neutral' },
  VOID: { label: 'Vô hiệu', tone: 'danger' },
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="type-mono-small text-on-ink-secondary uppercase">{label}</span>
      <span className="type-body-m-strong text-on-ink">{value}</span>
    </div>
  )
}

/** Block/Ticket (Figma): nửa trên nền đen thông tin vé, nửa dưới nền trắng có mã QR. */
export function TicketCard({
  ticket,
  gateNote = 'Đưa mã này cho nhân viên soát vé tại cổng.',
  sentTo,
  className,
  onClick,
}: {
  ticket: Ticket
  gateNote?: string
  sentTo?: string
  className?: string
  onClick?: () => void
}) {
  const status = STATUS[ticket.status ?? 'ISSUED']
  const start = ticket.showtime?.starts_at
  const body = (
    <>
      <div className="flex flex-col gap-3 p-5">
        <div className="flex items-center justify-between gap-2">
          <span className="type-mono-small text-on-ink-secondary uppercase">VÉ ĐIỆN TỬ · #{ticket.code}</span>
          <StatusBadge
            tone={status.tone}
            className={ticket.status === 'ISSUED' ? '!bg-agent !text-foreground' : undefined}
          >
            {status.label}
          </StatusBadge>
        </div>
        <p className="type-h3 text-on-ink">{ticket.event?.title ?? 'Vé sự kiện'}</p>
        <div className="flex gap-7">
          <Field label="Ngày" value={start ? formatWeekdayDayMonth(start) : '—'} />
          <Field label="Giờ" value={start ? formatHm(start) : '—'} />
          <Field label="Khu" value={ticket.zone ?? '—'} />
          <Field label="Ghế" value={seatLabel(ticket)} />
        </div>
      </div>
      <div className="mx-5 border-t border-dashed border-line-inverse" />
      <div className="flex items-center gap-4 bg-surface p-5">
        <div className="flex size-[90px] shrink-0 items-center justify-center overflow-hidden rounded-[7px] border border-line bg-surface">
          <QrImage ticket={ticket} compact className="size-full" />
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <p className="type-caption text-muted-foreground">{gateNote}</p>
          {sentTo ? <p className="type-caption text-ink-tertiary">Đã gửi tới {sentTo}</p> : null}
        </div>
      </div>
    </>
  )
  const cls = cn('flex w-full flex-col overflow-hidden rounded-[20px] bg-ink text-left', className)
  return onClick ? (
    <button type="button" onClick={onClick} className={cls}>
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  )
}
