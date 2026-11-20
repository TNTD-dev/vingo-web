import type { AdminGetOrder200 } from '@/api/generated/model'
import { elapsedText, vnTime } from '@/design/admin/format'

export type TimelineNode = { at?: string; label: string; detail?: string; tone: 'done' | 'warn' | 'now' }

const minutes = (ms: number) => Math.floor(ms / 60_000)

/** Số phút tiền về trễ so với hạn giữ ghế; null nếu không tính được hoặc không trễ. */
export function lateMinutes(order: AdminGetOrder200): number | null {
  const paid = order.history?.find((h) => h.status === 'NEEDS_REVIEW')?.at
  if (!paid || !order.expires_at) return null
  const late = minutes(Date.parse(paid) - Date.parse(order.expires_at))
  return Number.isFinite(late) && late > 0 ? late : null
}

/**
 * Dựng các mốc diễn biến từ lịch sử trạng thái của đơn. Mốc "hết hạn giữ ghế" được thêm khi tiền về sau hạn
 * mà lịch sử chưa có. Đơn cần duyệt có mốc cuối "Hiện tại" cho biết đã chờ bao lâu.
 */
export function buildTimeline(order: AdminGetOrder200, now: Date): TimelineNode[] {
  const seats = order.items?.reduce((sum, v) => sum + (v.quantity ?? 1), 0) ?? 0
  const holdMinutes =
    order.created_at && order.expires_at ? minutes(Date.parse(order.expires_at) - Date.parse(order.created_at)) : null
  const late = lateMinutes(order)
  const nodes: TimelineNode[] = []
  for (const h of order.history ?? []) {
    switch (h.status) {
      case 'PENDING':
        nodes.push({
          at: h.at,
          label: 'Tạo đơn',
          detail: seats && holdMinutes ? `Giữ ${seats} chỗ trong ${holdMinutes} phút` : undefined,
          tone: 'done',
        })
        break
      case 'EXPIRED':
        nodes.push({ at: h.at, label: 'Hết hạn giữ ghế', tone: 'done' })
        break
      case 'NEEDS_REVIEW':
        nodes.push({
          at: h.at,
          label: order.review_reason === 'AMOUNT_MISMATCH' ? 'VNPay báo đã trả khác số tiền' : 'VNPay báo đã trả',
          detail: late ? `Trễ ${late} phút so với hạn` : undefined,
          tone: 'warn',
        })
        break
      case 'PAID':
        nodes.push({ at: h.at, label: 'Đã thanh toán', tone: 'done' })
        break
      case 'CANCELLED':
        nodes.push({ at: h.at, label: 'Đơn bị huỷ', tone: 'done' })
        break
      case 'REJECTED':
        nodes.push({ at: h.at, label: 'Ghi nhận hoàn tiền thủ công', tone: 'done' })
        break
    }
  }
  const hasExpiry = nodes.some((n) => n.label === 'Hết hạn giữ ghế')
  if (late && !hasExpiry && order.expires_at) {
    const at = order.expires_at,
      i = nodes.findIndex((n) => n.tone === 'warn')
    nodes.splice(i < 0 ? nodes.length : i, 0, {
      at,
      label: 'Hết hạn giữ ghế',
      detail: 'Chưa thấy thanh toán',
      tone: 'done',
    })
  }
  nodes.sort((a, b) => Date.parse(a.at ?? '') - Date.parse(b.at ?? ''))
  if (order.status === 'NEEDS_REVIEW') {
    const since = order.history?.find((h) => h.status === 'NEEDS_REVIEW')?.at ?? order.created_at
    nodes.push({
      label: 'Chờ bạn quyết định',
      detail: since ? `Đã ${elapsedText(since, now)}` : undefined,
      tone: 'now',
    })
  }
  return nodes
}

export function nodeTime(node: TimelineNode): string {
  return node.at ? vnTime(node.at) : 'HIỆN TẠI'
}
