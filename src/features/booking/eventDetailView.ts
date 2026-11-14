import type { EventDetail, Showtime, ShowtimeStatus } from '@/api/generated/model'
import type { BadgeTone } from '@/design/StatusBadge'

/** Từ ngưỡng này trở xuống badge hạng vé chuyển sang cảnh báo "sắp hết". */
export const LOW_SEATS = 30

export type SeatBadge = { tone: BadgeTone; label: string }

/** Badge "CÒN 18" / "HẾT VÉ" của một hạng vé (Figma B2 › Hạng vé & khu). */
export function seatBadge(seatsLeft: number): SeatBadge {
  if (seatsLeft <= 0) return { tone: 'danger', label: 'HẾT VÉ' }
  return { tone: seatsLeft <= LOW_SEATS ? 'warning' : 'success', label: `CÒN ${seatsLeft}` }
}

const STATUS_RANK: Partial<Record<ShowtimeStatus, number>> = { ON_SALE: 0, SCHEDULED: 1, SALES_CLOSED: 2, FINISHED: 3 }

/** Đang bán trước, rồi sắp mở bán, đã đóng, đã diễn ra; cùng trạng thái thì suất sớm trước. Huỷ/nháp không hiển thị. */
export function sortShowtimes(showtimes: Showtime[]): Showtime[] {
  return showtimes
    .filter((s) => s.status !== undefined && STATUS_RANK[s.status] !== undefined)
    .sort(
      (a, b) =>
        (STATUS_RANK[a.status!] ?? 9) - (STATUS_RANK[b.status!] ?? 9) ||
        (a.starts_at ?? '').localeCompare(b.starts_at ?? ''),
    )
}

/** Chỉ suất đang bán và chưa hết vé mới chọn được. */
export function isSelectable(s: Showtime): boolean {
  return s.status === 'ON_SALE' && !s.sold_out
}

export const SHOWTIME_STATUS: Record<string, { tone: BadgeTone; label: string }> = {
  ON_SALE: { tone: 'success', label: 'ON SALE' },
  SCHEDULED: { tone: 'info', label: 'SCHEDULED' },
  SALES_CLOSED: { tone: 'neutral', label: 'SALES CLOSED' },
  FINISHED: { tone: 'neutral', label: 'FINISHED' },
}

/** Giá thấp nhất trong bảng giá; không có hạng vé thì undefined. */
export function minPrice(event: EventDetail): number | undefined {
  const prices = (event.price_tiers ?? []).map((t) => t.price)
  return prices.length ? Math.min(...prices) : undefined
}

/**
 * Tiêu đề lớn và dòng phụ của banner. Bóng đá có đủ đội nhà/khách thì tách "HAGL vs Hà Nội FC"
 * và dòng "V.League 2026 · Vòng 12" (Figma); còn lại dùng nguyên tên sự kiện.
 */
export function bannerText(event: EventDetail): { title: string; subtitle?: string } {
  const a = event.attributes ?? {}
  const str = (k: string) => (typeof a[k] === 'string' && a[k] ? (a[k] as string) : undefined)
  const home = str('home_team')
  const away = str('away_team')
  if (event.category === 'FOOTBALL' && home && away) {
    return {
      title: `${home} vs ${away}`,
      subtitle: [str('league'), str('round')].filter(Boolean).join(' · ') || undefined,
    }
  }
  return { title: event.title ?? '' }
}
