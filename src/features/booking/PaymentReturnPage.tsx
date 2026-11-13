import { Check } from 'lucide-react'
import { useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'

import { useGetOrder } from '@/api/generated/endpoints/booking/booking'
import { ArrowButton } from '@/design/ArrowButton'
import { Mascot } from '@/design/Mascot'
import { cn } from '@/lib/cn'
import { formatCountdown, remainingSeconds } from '@/lib/countdown'
import { useNow } from '@/lib/useNow'
import { useMeStream } from '@/realtime/useMeStream'

import { responseMessage, returnKind } from './paymentReturn'

// B12 · Trở về từ VNPay và B13b · Thanh toán chưa thành công (Figma 03 · Buyer).
// Trang chỉ hiển thị: đơn chỉ chuyển PAID khi backend nhận IPN, web đợi order.paid trên /me/stream hoặc đọc lại đơn.
export default function PaymentReturnPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  useMeStream()
  const orderId = params.get('order_id') ?? ''
  const code = params.get('vnp_ResponseCode')
  const txnRef = params.get('vnp_TxnRef')
  const kind = returnKind(code)
  const now = useNow()

  const order = useGetOrder(orderId, {
    query: {
      enabled: !!orderId,
      refetchInterval: (q) => (q.state.data?.status === 'PENDING' ? 3000 : false),
    },
  })
  const o = order.data

  useEffect(() => {
    if (o?.status === 'PAID') navigate(`/orders/${orderId}/success`, { replace: true })
  }, [o?.status, orderId, navigate])

  const seats = (o?.items ?? [])
    .map((i) => (i.row && i.number != null ? `${i.row}-${i.number}` : null))
    .filter((v): v is string => !!v)
    .join(', ')
  const count = (o?.items ?? []).reduce((n, i) => n + (i.quantity ?? 1), 0)
  const orderLink = orderId ? `/orders/${orderId}` : '/orders'
  const holdLeft = o?.status === 'PENDING' && o.expires_at ? remainingSeconds(o.expires_at, now) : 0

  return (
    <div className="mx-auto mt-4 flex w-full max-w-[640px] flex-col items-center gap-5 rounded-[28px] bg-surface px-6 py-10 text-center sm:px-10 sm:py-12">
      <Mascot state={kind === 'confirming' ? 'thinking' : 'sorry'} className="h-[130px] w-auto" />

      {kind === 'confirming' ? (
        <>
          <h1 className="type-h2 text-foreground">Đang xác nhận thanh toán…</h1>
          <p className="max-w-[420px] type-body-m text-ink-secondary">
            VNPay đã đưa bạn quay lại. Vingo đang chờ ngân hàng xác nhận — thường chưa tới 10 giây. Đừng đóng trang này
            nhé.
          </p>
          <ol className="flex w-full flex-col gap-3 rounded-[16px] bg-canvas p-5 text-left">
            <Step state="done">Đã nhận phản hồi từ VNPay (mã {code})</Step>
            <Step state="active">Chờ VNPay xác nhận qua IPN</Step>
            <Step state="todo">{count > 0 ? `Phát hành ${count} vé và gửi email` : 'Phát hành vé và gửi email'}</Step>
          </ol>
          <p className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 type-body-m">
            {txnRef && <span className="type-mono-small text-ink-tertiary uppercase">Mã giao dịch {txnRef}</span>}
            <Link to={orderLink} className="type-body-m-strong text-foreground">
              Xem đơn hàng →
            </Link>
          </p>
          <p className="max-w-[420px] type-caption text-ink-tertiary">
            Trang này chỉ hiển thị. Đơn chỉ chuyển sang PAID khi hệ thống nhận IPN hoặc đối soát với VNPay.
          </p>
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
                Mã phản hồi VNPay: {code ?? '—'} · {responseMessage(code)}
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
              <>
                <ArrowButton variant="primary" to={`/orders/${orderId}/checkout`}>
                  Thử thanh toán lại
                </ArrowButton>
                <ArrowButton to={`/orders/${orderId}/checkout`}>Đổi phương thức</ArrowButton>
              </>
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
          state === 'active' && 'animate-pulse bg-agent',
          state === 'todo' && 'bg-muted',
        )}
      >
        {state === 'done' && <Check className="size-3" />}
      </span>
      <span className={cn('type-body-m-strong', state === 'todo' ? 'text-ink-tertiary' : 'text-foreground')}>
        {children}
      </span>
    </li>
  )
}
