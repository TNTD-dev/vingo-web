import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Clock } from 'lucide-react'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'

import { cancelOrder, getGetOrderQueryKey, holdSeats, useGetOrder } from '@/api/generated/endpoints/booking/booking'
import { putBuyerProfile, useGetBuyerProfile } from '@/api/generated/endpoints/me/me'
import { createPayment } from '@/api/generated/endpoints/payment/payment'
import type { CreatePaymentBodyMethod, Order, PaymentIntent } from '@/api/generated/model'
import { newIdempotencyKey } from '@/api/idempotency'
import { profileFieldErrors } from '@/lib/profileErrors'
import { isApiError } from '@/api/problem'
import { ArrowButton } from '@/design/ArrowButton'
import { Mascot } from '@/design/Mascot'
import { icons } from '@/design/icons'
import { StatusBadge } from '@/design/StatusBadge'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/design/ui/dialog'
import { Skeleton } from '@/design/ui/skeleton'
import { cn } from '@/lib/cn'
import { formatCountdown, remainingSeconds } from '@/lib/countdown'
import { formatVnd } from '@/lib/money'
import { formatEventDateTime, formatTimeRange } from '@/lib/time'
import { useNow } from '@/lib/useNow'
import { useMeStream } from '@/realtime/useMeStream'

import {
  EMPTY_PROFILE,
  hasErrors,
  isSafePaymentUrl,
  needsSave,
  toProfile,
  validateProfile,
  type ProfileDraft,
  type ProfileErrors,
} from './checkoutForm'
import { rememberPayingOrder } from './paymentReturn'
import { Steps } from './Steps'

// B4 · Thanh toán và B4b · Chờ thanh toán VNPay (Figma 03 · Buyer). Trang chỉ tạo thanh toán rồi chờ;
// trạng thái đơn đổi qua IPN, web nhận qua /me/stream hoặc đọc lại đơn (CLAUDE.md mục 5).
export default function CheckoutPage() {
  const { orderId = '' } = useParams()
  const navigate = useNavigate()
  useMeStream()

  const order = useGetOrder(orderId, {
    query: { refetchInterval: (q) => (q.state.data?.status === 'PENDING' ? 4000 : false) },
  })
  const status = order.data?.status

  // Đơn đã thanh toán (hoặc cần duyệt) → sang chi tiết đơn.
  useEffect(() => {
    if (status === 'PAID') navigate(`/orders/${orderId}/success`, { replace: true })
    else if (status === 'NEEDS_REVIEW') navigate(`/orders/${orderId}`, { replace: true })
  }, [status, orderId, navigate])

  if (order.isPending) return <CheckoutSkeleton />
  if (order.isError) {
    const missing = isApiError(order.error, 'NOT_FOUND') || isApiError(order.error, 'FORBIDDEN')
    return (
      <Message
        title={missing ? 'Không tìm thấy đơn hàng' : 'Không tải được đơn hàng'}
        hint={missing ? 'Đơn không tồn tại hoặc không thuộc tài khoản này.' : 'Kiểm tra kết nối rồi thử lại.'}
        action={missing ? undefined : { label: 'Thử lại', onClick: () => void order.refetch() }}
        link={{ to: '/orders', label: 'Đơn hàng của tôi' }}
      />
    )
  }
  if (status !== 'PENDING' && status !== 'EXPIRED') return <ExpiredMessage order={order.data} />
  return <Checkout order={order.data} />
}

type Method = { value: CreatePaymentBodyMethod; title: string; hint: string; icon: string; dark?: boolean }
const METHODS: Method[] = [
  { value: 'VNPAYQR', title: 'VNPay QR', hint: 'Quét mã bằng app ngân hàng / ví', icon: icons.qr, dark: true },
  { value: 'ATM', title: 'Thẻ ATM nội địa', hint: 'Qua cổng VNPay', icon: icons.bank },
  { value: 'INTCARD', title: 'Thẻ quốc tế', hint: 'Visa, Mastercard, JCB', icon: icons.card },
]

