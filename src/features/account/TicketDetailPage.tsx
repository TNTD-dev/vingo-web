import { CalendarPlus, ChevronLeft, ChevronRight, Clock, MapPin, QrCode, Sun } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router'

import { useGetTicket, useListMyTickets } from '@/api/generated/endpoints/tickets/tickets'
import { isApiError } from '@/api/problem'
import { ArrowButton } from '@/design/ArrowButton'
import { Mascot } from '@/design/Mascot'
import { StatusBadge } from '@/design/StatusBadge'
import { seatLabel } from '@/design/ticket/seat'
import { QrImage } from '@/design/ticket/QrImage'
import { useResendTicket } from '@/design/ticket/useResendTicket'
import { Skeleton } from '@/design/ui/skeleton'
import { buildIcs, downloadIcs } from '@/lib/ics'
import { formatHm, formatWeekdayDayMonth } from '@/lib/time'

const TICKET_STATUS = { ISSUED: 'Hợp lệ', USED: 'Đã sử dụng', VOID: 'Vô hiệu' } as const

/** Vé của người khác trả 404, id sai định dạng trả 400: với người dùng đều là "không tìm thấy". */
const notFound = (e: unknown) =>
  isApiError(e) && (e.code === 'NOT_FOUND' || e.code === 'FORBIDDEN' || e.status === 404 || e.status === 400)

