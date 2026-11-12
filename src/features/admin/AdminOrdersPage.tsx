import { useAdminListOrders } from '@/api/generated/endpoints/admin-operations/admin-operations'
import { QueryDump } from '@/design/QueryState'
import { Placeholder } from '@/design/Placeholder'

export default function AdminOrdersPage() {
  const query = useAdminListOrders()
  return (
    <Placeholder title="Đơn hàng" operations={['adminListOrders']}>
      <QueryDump query={query} />
    </Placeholder>
  )
}
