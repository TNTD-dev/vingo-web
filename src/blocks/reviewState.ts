import type { ReviewAction, ReviewOrder } from './adminPayloads'

/** Trạng thái một dòng trong bảng duyệt hàng loạt: chọn hay không, và cách xử lý. */
export type ReviewRow = { orderId: string; selected: boolean; action: ReviewAction }

export const initialRows = (orders: ReviewOrder[]): ReviewRow[] =>
  orders.map((o) => ({ orderId: o.orderId, selected: o.selected, action: o.action }))

/** Bỏ chọn / chọn lại một đơn. Đơn đang "để sau" mà được chọn thì chuyển sang phát hành vé. */
export function toggleRow(rows: ReviewRow[], orderId: string): ReviewRow[] {
  return rows.map((r) => {
    if (r.orderId !== orderId) return r
    const selected = !r.selected
    return { ...r, selected, action: selected ? 'ISSUE_TICKETS' : r.action }
  })
}

/** Đổi đề xuất của một đơn. "Để sau" tự bỏ chọn, vì không có gì để duyệt cho đơn đó. */
export function setRowAction(rows: ReviewRow[], orderId: string, action: ReviewAction): ReviewRow[] {
  return rows.map((r) =>
    r.orderId === orderId ? { ...r, action, selected: action === 'ISSUE_TICKETS' && r.selected } : r,
  )
}

/** Các đơn sẽ chạy khi duyệt: phải được chọn và đang ở "phát hành vé". */
export function decisions(rows: ReviewRow[]): { order_id: string; action: 'ISSUE_TICKETS' }[] {
  return rows
    .filter((r) => r.selected && r.action === 'ISSUE_TICKETS')
    .map((r) => ({ order_id: r.orderId, action: 'ISSUE_TICKETS' }))
}

export function summarize(rows: ReviewRow[], orders: ReviewOrder[]) {
  const picked = new Set(decisions(rows).map((d) => d.order_id))
  const tickets = orders.filter((o) => picked.has(o.orderId)).reduce((sum, o) => sum + (o.tickets ?? 0), 0)
  return { count: picked.size, total: rows.length, skipped: rows.length - picked.size, tickets }
}

export function isChanged(initial: ReviewRow[], current: ReviewRow[]): boolean {
  return current.some((r, i) => r.selected !== initial[i]?.selected || r.action !== initial[i]?.action)
}
