import { useMutation } from '@tanstack/react-query'
import { Download, Mail } from 'lucide-react'
import { Link, useParams } from 'react-router'
import { toast } from 'sonner'

import { useGetOrder } from '@/api/generated/endpoints/booking/booking'
import { resendMyTicket, useListMyTickets } from '@/api/generated/endpoints/tickets/tickets'
import { ArrowButton } from '@/design/ArrowButton'
import { icons } from '@/design/icons'
import { TicketCard } from '@/design/ticket/TicketCard'
import { Skeleton } from '@/design/ui/skeleton'
import { buildIcs, downloadIcs } from '@/lib/ics'
import { maskEmail } from '@/lib/mask'
import { formatHm } from '@/lib/time'

// B5 · Thanh toán thành công (Figma 03 · Buyer). Chỉ hiển thị kết quả đơn đã PAID và các vé đã phát hành.
export default function OrderSuccessPage() {
  const { orderId = '' } = useParams()
  const order = useGetOrder(orderId, {
    query: { refetchInterval: (q) => (q.state.data?.status === 'PENDING' ? 4000 : false) },
  })
  const code = order.data?.code
  // Vé phát hành bất đồng bộ sau IPN: chưa có thì hỏi lại đến khi đủ.
  const tickets = useListMyTickets(undefined, {
    query: {
      enabled: !!code,
      select: (r) => (r.data ?? []).filter((t) => t.order_code === code),
      refetchInterval: (q) => ((q.state.data?.data ?? []).some((t) => t.order_code === code) ? false : 3000),
    },
  })
  const resend = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map((id) => resendMyTicket(id)))
    },
    onSuccess: () => toast.success('Đã gửi lại email vé'),
    onError: () => toast.error('Chưa gửi được email, thử lại sau'),
  })

  if (order.isPending) return <Skeleton className="h-[320px] rounded-[30px]" />
  const o = order.data
  if (!o) {
    return (
      <div className="rounded-[30px] bg-ink px-6 py-16 text-center text-on-ink">
        <p className="type-h2">Không tìm thấy đơn hàng</p>
        <Link to="/orders" className="mt-4 inline-block type-body-m underline">
          Về danh sách đơn hàng
        </Link>
      </div>
    )
  }
  const list = tickets.data ?? []
  const email = o.buyer?.email

  const addToCalendar = () => {
    const s = o.showtime
    if (!s?.starts_at) return
    downloadIcs(
      `${o.code}.ics`,
      buildIcs({
        uid: o.id ?? o.code ?? 'order',
        title: o.event?.title ?? 'Sự kiện Vingo',
        startIso: s.starts_at,
        endIso: s.ends_at,
        location: s.venue?.name,
      }),
    )
  }

  return (
    <div className="flex flex-col gap-7">
      <section className="flex flex-col items-center gap-5 rounded-[30px] bg-ink px-6 py-12 text-center sm:px-12 sm:py-16">
        <span className="flex size-[72px] items-center justify-center rounded-pill bg-agent shadow-agent-glow">
          <img src={icons.check} alt="" className="size-[34px]" />
        </span>
        <h1 className="type-display-l text-on-ink max-sm:!text-[40px] max-sm:!leading-[1.1] max-sm:!tracking-[-1.6px]">
          Thanh toán thành công
        </h1>
        <p className="max-w-[560px] type-body-l text-on-ink-secondary">
          Đơn #{o.code} đã PAID{o.paid_at ? ` lúc ${formatHm(o.paid_at)}` : ''}.{' '}
          {list.length > 0 ? `${list.length} vé QR đã được phát hành` : 'Vé QR đang được phát hành'}
          {email ? ` và gửi tới ${email}` : ''}.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <ArrowButton to="/tickets">Xem vé của tôi</ArrowButton>
          <ArrowButton onClick={addToCalendar}>Thêm vào lịch</ArrowButton>
        </div>
      </section>

      <section aria-label="Vé đã phát hành" className="flex flex-wrap justify-center gap-4">
        {list.length === 0 && tickets.isPending
          ? [0, 1].map((i) => <Skeleton key={i} className="h-[210px] w-full max-w-[420px] rounded-[20px]" />)
          : list.map((t) => <TicketCard key={t.id} ticket={t} className="max-w-[420px]" sentTo={maskEmail(email)} />)}
      </section>

      <div className="flex flex-wrap justify-center gap-4">
        <Link
          to={list[0] ? `/tickets/${list[0].id}` : '/tickets'}
          className="flex items-center gap-2 rounded-pill border border-line bg-surface px-4 py-2.5 type-body-m-strong"
        >
          <Download className="size-4" aria-hidden /> Mở mã QR
        </Link>
        <button
          type="button"
          disabled={list.length === 0 || resend.isPending}
          onClick={() => resend.mutate(list.flatMap((t) => (t.id ? [t.id] : [])))}
          className="flex items-center gap-2 rounded-pill border border-line bg-surface px-4 py-2.5 type-body-m-strong disabled:opacity-50"
        >
          <Mail className="size-4" aria-hidden /> Gửi lại email
        </button>
      </div>
    </div>
  )
}
