import type { Order } from '@/api/generated/model'
import { formatHm } from '@/lib/time'

export interface TimelineStep {
  key: string
  tone: 'done' | 'warn' | 'todo'
  time?: string
  label: string
}

/** Dòng thời gian suy ra từ các mốc có trong đơn (tạo, hết hạn giữ ghế, thanh toán). */
export function timeline(order: Order): TimelineStep[] {
  const seats = (order.items ?? []).reduce((n, i) => n + (i.quantity ?? 1), 0)
  const steps: TimelineStep[] = []
  if (order.created_at) {
    steps.push({
      key: 'created',
      tone: 'done',
      time: formatHm(order.created_at),
      label: `Tạo đơn · giữ ${seats} chỗ trong 10 phút`,
    })
  }
  if (order.status === 'PENDING' && order.expires_at) {
    steps.push({
      key: 'expires',
      tone: 'warn',
      time: formatHm(order.expires_at),
      label: 'Hết hạn giữ ghế nếu chưa thanh toán',
    })
  }
  if (order.status === 'EXPIRED' && order.expires_at) {
    steps.push({
      key: 'expired',
      tone: 'warn',
      time: formatHm(order.expires_at),
      label: 'Hết hạn giữ ghế, ghế đã được trả lại',
    })
  }
  if (order.status === 'CANCELLED') steps.push({ key: 'cancelled', tone: 'warn', label: 'Đơn đã được huỷ' })
  if (order.paid_at)
    steps.push({ key: 'paid', tone: 'done', time: formatHm(order.paid_at), label: 'Thanh toán thành công qua VNPay' })
  if (order.status === 'PAID') steps.push({ key: 'issued', tone: 'done', label: 'Đã phát hành vé điện tử' })
  if (order.status === 'PENDING')
    steps.push({ key: 'issue', tone: 'todo', label: 'Phát hành vé sau khi VNPay xác nhận' })
  if (order.status === 'NEEDS_REVIEW')
    steps.push({ key: 'review', tone: 'warn', label: 'Đang chờ đội vận hành kiểm tra' })
  return steps
}
