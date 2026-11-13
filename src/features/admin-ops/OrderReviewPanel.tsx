import { useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
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
import { Button } from '@/design/ui/button'
import { formatVnd } from '@/lib/money'
import { toast } from 'sonner'
export default function OrderReviewPanel({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const query = useAdminGetOrder(orderId),
    client = useQueryClient(),
    route = useParams(),
    navigate = useNavigate(),
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
    payment = order?.payments?.at(-1)
  return (
    <Panel className="admin-review-panel">
      <button
        className="admin-dialog-close"
        aria-label="Đóng chi tiết đơn"
        onClick={() => (route.orderId ? navigate('/admin/orders') : onClose())}
      >
        ×
      </button>
      <QueryState query={query}>
        <p className="admin-caption">// ĐƠN #{order?.code}</p>
        <h2 className="mb-5">{order?.status === 'NEEDS_REVIEW' ? 'Xử lý đơn cần duyệt' : 'Chi tiết đơn hàng'}</h2>
        {order?.status === 'NEEDS_REVIEW' ? (
          <p className="admin-review-warning">
            △{' '}
            {order.review_reason === 'AMOUNT_MISMATCH'
              ? 'Số tiền thanh toán không khớp.'
              : order.review_reason === 'PAID_AFTER_CANCEL'
                ? 'Thanh toán đến sau khi đơn đã hủy.'
                : 'Thanh toán đến sau khi hết hạn giữ chỗ.'}{' '}
            Kiểm tra thanh toán và tình trạng ghế trước khi phát hành.
          </p>
        ) : (
          <StateBadge value={order?.status} />
        )}
        <dl className="admin-review-facts">
          <div>
            <dt>Số tiền đơn</dt>
            <dd>{formatVnd(order?.total_amount ?? 0)}</dd>
          </div>
          <div>
            <dt>Số tiền thanh toán</dt>
            <dd>{payment ? formatVnd(payment.amount ?? 0) : '—'}</dd>
          </div>
          <div>
            <dt>vnp_TxnRef</dt>
            <dd className="font-mono">{payment?.txn_ref ?? '—'}</dd>
          </div>
          <div>
            <dt>vnp_ResponseCode</dt>
            <dd className="font-mono">{payment?.last_response_code ?? '—'}</dd>
          </div>
        </dl>
        <p className="admin-caption mb-3">Dòng thời gian</p>
        <ol className="admin-order-timeline">
          {order?.history?.map((h, i) => (
            <li key={i}>
              <i />
              <time>{dateText(h.at)}</time>
              <span>{h.status}</span>
            </li>
          ))}
        </ol>
        {order?.status === 'NEEDS_REVIEW' && (
          <form
            className="mt-5 space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              review.mutate({ action: 'ISSUE_TICKETS', reason: reason.trim() })
            }}
          >
            <Field label="Ghi chú xử lý">
              <textarea
                required
                minLength={3}
                maxLength={1000}
                placeholder="Nhập lý do xử lý đơn…"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </Field>
            <ErrorNotice error={review.error} />
            <AdminAction className="w-full justify-start" disabled={review.isPending || reason.trim().length < 3}>
              Phát hành vé (ISSUE_TICKETS)
            </AdminAction>
            <AdminAction
              secondary
              type="button"
              className="w-full justify-start"
              disabled={review.isPending || reason.trim().length < 3}
              onClick={() => setRefund(true)}
            >
              Đánh dấu đã hoàn tiền thủ công
            </AdminAction>
            <p className="text-xs leading-relaxed text-ink-tertiary">
              Hoàn tiền thực hiện thủ công trên cổng VNPay; hệ thống chỉ ghi nhận trạng thái REFUNDED.
            </p>
          </form>
        )}
        <details className="mt-5 text-xs">
          <summary className="cursor-pointer text-ink-secondary">Người mua, vé & đối soát</summary>
          <div className="mt-4 space-y-3">
            <p>
              {order?.buyer?.full_name} · {order?.buyer?.email}
            </p>
            <p>
              {order?.event?.title} · {dateText(order?.showtime?.starts_at)}
            </p>
            {order?.items?.map((v, i) => (
              <p key={i}>
                {v.zone} · {v.row ? `${v.row}-${v.number}` : 'Khu đứng'} · {v.quantity} vé ·{' '}
                {formatVnd(v.unit_price ?? 0)}
              </p>
            ))}
            <Link to={`/admin/tickets?order_id=${orderId}`} className="block underline">
              Xem vé của đơn
            </Link>
            <Link to={`/admin/audit-logs?entity=order&entity_id=${orderId}`} className="block underline">
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
      </QueryState>
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
    </Panel>
  )
}
