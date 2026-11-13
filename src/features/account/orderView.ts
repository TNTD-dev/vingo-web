import type { Order } from '@/api/generated/model'
import type { BadgeTone } from '@/design/StatusBadge'

export const ORDER_STATUS: Record<NonNullable<Order['status']>, { label: string; tone: BadgeTone }> = {
  PAID: { label: 'PAID', tone: 'success' },
  PENDING: { label: 'PENDING', tone: 'warning' },
  EXPIRED: { label: 'EXPIRED', tone: 'neutral' },
  CANCELLED: { label: 'CANCELLED', tone: 'neutral' },
  NEEDS_REVIEW: { label: 'NEEDS REVIEW', tone: 'info' },
  REFUNDED: { label: 'REFUNDED', tone: 'neutral' },
}

/** Tổng số vé của đơn (ghế đơn = 1, khu đứng = quantity). */
export function ticketCount(order: Pick<Order, 'items'>): number {
  return (order.items ?? []).reduce((sum, i) => sum + (i.quantity ?? 1), 0)
}
