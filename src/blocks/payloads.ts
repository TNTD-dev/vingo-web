import type { ChatBlock } from '@/api/generated/model'

/**
 * Contract chỉ khai `payload: object` cho mọi block, nên phía web tự định nghĩa dạng payload mong đợi ở đây
 * và đọc rất lỏng (thiếu trường → bỏ qua, không văng lỗi). Khi backend chốt schema thì sửa file này.
 * Danh sách chỗ thiếu: xem docs/agent-mode-notes.md.
 */

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: unknown): string | undefined => (typeof v === 'string' && v !== '' ? v : undefined)
const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined)
const strList = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])
const recList = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? v.filter(isRecord) : [])

export type Tone = 'success' | 'warning' | 'info' | 'neutral'
const tone = (v: unknown): Tone => (v === 'success' || v === 'warning' || v === 'info' ? v : 'neutral')

function root(block: ChatBlock): Record<string, unknown> {
  return isRecord(block.payload) ? block.payload : {}
}

// ---------------------------------------------------------------- EventList
export type EventRow = {
  eventId?: string
  showtimeId?: string
  title: string
  subtitle?: string
  imageUrl?: string
  badge?: { label: string; tone: Tone }
  priceLine?: string
  /** Dòng được Vingo gợi ý: viền đậm, nút "Chọn trận này". */
  recommended: boolean
  /** Dòng không chọn được (đã đóng bán): chỉ có nút "Xem". */
  selectable: boolean
}
export type EventListPayload = { events: EventRow[] }

export function parseEventList(block: ChatBlock): EventListPayload {
  const events = recList(root(block).events).map((e): EventRow => {
    const badge =
      isRecord(e.badge) && str(e.badge.label) ? { label: str(e.badge.label)!, tone: tone(e.badge.tone) } : undefined
    return {
      eventId: str(e.event_id),
      showtimeId: str(e.showtime_id),
      title: str(e.title) ?? 'Sự kiện',
      subtitle: str(e.subtitle),
      imageUrl: str(e.image_url),
      badge,
      priceLine: str(e.price_line),
      recommended: e.recommended === true,
      selectable: e.selectable !== false,
    }
  })
  return { events }
}

// ---------------------------------------------------------------- SeatMap
export type SeatState = 'available' | 'held' | 'sold'
export type SeatCell = { id: string; label: string; state: SeatState; suggested: boolean }
export type SeatMapPayload = {
  zoneLabel: string
  rowLabel?: string
  priceLabel?: string
  venueName?: string
  remainingLabel?: string
  fullMapUrl?: string
  rows: SeatCell[][]
  /** Ghế đang chọn (id). Ghế Vingo đề xuất có `suggested`. */
  selected: string[]
  hint?: string
}

export function parseSeatMap(block: ChatBlock): SeatMapPayload {
  const p = root(block)
  const suggestedIds = new Set(strList(p.suggested))
  const rows = (Array.isArray(p.rows) ? p.rows : []).map((row) =>
    recList(row).map((s): SeatCell => {
      const id = str(s.id) ?? str(s.label) ?? ''
      const state = s.state === 'held' || s.state === 'sold' ? s.state : 'available'
      return { id, label: str(s.label) ?? id, state, suggested: suggestedIds.has(id) }
    }),
  )
  return {
    zoneLabel: str(p.zone_label) ?? str(p.zone) ?? 'Khu ghế',
    rowLabel: str(p.row_label),
    priceLabel: str(p.price_label),
    venueName: str(p.venue_name),
    remainingLabel: str(p.remaining_label),
    fullMapUrl: str(p.full_map_url),
    rows,
    selected: strList(p.selected).length ? strList(p.selected) : [...suggestedIds],
    hint: str(p.hint),
  }
}

// ---------------------------------------------------------------- ConfirmAction
export type ConfirmRow = { label: string; value: string; strong: boolean }
export type ConfirmPayload = {
  actionId?: string
  /** Thao tác agent đề xuất, vd CREATE_HOLD. */
  kind?: string
  title: string
  rows: ConfirmRow[]
  confirmLabel: string
  rejectLabel: string
  /** Đơn mà thao tác này tác động tới (để panel "Đơn đang làm" cập nhật). */
  order?: OrderSummaryPayload
}

