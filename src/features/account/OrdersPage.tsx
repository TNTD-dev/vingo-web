import { useListMyOrders } from '@/api/generated/endpoints/booking/booking'
import { QueryDump } from '@/design/QueryState'
import { Placeholder } from '@/design/Placeholder'

export default function OrdersPage() {
  const query = useListMyOrders()
  return (
    <Placeholder title="Đơn của tôi" operations={['listMyOrders']}>
      <QueryDump query={query} />
    </Placeholder>
  )
}
