import type { Order } from '@/api/generated/model'
import { formatCountdown, remainingSeconds } from '@/lib/countdown'
import { formatDayMonthHm } from '@/lib/time'

export type NotificationTone = 'success' | 'warning' | 'danger' | 'neutral' | 'info'

export interface AppNotification {
  /** Ổn định theo (đơn, trạng thái) để nhớ đã đọc. */
  id: string
  tone: NotificationTone
  title: string
  hint: string
  at: string
  to: string
  action?: { label: string; to: string }
}

/** "Vừa xong", "5 phút", "3 giờ", "Hôm qua", hoặc "08/11" cho mốc xa hơn. */
export function relativeTime(iso: string, now: number): string {
  const min = Math.floor((now - new Date(iso).getTime()) / 60_000)
  if (min < 1) return 'Vừa xong'
  if (min < 60) return `${min} phút`
  if (min < 24 * 60) return `${Math.floor(min / 60)} giờ`
  if (min < 48 * 60) return 'Hôm qua'
  return formatDayMonthHm(iso).split(' ')[0]
}

const seatsOf = (o: Order) =>
  (o.items ?? [])
    .map((i) => (i.row && i.number != null ? `${i.row}-${i.number}` : null))
    .filter((v): v is string => !!v)
    .join(', ')

/** Thông báo suy ra từ trạng thái các đơn gần đây (chưa có API thông báo riêng). Mới nhất trước. */
export function buildNotifications(orders: Order[], now: number): AppNotification[] {
  const out: AppNotification[] = []
  for (const o of orders) {
    if (!o.id || !o.status) continue
    const qty = (o.items ?? []).reduce((n, i) => n + (i.quantity ?? 1), 0)
    const event = o.event?.title ?? 'sự kiện'
    const base = { id: `${o.id}:${o.status}`, to: `/orders/${o.id}` }
    switch (o.status) {
      case 'PAID':
        out.push({
          ...base,
          tone: 'success',
          title: `${qty} vé ${event} đã phát hành`,
          hint: `Mở vé để xem mã QR.${o.buyer?.email ? ` Đã gửi tới ${o.buyer.email}.` : ''}`,
          at: o.paid_at ?? o.created_at ?? '',
          to: '/tickets',
        })
        break
      case 'PENDING': {
        const left = o.expires_at ? remainingSeconds(o.expires_at, now) : 0
        if (left <= 0) break
        out.push({
          ...base,
          tone: 'warning',
          title: `Đơn #${o.code} sắp hết hạn giữ ghế`,
          hint: `Còn ${formatCountdown(left)} để thanh toán ${event}${seatsOf(o) ? ` · ${seatsOf(o)}` : ''}.`,
          at: o.created_at ?? '',
          action: { label: 'Thanh toán', to: `/orders/${o.id}/checkout` },
        })
        break
      }
      case 'EXPIRED':
        out.push({
          ...base,
          tone: 'neutral',
          title: `Đơn #${o.code} đã hết hạn`,
          hint: `Ghế ${event} đã được trả lại.`,
          at: o.expires_at ?? o.created_at ?? '',
        })
        break
      case 'NEEDS_REVIEW':
        out.push({
          ...base,
          tone: 'info',
          title: `Đơn #${o.code} đang được xem xét`,
          hint: 'Tiền về sau hạn giữ ghế, đội vận hành sẽ xử lý trong 24h.',
          at: o.created_at ?? '',
        })
        break
      default:
        break
    }
  }
  return out.filter((n) => n.at).sort((a, b) => b.at.localeCompare(a.at))
}