function seatLabel(item: NonNullable<Order['items']>[number]) {
  return item.row && item.number != null ? `${item.row}-${item.number}` : undefined
}

function Checkout({ order }: { order: Order }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const orderId = order.id ?? ''
  const now = useNow()
  const left = order.expires_at ? remainingSeconds(order.expires_at, now) : 0
  const expired = order.status === 'EXPIRED' || left === 0
  const items = order.items ?? []

  // ---- hồ sơ người nhận vé ----
  const profile = useGetBuyerProfile({ query: { retry: false } })
  const saved = profile.data
  const [draft, setDraft] = useState<ProfileDraft>()
  const values: ProfileDraft = draft ?? saved ?? EMPTY_PROFILE
  const [errors, setErrors] = useState<ProfileErrors>({})
  const [method, setMethod] = useState<CreatePaymentBodyMethod>('VNPAYQR')
  const [intent, setIntent] = useState<PaymentIntent>()
  const [open, setOpen] = useState(false)
  const keyRef = useRef<{ sig: string; key: string }>(undefined)

  const edit = (field: keyof ProfileDraft, value: string) => {
    setDraft({ ...values, [field]: value })
    if (errors[field]) setErrors({ ...errors, [field]: undefined })
  }

  // ---- thanh toán ----
  const pay = useMutation({
    mutationFn: async () => {
      if (needsSave(values, saved)) await putBuyerProfile(toProfile(values))
      const sig = `${orderId}:${method}`
      if (keyRef.current?.sig !== sig) keyRef.current = { sig, key: newIdempotencyKey() }
      return createPayment(orderId, { method }, { headers: { 'Idempotency-Key': keyRef.current.key } })
    },
    onSuccess: (data) => {
      setIntent(data)
      setOpen(true)
    },
    onError: (error) => {
      // Lỗi mạng/5xx/429: giữ khoá để lần bấm lại là retry của cùng thao tác. Lỗi nghiệp vụ: bỏ khoá.
      if (isApiError(error) && error.status < 500 && error.status !== 429) keyRef.current = undefined
      if (isApiError(error, 'HOLD_EXPIRED') || isApiError(error, 'ORDER_STATE_INVALID')) {
        toast.error('Đơn không còn giữ chỗ. Hãy chọn ghế lại.')
        void queryClient.invalidateQueries({ queryKey: getGetOrderQueryKey(orderId) })
      } else if (isApiError(error, 'VALIDATION_ERROR')) {
        const found = profileFieldErrors(error)
        if (hasErrors(found)) setErrors(found)
        toast.error('Thông tin người nhận vé chưa hợp lệ. Vui lòng kiểm tra lại.')
      } else if (isApiError(error, 'PROFILE_REQUIRED')) {
        toast.error('Cần điền thông tin người nhận vé trước khi thanh toán.')
      } else if (isApiError(error) && error.status === 429) {
        toast.error('Bạn thao tác quá nhanh. Đợi vài giây rồi thử lại.')
      } else {
        toast.error('Chưa tạo được thanh toán. Vui lòng thử lại.')
      }
    },
  })

  const cancel = useMutation({
    mutationFn: () => cancelOrder(orderId),
    onSuccess: () => {
      toast.success('Đã huỷ đơn và nhả ghế')
      navigate(order.event?.id ? `/events/${order.event.id}` : '/events', { replace: true })
    },
    onError: (error) => {
      if (isApiError(error, 'ORDER_STATE_INVALID')) {
        void queryClient.invalidateQueries({ queryKey: getGetOrderQueryKey(orderId) })
      } else toast.error('Chưa huỷ được đơn. Vui lòng thử lại.')
    },
  })

  function submit() {
    const found = validateProfile(values)
    setErrors(found)
    if (hasErrors(found)) return
    if (intent && intent.order_id === orderId && method === (keyRef.current?.sig.split(':')[1] as string)) {
      setOpen(true) // đã tạo thanh toán cho đơn này, mở lại hộp thoại
      return
    }
    pay.mutate()
  }

  function openGateway() {
    if (isSafePaymentUrl(intent?.payment_url)) {
      rememberPayingOrder({ id: orderId, code: order.code })
      window.location.assign(intent.payment_url)
    } else toast.error('Liên kết thanh toán không hợp lệ. Vui lòng thử lại.')
  }

  const total = order.total_amount
  const seatNames = items.map(seatLabel).filter(Boolean)
  const holdText = seatNames.length
    ? `Ghế ${seatNames.join(', ')} đang được giữ cho bạn`
    : `${items.reduce((s, i) => s + (i.quantity ?? 1), 0)} vé khu đứng đang được giữ cho bạn`

  return (
    <div className="flex flex-col gap-7">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <p className="type-mono-label text-ink-secondary">
            {'// ĐƠN '}
            {order.code ? `#${order.code}` : ''} · {order.status}
          </p>
          <h1 className="type-h1 text-foreground">Thanh toán</h1>
        </div>
        <Steps current={2} />
      </header>

      <div
        className={cn(
          'flex flex-wrap items-center justify-between gap-x-6 gap-y-2 rounded-[16px] px-5 py-3.5 text-on-ink',
          expired ? 'bg-danger' : 'bg-ink',
        )}
      >
        <div className="flex items-center gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-pill bg-agent">
            <img src={icons.lock} alt="" className="size-4" />
          </span>
          <p className="type-body-m-strong">{expired ? 'Hết thời gian giữ ghế' : holdText}</p>
        </div>
        <div className="flex items-center gap-2.5">
          {order.expires_at && (
            <span className="type-caption text-on-ink-secondary">
              {expired ? 'Đã trả ghế lúc' : 'Hết hạn lúc'} {formatTimeRange(order.expires_at)}
            </span>
          )}
          <span
            className={cn(
              'rounded-sm bg-ink-raised px-3 py-1.5 text-[21px] leading-[1.2] tracking-[-0.01em] tabular-nums',
              expired ? 'text-on-ink' : 'text-agent',
            )}
            role="timer"
            aria-label="Thời gian giữ ghế còn lại"
          >
            {formatCountdown(left)}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-6">
          <section className="flex flex-col gap-5 rounded-lg bg-surface p-5 sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <h2 className="type-h3 text-foreground">Thông tin người nhận vé</h2>
              {saved && <span className="type-caption text-ink-tertiary">Lấy từ hồ sơ</span>}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Họ và tên"
                value={values.full_name}
                error={errors.full_name}
                autoComplete="name"
                onChange={(v) => edit('full_name', v)}
              />
              <Field
                label="Số điện thoại"
                value={values.phone}
                error={errors.phone}
                autoComplete="tel"
                inputMode="tel"
                onChange={(v) => edit('phone', v)}
              />
            </div>
            <Field
              label="Email nhận vé"
              value={values.email}
              error={errors.email}
              autoComplete="email"
              inputMode="email"
              onChange={(v) => edit('email', v)}
            />
          </section>

          <section className="flex flex-col gap-3.5 rounded-lg bg-surface p-5 sm:p-7">
            <h2 className="type-h3 text-foreground">Phương thức thanh toán</h2>
            <fieldset className="flex flex-col gap-3.5">
              <legend className="sr-only">Phương thức thanh toán</legend>
              {METHODS.map((m) => (
                <MethodOption
                  key={m.value}
                  method={m}
                  selected={method === m.value}
                  onSelect={() => setMethod(m.value)}
                />
              ))}
            </fieldset>
          </section>
        </div>

        <aside className="flex w-full shrink-0 flex-col gap-[18px] rounded-lg bg-surface p-6 lg:w-[420px]">
          <div className="flex items-center gap-3.5">
            {order.event?.poster_url ? (
              <img src={order.event.poster_url} alt="" className="size-16 shrink-0 rounded-[12px] object-cover" />
            ) : (
              <div className="size-16 shrink-0 rounded-[12px] bg-muted" />
            )}
            <div className="flex min-w-0 flex-col gap-1">
              <h2 className="type-h4 text-foreground">{order.event?.title}</h2>
              <p className="type-caption text-ink-secondary">
                {[order.showtime?.starts_at && formatEventDateTime(order.showtime.starts_at), order.event?.venue_name]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
          </div>
          <div className="h-px bg-line" />
          <h3 className="type-mono-label text-ink-secondary">Chi tiết đơn</h3>
          <ul className="flex flex-col gap-3.5">
            {items.map((item) => {
              const seat = seatLabel(item)
              return (
                <li key={item.id} className="flex items-center justify-between gap-3">
                  <span className="type-body-m text-ink-secondary">
                    Khu {item.zone}
                    {seat ? ` · ${seat}` : ` · ${item.quantity ?? 1} vé`}
                  </span>
                  <span className="shrink-0 type-body-m-strong text-foreground">
                    {formatVnd((item.unit_price ?? 0) * (item.quantity ?? 1))}
                  </span>
                </li>
              )
            })}
          </ul>
          <div className="h-px bg-line" />
          <div className="flex items-center justify-between">
            <span className="type-body-m text-ink-secondary">Tổng cộng</span>
            <span className="type-h3 text-foreground">{total !== undefined ? formatVnd(total) : '—'}</span>
          </div>

          <button
            type="button"
            disabled={pay.isPending || expired}
            onClick={submit}
            className="flex items-center gap-5 rounded-md bg-ink py-[5px] pr-6 pl-[5px] text-on-ink outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="flex h-11 w-12 shrink-0 items-center justify-center rounded-sm bg-surface">
              <img src={icons.chevronsRightDark} alt="" className="size-5" />
            </span>
            <span className="type-body-m-strong">
              {pay.isPending
                ? 'Đang tạo thanh toán…'
                : `Thanh toán${total !== undefined ? ` ${formatVnd(total)}` : ''}`}
            </span>
          </button>
          <p className="type-caption text-ink-tertiary">
            Vé chỉ được phát hành sau khi VNPay xác nhận. Vingo không hỗ trợ hoàn tiền hay đổi ghế sau khi thanh toán.
          </p>
        </aside>
      </div>

      <HoldExpiredDialog open={expired} order={order} seatNames={seatNames.filter((n): n is string => !!n)} />

      <WaitingDialog
        open={open && !expired}
        onOpenChange={setOpen}
        total={total}
        left={left}
        onOpenGateway={openGateway}
        onCancel={() => cancel.mutate()}
        cancelling={cancel.isPending}
      />
    </div>
  )
}

function Field({
  label,
  value,
  error,
  onChange,
  ...rest
}: {
  label: string
  value: string
  error?: string
  onChange: (v: string) => void
} & Pick<React.ComponentProps<'input'>, 'autoComplete' | 'inputMode'>) {
  const id = useId()
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <label htmlFor={id} className="type-mono-label text-ink-secondary">
        {label}
      </label>
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className={cn(
          'h-[52px] w-full rounded-md border bg-surface px-4 type-body-m text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring',
          error ? 'border-danger' : 'border-line',
        )}
        {...rest}
      />
      {error && (
        <p id={`${id}-error`} className="type-caption text-danger">
          {error}
        </p>
      )}
    </div>
  )
}

