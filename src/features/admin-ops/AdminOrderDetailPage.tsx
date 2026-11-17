import { Link, useParams } from 'react-router'
import { ArrowLeft } from 'lucide-react'
import { useAdminGetOrder } from '@/api/generated/endpoints/admin-operations/admin-operations'
import { AdminPage } from '@/design/admin/AdminUi'
import OrderReviewPanel from './OrderReviewPanel'

/** Trang riêng cho một đơn, dùng hết chiều ngang (không phải ngăn kéo hẹp). */
export default function AdminOrderDetailPage() {
  const { orderId = '' } = useParams(),
    order = useAdminGetOrder(orderId, { query: { enabled: !!orderId } })
  return (
    <AdminPage
      title={order.data?.code ? `Đơn ${order.data.code}` : 'Chi tiết đơn'}
      caption={
        <Link to="/admin/orders" className="admin-backlink">
          <ArrowLeft size={14} strokeWidth={2} aria-hidden />
          Đơn hàng
        </Link>
      }
    >
      {orderId && <OrderReviewPanel orderId={orderId} />}
      <div className="admin-page-end" aria-hidden />
    </AdminPage>
  )
}