// B11 · Vé & mã QR toàn màn (Figma 03 · Buyer). Nền tối do BuyerLayout đổi theo route.
export default function TicketDetailPage() {
  const { ticketId = '' } = useParams()
  const navigate = useNavigate()
  const ticket = useGetTicket(ticketId)
  const t = ticket.data
  const code = t?.order_code
  const siblings = useListMyTickets(undefined, {
    query: { enabled: !!code, select: (r) => (r.data ?? []).filter((x) => x.order_code === code) },
  })
  const resend = useResendTicket()

  if (ticket.isPending)
    return <Skeleton className="mx-auto mt-6 h-[547px] w-full max-w-[440px] rounded-[28px] bg-ink-raised" />
  if (ticket.isError || !t) {
    return (
      <div className="mx-auto mt-10 flex max-w-[440px] flex-col items-center gap-3 rounded-[28px] bg-surface px-6 py-12 text-center">
        <Mascot state="sorry" className="h-24 w-auto" />
        <h1 className="type-h3">{notFound(ticket.error) ? 'Không tìm thấy vé' : 'Không tải được vé'}</h1>
        <Link to="/tickets" className="rounded-pill bg-ink px-5 py-2.5 type-body-m-strong text-on-ink">
          Vé của tôi
        </Link>
      </div>
    )
  }

  const list = siblings.data ?? [t]
  const index = Math.max(
    0,
    list.findIndex((x) => x.id === t.id),
  )
  const go = (to: number) => {
    const target = list[to]
    if (target?.id) navigate(`/tickets/${target.id}`, { replace: true })
  }
  const start = t.showtime?.starts_at
  const issued = t.status === 'ISSUED'

  const addToCalendar = () => {
    if (!start) return
    downloadIcs(
      `${t.code}.ics`,
      buildIcs({
        uid: t.id ?? t.code ?? 'ticket',
        title: t.event?.title ?? 'Sự kiện Vingo',
        startIso: start,
        endIso: t.showtime?.ends_at,
        location: t.venue?.name,
      }),
    )
  }

  return (
    <div className="flex flex-col items-center gap-8 pt-2 lg:flex-row lg:items-center lg:justify-center lg:gap-[56px]">
      <div className="flex w-full max-w-[440px] flex-col items-center gap-5">
        <article className="flex w-full flex-col gap-5 rounded-[28px] bg-surface p-6 text-foreground">
          <div className="flex items-center justify-between gap-2">
            <span className="type-mono-small text-ink-secondary uppercase">
              Vé {index + 1} / {list.length} · #{t.code}
            </span>
            <StatusBadge
              tone={issued ? 'dark' : t.status === 'VOID' ? 'danger' : 'neutral'}
              className={issued ? '!bg-agent !text-foreground' : undefined}
            >
              {t.status ? TICKET_STATUS[t.status] : ''}
            </StatusBadge>
          </div>
          <h1 className="text-center type-h2">{t.event?.title}</h1>
          <dl className="flex justify-center gap-7 text-center">
            {[
              ['Ngày', start ? formatWeekdayDayMonth(start) : '—'],
              ['Giờ', start ? formatHm(start) : '—'],
              ['Khu', t.zone ?? '—'],
              ['Ghế', seatLabel(t)],
            ].map(([k, v]) => (
              <div key={k} className="flex flex-col gap-1">
                <dt className="type-mono-small text-ink-tertiary uppercase">{k}</dt>
                <dd className="type-h4">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="mx-auto flex aspect-square w-full max-w-[280px] items-center justify-center">
            <QrImage ticket={t} className="size-full" />
          </div>
          <p className="flex items-center justify-center gap-2 type-caption text-ink-tertiary">
            <Sun className="size-3.5" aria-hidden /> Tăng độ sáng màn hình khi đưa nhân viên quét
          </p>
        </article>

        {list.length > 1 && (
          <nav aria-label="Chuyển vé" className="flex items-center gap-4 text-on-ink">
            <button
              type="button"
              aria-label="Vé trước"
              disabled={index === 0}
              onClick={() => go(index - 1)}
              className="flex size-10 items-center justify-center rounded-pill bg-ink-raised disabled:opacity-40"
            >
              <ChevronLeft className="size-4" aria-hidden />
            </button>
            <span className="type-body-m">
              Vé {index + 1} / {list.length}
            </span>
            <button
              type="button"
              aria-label="Vé sau"
              disabled={index === list.length - 1}
              onClick={() => go(index + 1)}
              className="flex size-10 items-center justify-center rounded-pill bg-ink-raised disabled:opacity-40"
            >
              <ChevronRight className="size-4" aria-hidden />
            </button>
          </nav>
        )}
      </div>

      <div className="flex w-full max-w-[440px] flex-col gap-4 lg:max-w-[380px]">
        <Info
          icon={<MapPin className="size-5" aria-hidden />}
          title={`Khu ${t.zone ?? ''}${t.venue?.name ? ` · ${t.venue.name}` : ''}`}
          hint={t.venue?.address}
        />
        <Info
          icon={<Clock className="size-5" aria-hidden />}
          title={start ? `Bắt đầu lúc ${formatHm(start)}` : 'Giờ bắt đầu'}
          hint="Nên đến sớm 30 phút để ổn định chỗ ngồi"
        />
        <Info
          icon={<QrCode className="size-5" aria-hidden />}
          title="Mỗi mã chỉ được quét một lần"
          hint="Mã đã dùng sẽ hiện USED và không vào lại được"
        />
        <div className="flex flex-wrap gap-3">
          <ArrowButton onClick={() => resend.mutate([ticketId])} disabled={resend.isPending || !issued}>
            Gửi lại vé qua email
          </ArrowButton>
          <button
            type="button"
            onClick={addToCalendar}
            className="flex items-center gap-2 rounded-[14px] bg-ink-raised px-5 py-3 type-body-m-strong text-on-ink"
          >
            <CalendarPlus className="size-4" aria-hidden /> Thêm vào lịch
          </button>
        </div>
      </div>
    </div>
  )
}

function Info({ icon, title, hint }: { icon: React.ReactNode; title: string; hint?: string }) {
  return (
    <div className="flex items-center gap-4 rounded-[20px] bg-ink-raised p-4 text-on-ink">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-agent text-foreground">
        {icon}
      </span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="type-body-m-strong">{title}</p>
        {hint && <p className="type-caption text-on-ink-secondary">{hint}</p>}
      </div>
    </div>
  )
}
