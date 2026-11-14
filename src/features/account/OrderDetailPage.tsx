import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'

import { cancelOrder, getGetOrderQueryKey, useGetOrder } from '@/api/generated/endpoints/booking/booking'
import type { Order } from '@/api/generated/model'
import { isApiError } from '@/api/problem'
import { ArrowButton } from '@/design/ArrowButton'
import { Mascot } from '@/design/Mascot'
import { icons } from '@/design/icons'
import { StatusBadge } from '@/design/StatusBadge'
import { Skeleton } from '@/design/ui/skeleton'
import { cn } from '@/lib/cn'
import { formatCountdown, remainingSeconds } from '@/lib/countdown'
import { formatVnd } from '@/lib/money'
import { formatDayMonthHm, formatEventDateTime, formatHm, formatTimeRange } from '@/lib/time'
import { useNow } from '@/lib/useNow'
import { useMeStream } from '@/realtime/useMeStream'

import { ORDER_STATUS, ticketCount } from './orderView'
import { timeline } from './orderTimeline'

const CATEGORY: Record<string, string> = {
  FOOTBALL: 'BÓNG ĐÁ',
  CONCERT: 'CONCERT',
  THEATER: 'SÂN KHẤU',
  OTHER: 'SỰ KIỆN',
}

// B10 · Chi tiết đơn hàng (Figma 03 · Buyer). Hiển thị mọi trạng thái đơn; chỉ đơn PENDING mới thanh toán tiếp hoặc huỷ.
export default function OrderDetailPage() {
  const { orderId = '' } = useParams()
  useMeStream()
  const query = useGetOrder(orderId, {
    query: { refetchInterval: (q) => (q.state.data?.status === 'PENDING' ? 5000 : false) },
  })

  if (query.isPending) return <Skeleton className="mt-8 h-[640px] rounded-[20px]" />
  if (query.isError || !query.data) {
    return (
      <div className="mt-8 flex flex-col items-center gap-3 rounded-[20px] bg-surface px-6 py-16 text-center">
        <Mascot state="sorry" className="h-24 w-auto" />
        <h1 className="type-h3">
          {isApiError(query.error) && [400, 403, 404].includes(query.error.status)
            ? 'Không tìm thấy đơn hàng'
            : 'Không tải được đơn hàng'}
        </h1>
        <Link to="/orders" className="rounded-pill bg-ink px-5 py-2.5 type-body-m-strong text-on-ink">
          Đơn hàng của tôi
        </Link>
      </div>
    )
  }
  return <Detail order={query.data} />
}