function MethodOption({ method, selected, onSelect }: { method: Method; selected: boolean; onSelect: () => void }) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-center gap-3.5 rounded-[16px] p-4 has-focus-visible:ring-2 has-focus-visible:ring-ring',
        selected ? 'border-2 border-foreground p-[15px]' : 'border border-line hover:bg-canvas',
      )}
    >
      <input
        type="radio"
        name="payment-method"
        value={method.value}
        checked={selected}
        onChange={onSelect}
        className="sr-only"
      />
      <span
        className={cn(
          'flex size-11 shrink-0 items-center justify-center rounded-[12px]',
          method.dark ? 'bg-ink' : 'bg-canvas',
        )}
      >
        <img src={method.icon} alt="" className="size-5" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="type-body-m-strong text-foreground">{method.title}</span>
        <span className="type-caption text-ink-tertiary">{method.hint}</span>
      </span>
      <span
        className={cn(
          'flex size-[22px] shrink-0 items-center justify-center rounded-pill',
          selected ? 'bg-ink' : 'border border-line',
        )}
      >
        {selected && <span className="size-2 rounded-pill bg-surface" />}
      </span>
    </label>
  )
}

/** B4b · hộp thoại chờ thanh toán. Chưa vẽ mã QR: dự án chưa có thư viện QR, tạm mở cổng VNPay bằng nút. */
function WaitingDialog({
  open,
  onOpenChange,
  total,
  left,
  onOpenGateway,
  onCancel,
  cancelling,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  total?: number
  left: number
  onOpenGateway: () => void
  onCancel: () => void
  cancelling: boolean
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[480px] gap-5 rounded-xl border-0 bg-canvas p-6">
        <DialogTitle className="type-h3 text-foreground">Quét để thanh toán</DialogTitle>
        <DialogDescription className="sr-only">
          Mở cổng VNPay để hoàn tất thanh toán. Trang sẽ tự cập nhật khi VNPay xác nhận.
        </DialogDescription>
        <div className="flex flex-col gap-5 rounded-lg bg-surface p-5">
          <div className="flex items-center justify-between">
            <span className="type-mono-small text-foreground">VNPay QR</span>
            <StatusBadge tone="warning">PENDING</StatusBadge>
          </div>
          <div className="flex flex-col gap-2">
            <span className="type-mono-small text-ink-tertiary">Tổng thanh toán</span>
            <span className="type-h1 text-foreground">{total !== undefined ? formatVnd(total) : '—'}</span>
            <span className="flex items-center gap-1.5 type-body-m text-warning">
              <Clock className="size-4" /> Còn {formatCountdown(left)} để thanh toán
            </span>
            <p className="type-body-m text-ink-secondary">Quét bằng app ngân hàng hoặc ví hỗ trợ VNPay QR.</p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={onOpenGateway}
              className="rounded-pill bg-ink px-5 py-3 type-body-m-strong text-on-ink outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Mở cổng VNPay
            </button>
            <button
              type="button"
              disabled={cancelling}
              onClick={onCancel}
              className="rounded-pill border border-line bg-surface px-5 py-3 type-body-m-strong text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            >
              {cancelling ? 'Đang huỷ…' : 'Huỷ đơn'}
            </button>
          </div>
        </div>
        <output className="flex items-center gap-2 px-1 type-caption text-ink-secondary">
          <span className="size-1.5 rounded-pill bg-warning" />
          Đang chờ VNPay xác nhận… Trang sẽ tự cập nhật khi thanh toán xong.
        </output>
      </DialogContent>
    </Dialog>
  )
}

