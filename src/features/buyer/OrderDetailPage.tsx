import { useParams } from 'react-router'

import { useGetOrder } from '@/api/generated/endpoints/booking/booking'
import { QueryDump } from '@/design/QueryState'
import { Placeholder } from '@/design/Placeholder'

export default function OrderDetailPage() {
  const { orderId } = useParams()
  const query = useGetOrder(orderId ?? '')
  return (
    <Placeholder title="Chi tiết đơn" operations={['getOrder', 'cancelOrder', 'createPayment', 'getPayment']}>
      <QueryDump query={query} />
    </Placeholder>
  )
}
