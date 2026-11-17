import { useRef, useState } from 'react'
import { Link } from 'react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  useAdminGetOrder,
  resolveReview,
  reconcileOrder,
} from '@/api/generated/endpoints/admin-operations/admin-operations'
import type { ResolveReviewBody } from '@/api/generated/model'
import { newIdempotencyKey } from '@/api/idempotency'
import { Panel, QueryState, StateBadge, Field, ErrorNotice, ConfirmDialog } from '@/design/admin/AdminUi'
import { AdminAction } from '@/design/admin/AdminAction'
import { dateText } from '@/design/admin/data'
import { elapsedText, maskPhone, vnWeekdayDate, vnTime } from '@/design/admin/format'
import { orderHeadline, reasonHeadline, reasonHint } from '@/design/admin/reasons'
import { Button } from '@/design/ui/button'
import { StatusBadge } from '@/design/StatusBadge'
import { formatVnd } from '@/lib/money'
import { cn } from '@/lib/cn'
import { toast } from 'sonner'
import { buildTimeline, lateMinutes, nodeTime } from './orderTimeline'

const LOCK_ID = 'decision-lock-reason'

/** Chi tiết một đơn: dải tóm tắt, các thẻ kiểm tra, diễn biến, và (với đơn cần duyệt) khối quyết định. */
export default function OrderReviewPanel({ orderId }: { orderId: string }) {
  const query = useAdminGetOrder(orderId),
    client = useQueryClient(),
    [now] = useState(() => new Date()),
    [reason, setReason] = useState(''),
    [refund, setRefund] = useState(false)
  const attempt = useRef<{ body: string; key: string } | null>(null)
  const review = useMutation({
    mutationFn: (body: ResolveReviewBody) => {
      const serialized = JSON.stringify(body)
      if (attempt.current?.body !== serialized) attempt.current = { body: serialized, key: newIdempotencyKey() }
      return resolveReview(orderId, body, { headers: { 'Idempotency-Key': attempt.current.key } })
    },
    onSuccess: async () => {
      attempt.current = null
      setRefund(false)
      toast.success('Đã xử lý đơn hàng')
      await client.invalidateQueries()
    },
  })
  const reconcile = useMutation({
    mutationFn: () => reconcileOrder(orderId),
    onSuccess: async () => {
      await client.invalidateQueries()
      toast.success('Đã đối soát thanh toán')
    },
  })
  const order = query.data,
    payment = order?.payments?.at(-1),
    needsReview = order?.status === 'NEEDS_REVIEW',
    tickets = order?.items?.reduce((sum, v) => sum + (v.quantity ?? 1), 0) ?? 0,
    noteOk = reason.trim().length >= 3,
    locked = review.isPending || !noteOk,
    lockReason = review.isPending
      ? 'Đang xử lý, vui lòng chờ…'
      : !noteOk
        ? 'Nhập ghi chú xử lý (ít nhất 3 ký tự) để mở khoá hai nút này.'
        : null
  const late = order ? lateMinutes(order) : null,
    timeline = order ? buildTimeline(order, now) : [],
    waited = needsReview
      ? (order?.history?.find((h) => h.status === 'NEEDS_REVIEW')?.at ?? order?.created_at)
      : undefined
  return (
    <QueryState query={query}>
      {order && (
        <>
          <section className={cn('admin-summary', needsReview && 'is-attention')} aria-label="Tóm tắt đơn">
            <div className="admin-summary-main">
              <p className="admin-summary-caption">
                {needsReview ? (
                  <>// CẦN XỬ LÝ{waited ? ` · ĐÃ CHỜ ${elapsedText(waited, now).toLocaleUpperCase('vi-VN')}` : ''}</>
                ) : (
                  <StateBadge value={order.status} />
                )}
              </p>
              <h2 className="admin-summary-title">
                {needsReview ? reasonHeadline(order.review_reason, late) : orderHeadline(order.status)}
              </h2>
              {needsReview && <p className="admin-summary-text">{reasonHint(order.review_reason)}</p>}
            </div>
            <div className="admin-summary-side">
              <p className="admin-summary-amount">{formatVnd(order.total_amount ?? 0)}</p>
              <p>
                {tickets ? `${tickets} vé · ` : ''}
                {order.event?.title}
              </p>
              {order.showtime?.starts_at && (
                <p>
                  {vnWeekdayDate(order.showtime.starts_at)} · {vnTime(order.showtime.starts_at)}
                  {order.event?.venue_name ? ` · ${order.event.venue_name}` : ''}
                </p>
              )}
            </div>
          </section>

          <div className="admin-checks">
            <Panel className="admin-check">
              <header>
                <h3>
                  <b>1</b> Thanh toán
                </h3>
                {payment && order.total_amount !== undefined && (
                  <StatusBadge tone={payment.amount === order.total_amount ? 'success' : 'danger'}>
                    {payment.amount === order.total_amount ? 'Khớp' : 'Lệch'}
                  </StatusBadge>
                )}
              </header>
              <dl>
                <div>
                  <dt>Tổng đơn</dt>
                  <dd>{formatVnd(order.total_amount ?? 0)}</dd>
                </div>
                <div>
                  <dt>VNPay đã nhận</dt>
                  <dd>{payment ? formatVnd(payment.amount ?? 0) : 'Chưa có giao dịch'}</dd>
                </div>
                {payment?.txn_ref && (
                  <div>
                    <dt>Mã giao dịch</dt>
                    <dd className="font-mono">{payment.txn_ref}</dd>
                  </div>
                )}
                {payment?.last_response_code && (
                  <div>
                    <dt>Mã phản hồi VNPay</dt>
                    <dd className="font-mono">{payment.last_response_code}</dd>
                  </div>
                )}
              </dl>
            </Panel>
            {!!order.items?.length && (
              <Panel className="admin-check">
                <header>
                  <h3>
                    <b>2</b> Ghế trong đơn
                  </h3>
                </header>
                <dl>
                  {order.items.map((v, i) => (
                    <div key={v.id ?? i}>
                      <dt>{v.row ? `${v.zone} · Hàng ${v.row} · Ghế ${v.number}` : `${v.zone} · Khu đứng`}</dt>
                      <dd>
                        {v.row ? v.tier : `${v.quantity} chỗ`}
                        {v.row ? ` · ${formatVnd(v.unit_price ?? 0)}` : ` · ${formatVnd(v.unit_price ?? 0)}/chỗ`}
                      </dd>
                    </div>
                  ))}
                </dl>
              </Panel>
            )}
            <Panel className="admin-check">
              <header>
                <h3>
                  <b>{order.items?.length ? 3 : 2}</b> Người mua
                </h3>
              </header>
              {order.buyer ? (
                <dl>
                  <div>
                    <dt>Họ tên</dt>
                    <dd>{order.buyer.full_name}</dd>
                  </div>
                  <div>
                    <dt>Email</dt>
                    <dd>{order.buyer.email}</dd>
                  </div>
                  <div>
                    <dt>Điện thoại</dt>
                    <dd>{maskPhone(order.buyer.phone)}</dd>
                  </div>
                </dl>
              ) : (
                <p className="admin-sub">Đơn chưa có thông tin người mua.</p>
              )}
            </Panel>
          </div>

          {!!timeline.length && (
            <Panel className="admin-timeline-panel">
              <p className="admin-caption mb-4">
                Diễn biến{order.created_at ? ` · ${dateText(order.created_at).slice(6)}` : ''}
              </p>
              <ol className="admin-hline">
                {timeline.map((n, i) => (
                  <li key={`${n.label}-${i}`} data-tone={n.tone}>
                    <i aria-hidden />
                    <time>{nodeTime(n)}</time>
                    <strong>{n.label}</strong>
                    {n.detail && <span>{n.detail}</span>}
                  </li>
                ))}
              </ol>
            </Panel>
          )}

          {needsReview && (
            <form
              className="admin-decision"
              onSubmit={(e) => {
                e.preventDefault()
                if (!locked) review.mutate({ action: 'ISSUE_TICKETS', reason: reason.trim() })
              }}
            >
              <div className="admin-decision-note">
                <Field label="Ghi chú xử lý · bắt buộc">
                  <textarea
                    required
                    minLength={3}
                    maxLength={1000}
                    placeholder="Ví dụ: đã đối chiếu VNPay, ghế còn trống, phát vé cho khách…"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </Field>
                <p className="admin-hint">Ghi chú được lưu vào nhật ký audit cùng tên người xử lý.</p>
              </div>
              <div className="admin-decision-actions">
                <p className="admin-caption">Quyết định</p>
                <AdminAction
                  className="w-full justify-start"
                  disabled={locked}
                  aria-describedby={lockReason ? LOCK_ID : undefined}
                >
                  {tickets ? `Phát hành ${tickets} vé và gửi email` : 'Phát hành vé và gửi email'}
                </AdminAction>
                <AdminAction
                  secondary
                  type="button"
                  className="w-full justify-start"
                  disabled={locked}
                  aria-describedby={lockReason ? LOCK_ID : undefined}
                  onClick={() => setRefund(true)}
                >
                  Ghi nhận đã hoàn tiền thủ công
                </AdminAction>
                {lockReason && (
                  <p id={LOCK_ID} className="admin-lock-reason" role="status">
                    {lockReason}
                  </p>
                )}
                <ErrorNotice error={review.error} />
                <p className="admin-hint">
                  Hoàn tiền thực hiện thủ công trên cổng VNPay; hệ thống chỉ ghi nhận trạng thái đã hoàn tiền.
                </p>
              </div>
            </form>
          )}

          <details className="admin-more-tools">
            <summary>Công cụ khác</summary>
            <div>
              <Link to={`/admin/tickets?order_id=${orderId}`} className="underline">
                Xem vé của đơn
              </Link>
              <Link to={`/admin/audit-logs?entity=order&entity_id=${orderId}`} className="underline">
                Nhật ký thao tác
              </Link>
              <ErrorNotice error={reconcile.error} />
              <Button
                className="admin-small-button"
                variant="outline"
                disabled={reconcile.isPending}
                onClick={() => reconcile.mutate()}
              >
                Đối soát lại với VNPay
              </Button>
            </div>
          </details>
          {refund && (
            <ConfirmDialog
              open
              title="Xác nhận đã hoàn tiền thủ công"
              description="Chỉ xác nhận sau khi hoàn tiền thành công trên cổng VNPay. Thao tác này ghi nhận trạng thái, không chuyển tiền."
              requireReason={false}
              pending={review.isPending}
              error={review.error}
              onClose={() => setRefund(false)}
              onConfirm={() => review.mutate({ action: 'REFUND', reason: reason.trim() })}
            />
          )}
        </>
      )}
    </QueryState>
  )
}
