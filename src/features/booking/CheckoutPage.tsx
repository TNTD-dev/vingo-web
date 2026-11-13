import { Placeholder } from '@/design/Placeholder'

// Thanh toán đơn đang giữ ghế + QR VNPay (Figma B4/B4b).
export default function CheckoutPage() {
  return <Placeholder title="Thanh toán" operations={['getOrder', 'createPayment', 'cancelOrder']} />
}
