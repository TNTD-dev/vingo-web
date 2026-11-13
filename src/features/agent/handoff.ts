/**
 * Đầu vào của Agent mode ngoài hộp chat:
 * - `?q=<câu hỏi>` từ Landing (xem features/landing/agentLink.ts): gửi làm tin nhắn đầu.
 * - `location.state.context` từ trang chọn ghế (Figma M1b): Vingo nhận suất, khu, ghế đã chọn.
 *   Trang chọn ghế gọi: navigate('/vingo', { state: { context: { eventTitle, showtimeLabel, zone, seats } } }).
 */
export type AgentContext = {
  eventTitle: string
  showtimeLabel?: string
  zone?: string
  seats: string[]
}

const MAX_QUERY_LENGTH = 500

/** Đọc `q` từ query string; rỗng hoặc toàn khoảng trắng → undefined. */
export function readInitialQuestion(search: string): string | undefined {
  const q = new URLSearchParams(search).get('q')?.trim().slice(0, MAX_QUERY_LENGTH)
  return q ? q : undefined
}

export function readContext(state: unknown): AgentContext | undefined {
  if (typeof state !== 'object' || state === null) return undefined
  const c = (state as { context?: unknown }).context
  if (typeof c !== 'object' || c === null) return undefined
  const r = c as Record<string, unknown>
  if (typeof r.eventTitle !== 'string' || r.eventTitle === '') return undefined
  return {
    eventTitle: r.eventTitle,
    showtimeLabel: typeof r.showtimeLabel === 'string' ? r.showtimeLabel : undefined,
    zone: typeof r.zone === 'string' ? r.zone : undefined,
    seats: Array.isArray(r.seats) ? r.seats.filter((s): s is string => typeof s === 'string') : [],
  }
}

/** Chip trên đầu hội thoại: "Từ trang Chọn ghế · HAGL vs Hà Nội · khu B · 2 ghế đã chọn". */
export function contextLabel(c: AgentContext): string {
  const parts = ['Từ trang Chọn ghế', c.eventTitle]
  if (c.zone) parts.push(`khu ${c.zone}`)
  if (c.seats.length) parts.push(`${c.seats.length} ghế đã chọn`)
  return parts.join(' · ')
}

/** Câu gửi cho agent để nó nắm ngữ cảnh. Chỉ chứa thông tin hiển thị, không có id hay token. */
export function contextMessage(c: AgentContext): string {
  const seats = c.seats.length ? `, đã chọn ghế ${c.seats.join(', ')}` : ''
  const zone = c.zone ? ` khu ${c.zone}` : ''
  const when = c.showtimeLabel ? ` (${c.showtimeLabel})` : ''
  return `Mình đang ở trang chọn ghế ${c.eventTitle}${when},${zone}${seats}. Giúp mình nhé.`
}
