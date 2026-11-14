import type { Order } from '@/api/generated/model'
import type { BadgeTone } from '@/design/StatusBadge'

export const ORDER_STATUS: Record<NonNullable<Order['status']>, { label: string; tone: BadgeTone }> = {
  PAID: { label: 'Đã thanh toán', tone: 'success' },
  PENDING: { label: 'Chờ thanh toán', tone: 'warning' },
  EXPIRED: { label: 'Hết hạn', tone: 'neutral' },
  CANCELLED: { label: 'Đã huỷ', tone: 'neutral' },
  NEEDS_REVIEW: { label: 'Đang xem xét', tone: 'info' },
  REFUNDED: { label: 'Đã hoàn tiền', tone: 'neutral' },
}

/** Tổng số vé của đơn (ghế đơn = 1, khu đứng = quantity). */
export function ticketCount(order: Pick<Order, 'items'>): number {
  return (order.items ?? []).reduce((sum, i) => sum + (i.quantity ?? 1), 0)
}