/** B13a · Hết hạn giữ ghế: hộp thoại phủ lên trang thanh toán, cho giữ lại đúng các ghế cũ hoặc chọn ghế khác. */
function HoldExpiredDialog({ open, order, seatNames }: { open: boolean; order: Order; seatNames: string[] }) {
  const navigate = useNavigate()
  const seatIds = (order.items ?? []).flatMap((i) => (i.seat_id ? [i.seat_id] : []))
  const showtimeId = order.showtime?.id
  const seatsPath =
    order.event?.id && showtimeId ? `/events/${order.event.id}/showtimes/${showtimeId}/seats` : '/events'
  const canRehold = !!showtimeId && seatIds.length > 0 && seatIds.length === (order.items ?? []).length
  const keyRef = useRef<string>(undefined)

  const rehold = useMutation({
    mutationFn: () => {
      keyRef.current ??= newIdempotencyKey()
      return holdSeats(showtimeId!, { seat_ids: seatIds }, { headers: { 'Idempotency-Key': keyRef.current } })
    },
    onSuccess: (created) => navigate(`/orders/${created.id}/checkout`, { replace: true }),
    onError: (error) => {
      keyRef.current = undefined
      toast.error(
        isApiError(error, 'SEAT_TAKEN')
          ? 'Rất tiếc, có ghế vừa bị người khác giữ. Hãy chọn ghế khác.'
          : 'Chưa giữ lại được ghế.',
      )
      if (isApiError(error, 'SEAT_TAKEN')) navigate(seatsPath)
    },
  })

  return (
    <Dialog open={open}>
      <DialogContent
        showCloseButton={false}
        className="max-w-[420px] gap-0 rounded-[28px] p-8 text-center"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <Mascot state="sorry" className="mx-auto h-[88px] w-auto" />
        <DialogTitle className="mt-5 type-h2 text-foreground">Hết 10 phút giữ ghế rồi</DialogTitle>
        <DialogDescription className="mt-3 type-body-m text-ink-secondary">
          {seatNames.length
            ? `Ghế ${seatNames.join(', ')} đã được trả lại cho người khác. `
            : 'Ghế đã được trả lại cho người khác. '}
          {canRehold
            ? `Tin vui: ${seatIds.length > 1 ? `${seatIds.length} ghế này` : 'ghế này'} hiện vẫn còn trống.`
            : 'Hãy chọn lại ghế để tiếp tục.'}
        </DialogDescription>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {canRehold && (
            <ArrowButton variant="primary" onClick={() => rehold.mutate()} disabled={rehold.isPending}>
              {rehold.isPending ? 'Đang giữ…' : `Giữ lại ${seatIds.length} ghế này`}
            </ArrowButton>
          )}
          <ArrowButton to={seatsPath} replace>
            Chọn ghế khác
          </ArrowButton>
        </div>
        <p className="mt-5 type-caption text-ink-tertiary">
          Nếu đã quét QR nhưng chưa thấy vé, kiểm tra Đơn hàng sau vài phút — tiền về sẽ được xử lý thủ công.
        </p>
      </DialogContent>
    </Dialog>
  )
}

