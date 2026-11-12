import { useParams } from 'react-router'

import { useAdminGetOrder } from '@/api/generated/endpoints/admin-operations/admin-operations'
import { QueryDump } from '@/design/QueryState'
import { Placeholder } from '@/design/Placeholder'

export default function AdminOrderDetailPage() {
  const { orderId } = useParams()
  const query = useAdminGetOrder(orderId ?? '')
  return (
    <Placeholder title="Chi tiết đơn (admin)" operations={['adminGetOrder', 'resolveReview', 'reconcileOrder']}>
      <QueryDump query={query} />
    </Placeholder>
  )
}
