import { useInfiniteQuery } from '@tanstack/react-query'
import { ChevronRight, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router'

import { getListMyOrdersQueryKey, listMyOrders } from '@/api/generated/endpoints/booking/booking'
import type { Order } from '@/api/generated/model'
import { Mascot } from '@/design/Mascot'
import { StatusBadge } from '@/design/StatusBadge'
import { Skeleton } from '@/design/ui/skeleton'
import { formatVnd } from '@/lib/money'
import { formatDayMonthHm } from '@/lib/time'

import { ORDER_STATUS, ticketCount } from './orderView'

const COLS = 'md:grid md:grid-cols-[110px_minmax(0,1fr)_130px_130px_170px_120px] md:items-center md:gap-4'

// B7 · Đơn hàng của tôi (Figma 03 · Buyer).
export default function OrdersPage() {
  const apiParams = { limit: 50 }
  const query = useInfiniteQuery({
    queryKey: [...getListMyOrdersQueryKey(apiParams), 'infinite'],
    queryFn: ({ pageParam, signal }) => listMyOrders({ ...apiParams, cursor: pageParam }, { signal }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
  })
  const orders = query.data?.pages.flatMap((p) => p.data ?? []) ?? []

  return (
    <section className="flex flex-col gap-8 pt-1">
      <header className="flex flex-col gap-3 pt-6">
        <p className="type-mono-label text-ink-secondary uppercase">{'// Lịch sử đơn hàng'}</p>
        <h1 className="type-display-l text-foreground">Đơn hàng</h1>
      </header>

      <div className="rounded-[20px] bg-surface p-4 sm:p-8">
        {query.isPending ? (
          <div className="flex flex-col gap-3">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : query.isError ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <Mascot state="sorry" className="size-20" />
            <p className="type-h3">Không tải được đơn hàng</p>
            <button
              type="button"
              onClick={() => void query.refetch()}
              className="rounded-pill bg-ink px-5 py-2.5 type-body-m-strong text-on-ink"
            >
              Thử lại
            </button>
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <Mascot state="asking" className="size-20" />
            <p className="type-h3">Bạn chưa có đơn hàng nào</p>
            <Link to="/events" className="rounded-pill bg-ink px-5 py-2.5 type-body-m-strong text-on-ink">
              Khám phá sự kiện
            </Link>
          </div>
        ) : (
          <table className="w-full border-collapse text-left max-md:block">
            <thead className="max-md:hidden">
              <tr className={COLS + ' border-b border-line pb-4'}>
                {['Mã đơn', 'Sự kiện', 'Ngày đặt', 'Tổng tiền', 'Trạng thái'].map((h) => (
                  <th key={h} scope="col" className="type-mono-small font-normal text-ink-tertiary uppercase">
                    {h}
                  </th>
                ))}
                <th scope="col" className="sr-only">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody className="max-md:block">
              {orders.map((o) => (
                <OrderRow key={o.id} order={o} />
              ))}
            </tbody>
          </table>
        )}
        {query.hasNextPage && (
          <button
            type="button"
            disabled={query.isFetchingNextPage}
            onClick={() => void query.fetchNextPage()}
            className="mx-auto mt-4 block rounded-pill border border-line px-5 py-2.5 type-body-m-strong disabled:opacity-50"
          >
            Tải thêm
          </button>
        )}
      </div>

      <p className="flex items-center gap-3 rounded-[20px] bg-surface px-6 py-4 type-caption text-ink-secondary">
        <ShieldCheck className="size-4 shrink-0 text-foreground" aria-hidden />
        <span>
          Đơn “Đang xem xét”: tiền đã về nhưng đơn hết hạn hoặc lệch số tiền — đội vận hành sẽ xử lý trong 24h, bạn
          không cần thao tác thêm.
        </span>
      </p>
    </section>
  )
}

function OrderRow({ order }: { order: Order }) {
  const status = ORDER_STATUS[order.status ?? 'PENDING']
  const pending = order.status === 'PENDING'
  const count = ticketCount(order)
  return (
    <tr className={COLS + ' border-b border-line py-4 last:border-b-0 max-md:block md:min-h-[46px] md:py-[11px]'}>
      <td className="type-mono-small font-normal text-foreground">#{order.code}</td>
      <td className="type-body-m text-foreground max-md:mt-1">
        {order.event?.title}
        {count > 0 && ` · ${count} vé`}
      </td>
      <td className="type-body-m text-ink-secondary max-md:hidden">
        {order.created_at ? formatDayMonthHm(order.created_at) : '—'}
      </td>
      <td className="type-body-m text-foreground max-md:mt-1">
        {order.total_amount != null ? formatVnd(order.total_amount) : '—'}
      </td>
      <td className="max-md:mt-2">
        <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
      </td>
      <td className="flex justify-end max-md:mt-3">
        {pending ? (
          <Link
            to={`/orders/${order.id}/checkout`}
            className="rounded-pill bg-ink px-5 py-2.5 type-body-m-strong text-on-ink"
          >
            Thanh toán
          </Link>
        ) : (
          <Link to={`/orders/${order.id}`} className="flex items-center gap-1 type-body-m-strong text-foreground">
            Chi tiết <ChevronRight className="size-4" aria-hidden />
          </Link>
        )}
      </td>
    </tr>
  )
}
