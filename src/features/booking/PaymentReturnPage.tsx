import { Placeholder } from '@/design/Placeholder'

export default function PaymentReturnPage() {
  return (
    <Placeholder title="Kết quả thanh toán" operations={['handleVnpayReturn', 'getOrder']}>
      Chỉ hiển thị. Trạng thái đơn chỉ đổi qua IPN/querydr — trang này đợi sự kiện order.paid trên /me/stream.
    </Placeholder>
  )
}