function ExpiredMessage({ order }: { order: Order }) {
  const cancelled = order.status === 'CANCELLED'
  const to =
    order.event?.id && order.showtime?.id ? `/events/${order.event.id}/showtimes/${order.showtime.id}/seats` : '/events'
  return (
    <Message
      title={cancelled ? 'Đơn đã được huỷ' : 'Hết thời gian giữ ghế'}
      hint={
        cancelled
          ? 'Ghế đã được nhả. Bạn có thể chọn lại ghế bất cứ lúc nào.'
          : 'Ghế đã được trả lại. Chọn lại ghế để tiếp tục đặt vé.'
      }
      link={{ to, label: 'Chọn lại ghế' }}
    />
  )
}

function Message({
  title,
  hint,
  action,
  link,
}: {
  title: string
  hint: string
  action?: { label: string; onClick: () => void }
  link?: { to: string; label: string }
}): ReactNode {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg bg-surface px-6 py-16 text-center">
      <Mascot state="sorry" className="h-28 w-auto" />
      <h1 className="type-h4 text-foreground">{title}</h1>
      <p className="type-body-m text-ink-secondary">{hint}</p>
      <div className="mt-2 flex gap-2">
        {action && (
          <button
            type="button"
            onClick={action.onClick}
            className="rounded-pill bg-ink px-5 py-2.5 type-body-m-strong text-on-ink outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {action.label}
          </button>
        )}
        {link && (
          <Link
            to={link.to}
            className="rounded-pill border border-line bg-surface px-5 py-2.5 type-body-m-strong outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {link.label}
          </Link>
        )}
      </div>
    </div>
  )
}

function CheckoutSkeleton() {
  return (
    <div className="flex flex-col gap-7" aria-busy="true" aria-label="Đang tải đơn hàng">
      <Skeleton className="h-20 w-72" />
      <Skeleton className="h-14 rounded-[16px]" />
      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="flex flex-1 flex-col gap-6">
          <Skeleton className="h-64 rounded-lg" />
          <Skeleton className="h-72 rounded-lg" />
        </div>
        <Skeleton className="h-[460px] rounded-lg lg:w-[420px]" />
      </div>
    </div>
  )
}