function Detail({ order }: { order: Order }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const now = useNow()
  const status = ORDER_STATUS[order.status ?? 'PENDING']
  const pending = order.status === 'PENDING' && (!order.expires_at || remainingSeconds(order.expires_at, now) > 0)
  const count = ticketCount(order)
  const items = order.items ?? []
  const start = order.showtime?.starts_at

  const cancel = useMutation({
    mutationFn: () => cancelOrder(order.id!),
    onSuccess: () => {
      toast.success('Đã huỷ đơn và nhả ghế')
      void queryClient.invalidateQueries({ queryKey: getGetOrderQueryKey(order.id!) })
    },
    onError: (e) => {
      if (isApiError(e, 'ORDER_STATE_INVALID'))
        void queryClient.invalidateQueries({ queryKey: getGetOrderQueryKey(order.id!) })
      else toast.error('Chưa huỷ được đơn. Vui lòng thử lại.')
    },
  })

  const seatText = items
    .map((i) => (i.row && i.number != null ? `${i.row}-${i.number}` : null))
    .filter((v): v is string => !!v)
    .join(', ')

  return (
    <div className="flex flex-col gap-7">
      <header className="flex items-center gap-4">
        <button
          type="button"
          aria-label="Quay lại"
          onClick={() => navigate(-1)}
          className="flex size-[46px] shrink-0 items-center justify-center rounded-pill bg-surface outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronLeft className="size-5" aria-hidden />
        </button>
        <div className="flex min-w-0 flex-col gap-1">
          <p className="type-mono-label text-ink-secondary uppercase">
            {'// Đơn #'}
            {order.code}
            {order.created_at
              ? ` · Tạo lúc ${formatHm(order.created_at)} ${formatDayMonthHm(order.created_at).split(' ')[0]}`
              : ''}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="type-h1 text-foreground">Chi tiết đơn hàng</h1>
            <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
          </div>
        </div>
      </header>

      <Banner order={order} pending={pending} seatText={seatText} now={now} />

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-6">
          <section className="flex flex-col gap-5 rounded-[20px] bg-surface p-5 sm:p-7">
            <div className="flex items-center gap-4">
              {order.event?.poster_url ? (
                <img
                  src={order.event.poster_url}
                  alt=""
                  className="h-[52px] w-[70px] shrink-0 rounded-[10px] object-cover"
                />
              ) : (
                <div className="h-[52px] w-[70px] shrink-0 rounded-[10px] bg-muted" />
              )}
              <div className="flex min-w-0 flex-col gap-1">
                <p className="type-mono-small text-ink-tertiary uppercase">
                  {CATEGORY[order.event?.category ?? 'OTHER']}
                  {order.event?.city_name ? ` · ${order.event.city_name}` : ''}
                </p>
                <h2 className="type-h3 text-foreground">{order.event?.title}</h2>
                <p className="type-caption text-ink-secondary">
                  {start ? formatEventDateTime(start) : ''}
                  {order.showtime?.venue?.name ? ` · ${order.showtime.venue.name}` : ''}
                </p>
              </div>
            </div>
            <div className="h-px bg-line" />
            <div className="flex flex-col gap-3">
              <p className="type-mono-small text-ink-tertiary uppercase">Vé trong đơn</p>
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 rounded-[10px] bg-canvas px-4 py-3"
                >
                  <span className="type-body-m-strong text-foreground">
                    Khu {item.zone}
                    {item.row && item.number != null
                      ? ` · Ghế ${item.row}-${String(item.number).padStart(2, '0')}`
                      : ` · ${item.quantity ?? 1} vé đứng`}
                  </span>
                  <span className="shrink-0 type-body-m-strong text-foreground">
                    {formatVnd((item.unit_price ?? 0) * (item.quantity ?? 1))}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="flex flex-col gap-4 rounded-[20px] bg-surface p-5 sm:p-7">
            <p className="type-mono-small text-ink-tertiary uppercase">Dòng thời gian</p>
            <ol className="flex flex-col gap-3.5">
              {timeline(order).map((step) => (
                <li key={step.key} className="flex items-center gap-3">
                  <span
                    aria-hidden
                    className={cn(
                      'size-2.5 shrink-0 rounded-pill',
                      step.tone === 'done' && 'bg-ink',
                      step.tone === 'warn' && 'bg-warning',
                      step.tone === 'todo' && 'bg-muted',
                    )}
                  />
                  <span className="w-10 shrink-0 type-mono-small text-ink-tertiary">{step.time ?? '–'}</span>
                  <span className={cn('type-body-m', step.tone === 'todo' ? 'text-ink-tertiary' : 'text-foreground')}>
                    {step.label}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside className="flex w-full shrink-0 flex-col gap-4 rounded-[20px] bg-surface p-6 lg:w-[420px]">
          <p className="type-mono-small text-ink-tertiary uppercase">Tổng kết</p>
          <div className="flex items-center justify-between">
            <span className="type-body-m text-ink-secondary">Tạm tính</span>
            <span className="type-body-m-strong text-foreground">
              {order.total_amount != null ? formatVnd(order.total_amount) : '—'}
            </span>
          </div>
          <div className="h-px bg-line" />
          <div className="flex items-center justify-between">
            <span className="type-body-m text-ink-secondary">Tổng cộng</span>
            <span className="type-h3 text-foreground">
              {order.total_amount != null ? formatVnd(order.total_amount) : '—'}
            </span>
          </div>

          {pending ? (
            <>
              <ArrowButton variant="primary" to={`/orders/${order.id}/checkout`}>
                Thanh toán tiếp {order.total_amount != null ? formatVnd(order.total_amount) : ''}
              </ArrowButton>
              <ArrowButton onClick={() => cancel.mutate()} disabled={cancel.isPending}>
                {cancel.isPending ? 'Đang huỷ…' : 'Huỷ đơn'}
              </ArrowButton>
              <p className="type-caption text-ink-tertiary">
                Huỷ đơn sẽ trả {count} ghế lại ngay. Vingo không hỗ trợ hoàn tiền hay đổi ghế sau khi đã thanh toán.
              </p>
            </>
          ) : order.status === 'PAID' ? (
            <>
              <ArrowButton variant="primary" to="/tickets">
                Xem vé của tôi
              </ArrowButton>
              <p className="type-caption text-ink-tertiary">
                Vingo không hỗ trợ hoàn tiền hay đổi ghế sau khi đã thanh toán.
              </p>
            </>
          ) : null}
        </aside>
      </div>
    </div>
  )
}

function Banner({ order, pending, seatText, now }: { order: Order; pending: boolean; seatText: string; now: number }) {
  if (pending) {
    const left = order.expires_at ? remainingSeconds(order.expires_at, now) : 0
    return (
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 rounded-[16px] bg-ink px-5 py-3.5 text-on-ink">
        <div className="flex items-center gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-pill bg-agent">
            <img src={icons.lock} alt="" className="size-4" />
          </span>
          <p className="type-body-m-strong">
            {seatText ? `Ghế ${seatText} đang được giữ cho bạn` : 'Vé đang được giữ cho bạn'} · chưa thanh toán
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          {order.expires_at && (
            <span className="type-caption text-on-ink-secondary">Hết hạn lúc {formatTimeRange(order.expires_at)}</span>
          )}
          <span
            role="timer"
            aria-label="Thời gian giữ ghế còn lại"
            className="rounded-sm bg-ink-raised px-3 py-1.5 text-[21px] leading-[1.2] tracking-[-0.01em] text-agent tabular-nums"
          >
            {formatCountdown(left)}
          </span>
        </div>
      </div>
    )
  }
  const message: Partial<Record<NonNullable<Order['status']>, string>> = {
    NEEDS_REVIEW: 'Tiền đã về nhưng đơn cần kiểm tra. Đội vận hành sẽ xử lý trong 24h, bạn không cần thao tác thêm.',
    EXPIRED: 'Đơn đã hết hạn giữ ghế. Ghế đã được trả lại.',
    CANCELLED: 'Đơn đã được huỷ. Ghế đã được trả lại.',
  }
  const text = order.status ? message[order.status] : undefined
  if (!text) return null
  return <p className="rounded-[16px] bg-surface px-5 py-3.5 type-body-m text-ink-secondary">{text}</p>
}
