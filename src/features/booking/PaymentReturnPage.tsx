import { Check, LoaderCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'

import { useGetOrder, useListMyOrders } from '@/api/generated/endpoints/booking/booking'
import { useGetPayment } from '@/api/generated/endpoints/payment/payment'
import { ArrowButton } from '@/design/ArrowButton'
import { Mascot } from '@/design/Mascot'
import { cn } from '@/lib/cn'
import { formatCountdown, remainingSeconds } from '@/lib/countdown'
import { maskEmail } from '@/lib/mask'
import { formatVnd } from '@/lib/money'
import { useNow } from '@/lib/useNow'
import { useMeStream } from '@/realtime/useMeStream'

import { isConfirmSlow, orderCodeFromTxnRef, recallPayingOrder, responseMessage, returnView } from './paymentReturn'

// B12 · Trở về từ VNPay và B13b · Thanh toán chưa thành công (Figma 03 · Buyer).
// Trang chỉ hiển thị: đơn chỉ chuyển PAID khi backend nhận IPN, web đợi order.paid trên /me/stream hoặc đọc lại đơn.
// Câu chữ cho người mua không dùng thuật ngữ kỹ thuật (IPN, PAID, đối soát).
export default function PaymentReturnPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  useMeStream()
  // Backend chỉ gửi ?txn_ref=...; tìm đơn theo mã đơn trong txn_ref (nhớ từ lúc sang VNPay hoặc tra danh sách đơn).
  const txnRef = params.get('txn_ref') ?? params.get('vnp_TxnRef')
  const urlCode = params.get('vnp_ResponseCode')
  const orderCode = orderCodeFromTxnRef(txnRef)
  const remembered = params.get('order_id') ?? recallPayingOrder(orderCode)
  const now = useNow()
  const [startedAt] = useState(() => Date.now())

  const orders = useListMyOrders(undefined, { query: { enabled: !remembered && !!orderCode } })
  const orderId = remembered ?? orders.data?.data?.find((o) => o.code === orderCode)?.id ?? ''

  const order = useGetOrder(orderId, {
    query: {
      enabled: !!orderId,
      refetchInterval: (q) => (q.state.data?.status === 'PENDING' ? 3000 : false),
    },
  })
  const payment = useGetPayment(orderId, {
    query: {
      enabled: !!orderId,
      retry: false,
      refetchInterval: (q) => (q.state.data?.status === 'OPEN' ? 3000 : false),
    },
  })
  const o = order.data
  const code = payment.data?.last_response_code ?? urlCode
  const view = returnView(o, payment.data, urlCode)
  const kind = view === 'failed' ? 'failed' : 'confirming'

  useEffect(() => {
    if (view === 'paid') navigate(`/orders/${orderId}/success`, { replace: true })
    else if (view === 'review') navigate(`/orders/${orderId}`, { replace: true })
  }, [view, orderId, navigate])

  const seats = (o?.items ?? [])
    .map((i) => (i.row && i.number != null ? `${i.row}-${i.number}` : null))
    .filter((v): v is string => !!v)
    .join(', ')
  const count = (o?.items ?? []).reduce((n, i) => n + (i.quantity ?? 1), 0)
  const orderLink = orderId ? `/orders/${orderId}` : '/orders'
  const holdLeft = o?.status === 'PENDING' && o.expires_at ? remainingSeconds(o.expires_at, now) : 0

  const email = maskEmail(o?.buyer?.email)
  const slow = isConfirmSlow(startedAt, now)
  const summary = [
    (o?.code ?? orderCode) ? `Đơn #${o?.code ?? orderCode}` : null,
    count > 0 ? `${count} vé` : null,
    o?.total_amount != null ? formatVnd(o.total_amount) : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="mx-auto mt-4 flex w-full max-w-[560px] flex-col items-center gap-6 rounded-[28px] bg-surface px-6 py-10 text-center sm:px-10 sm:py-12">
      <Mascot state={kind === 'confirming' ? 'thinking' : 'sorry'} className="h-[120px] w-auto" />

      {kind === 'confirming' ? (
        <>
          <div className="flex flex-col items-center gap-2" role="status" aria-live="polite">
            <h1 className="type-h2 text-foreground">
              {slow ? 'Xác nhận đang lâu hơn bình thường' : 'Đang xác nhận thanh toán…'}
            </h1>
            <p className="max-w-[400px] type-body-m text-ink-secondary">
              {slow
                ? 'Vingo vẫn đang kiểm tra với ngân hàng và sẽ tự cập nhật đơn. Nếu tài khoản đã bị trừ tiền, bạn đừng thanh toán lại nhé.'
                : 'Thường chỉ mất vài giây. Trang sẽ tự chuyển khi có kết quả.'}
            </p>
          </div>

          <div className="flex w-full flex-col gap-4 rounded-[16px] bg-canvas p-5 text-left">
            {(o?.event?.title || summary) && (
              <div className="flex flex-col gap-0.5 border-b border-line pb-4">
                {o?.event?.title && <p className="truncate type-body-m-strong text-foreground">{o.event.title}</p>}
                {summary && <p className="type-caption text-ink-tertiary">{summary}</p>}
              </div>
            )}
            <ol className="flex flex-col gap-3">
              <Step state="done">Đã gửi thanh toán qua VNPay</Step>
              <Step state="active">Ngân hàng đang xác nhận</Step>
              <Step state="todo">{count > 0 ? `Xuất ${count} vé và gửi về email` : 'Xuất vé và gửi về email'}</Step>
            </ol>
          </div>

          <p className="max-w-[400px] type-caption text-ink-tertiary">
            Bạn có thể rời trang này. Khi thanh toán được xác nhận, vé sẽ được gửi về{' '}
            {email ? <span className="text-ink-secondary">{email}</span> : 'email của bạn'} và nằm trong mục{' '}
            <Link to="/tickets" className="text-ink-secondary underline underline-offset-2">
              Vé của tôi
            </Link>
            .
          </p>
          <ArrowButton to={orderLink}>Xem đơn hàng</ArrowButton>
        </>
      ) : (
        <>
          <h1 className="type-h2 text-foreground">Thanh toán chưa thành công</h1>
          <p className="max-w-[440px] type-body-m text-ink-secondary">
            {code === '24'
              ? 'Giao dịch đã bị huỷ ở VNPay nên bạn chưa bị trừ tiền. '
              : 'Bạn chưa bị trừ tiền cho giao dịch này. '}
            {holdLeft > 0
              ? 'Ghế vẫn đang được giữ — thử lại ngay nhé.'
              : 'Hãy chọn lại ghế nếu ghế đã hết thời gian giữ.'}
          </p>
          <div className="flex w-full items-center justify-between gap-4 rounded-[16px] bg-canvas px-5 py-4 text-left">
            <div className="flex min-w-0 flex-col gap-1">
              <p className="type-body-m-strong text-foreground">
                {o?.code ? `Đơn #${o.code}` : 'Đơn hàng'}
                {seats ? ` · ${seats}` : ''}
              </p>
              <p className="type-caption text-ink-tertiary">
                {responseMessage(code)}
                {code ? ` (mã ${code})` : ''}
              </p>
            </div>
            {holdLeft > 0 && (
              <div className="flex shrink-0 flex-col items-end gap-0.5">
                <span className="type-caption text-ink-tertiary">Giữ ghế còn</span>
                <span className="type-h3 text-warning tabular-nums" role="timer">
                  {formatCountdown(holdLeft)}
                </span>
              </div>
            )}
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            {holdLeft > 0 ? (
              <ArrowButton variant="primary" to={`/orders/${orderId}/checkout`}>
                Thử thanh toán lại
              </ArrowButton>
            ) : (
              <ArrowButton
                variant="primary"
                to={
                  o?.event?.id && o.showtime?.id ? `/events/${o.event.id}/showtimes/${o.showtime.id}/seats` : '/events'
                }
              >
                Chọn lại ghế
              </ArrowButton>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function Step({ state, children }: { state: 'done' | 'active' | 'todo'; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3">
      <span
        aria-hidden
        className={cn(
          'flex size-5 shrink-0 items-center justify-center rounded-pill',
          state === 'done' && 'bg-ink text-on-ink',
          state === 'active' && 'text-foreground',
          state === 'todo' && 'border border-line',
        )}
      >
        {state === 'done' && <Check className="size-3" />}
        {state === 'active' && <LoaderCircle className="size-5 animate-spin motion-reduce:animate-none" />}
      </span>
      <span
        className={cn(
          state === 'active' ? 'type-body-m-strong' : 'type-body-m',
          state === 'todo' ? 'text-ink-tertiary' : 'text-foreground',
        )}
      >
        {children}
      </span>
    </li>
  )
}