export function parseConfirmAction(block: ChatBlock): ConfirmPayload {
  const p = root(block)
  return {
    actionId: str(p.action_id),
    kind: str(p.kind),
    title: str(p.title) ?? 'Cần bạn xác nhận',
    rows: recList(p.rows).flatMap((r) => {
      const label = str(r.label)
      const value = str(r.value)
      return label && value ? [{ label, value, strong: r.strong === true }] : []
    }),
    confirmLabel: str(p.confirm_label) ?? 'Đồng ý',
    rejectLabel: str(p.reject_label) ?? 'Từ chối',
    order: isRecord(p.order) ? parseOrderSummary({ payload: p.order }) : undefined,
  }
}

// ---------------------------------------------------------------- PaymentQR
export type PaymentQrPayload = {
  orderId?: string
  orderCode?: string
  /** Số tiền do backend trả; không tự cộng ở client. */
  totalAmount?: number
  /** Hạn thanh toán, ISO UTC. */
  expiresAt?: string
  paymentUrl?: string
  status: 'PENDING' | 'PAID' | 'EXPIRED' | 'FAILED'
}

export function parsePaymentQr(block: ChatBlock): PaymentQrPayload {
  const p = root(block)
  const s = str(p.status)
  return {
    orderId: str(p.order_id),
    orderCode: str(p.order_code),
    totalAmount: num(p.total_amount),
    expiresAt: str(p.expires_at),
    paymentUrl: str(p.payment_url),
    status: s === 'PAID' || s === 'EXPIRED' || s === 'FAILED' ? s : 'PENDING',
  }
}

// ---------------------------------------------------------------- Ticket
export type TicketPayload = {
  ticketCode?: string
  orderCode?: string
  eventTitle: string
  dateLabel?: string
  timeLabel?: string
  zone?: string
  seat?: string
  qrImage?: string
  emailMasked?: string
  status: 'ISSUED' | 'USED' | 'VOID'
}

export function parseTicket(block: ChatBlock): TicketPayload {
  const p = root(block)
  const s = str(p.status)
  return {
    ticketCode: str(p.ticket_code),
    orderCode: str(p.order_code),
    eventTitle: str(p.event_title) ?? 'Vé điện tử',
    dateLabel: str(p.date_label),
    timeLabel: str(p.time_label),
    zone: str(p.zone),
    seat: str(p.seat),
    qrImage: str(p.qr_image),
    emailMasked: str(p.email_masked),
    status: s === 'USED' || s === 'VOID' ? s : 'ISSUED',
  }
}

// ---------------------------------------------------------------- OrderSummary
export type OrderSummaryPayload = {
  orderId?: string
  orderCode?: string
  eventTitle?: string
  subtitle?: string
  imageUrl?: string
  zone?: string
  seats: string[]
  totalAmount?: number
  status: 'DRAFT' | 'AWAITING' | 'PENDING' | 'PAID' | 'EXPIRED'
  expiresAt?: string
  /** Đường dẫn nội bộ tới sơ đồ đầy đủ (trang Tự đặt), vd /events/…/seats. */
  fullMapUrl?: string
}

export function parseOrderSummary(block: ChatBlock): OrderSummaryPayload {
  const p = root(block)
  const s = str(p.status)
  const known = ['AWAITING', 'PENDING', 'PAID', 'EXPIRED'] as const
  return {
    orderId: str(p.order_id),
    orderCode: str(p.order_code),
    eventTitle: str(p.event_title),
    subtitle: str(p.subtitle),
    imageUrl: str(p.image_url),
    zone: str(p.zone),
    seats: strList(p.seats),
    totalAmount: num(p.total_amount),
    status: known.find((k) => k === s) ?? 'DRAFT',
    expiresAt: str(p.expires_at),
    fullMapUrl: str(p.full_map_url),
  }
}
