import type { EventDetail, SeatLayoutOverview, Showtime } from '@/api/generated/model'
import type { CheckStatus } from '@/design/admin/wizard'

/** Giờ bán/giờ diễn dạng `YYYY-MM-DDTHH:mm` theo giờ Việt Nam (đầu vào datetime-local). */
export type SaleWindow = { starts_at: string; ends_at: string; sale_opens_at: string; sale_closes_at: string }

export type SaleIssue = 'MISSING' | 'END_BEFORE_START' | 'SALE_ORDER' | 'SALE_AFTER_START'
export const saleIssueText: Record<SaleIssue, string> = {
  MISSING: 'Chọn đủ ngày, giờ diễn và giờ bán.',
  END_BEFORE_START: 'Giờ kết thúc phải sau giờ bắt đầu.',
  SALE_ORDER: 'Mở bán phải trước đóng bán.',
  SALE_AFTER_START: 'Đóng bán không được sau giờ bắt đầu diễn.',
}

/** Kiểm tra giờ bán theo đúng quy tắc backend: mở < đóng ≤ bắt đầu < kết thúc. Chuỗi cùng định dạng nên so sánh được. */
export function validateSaleWindow(w: SaleWindow): SaleIssue[] {
  if (!w.starts_at || !w.ends_at || !w.sale_opens_at || !w.sale_closes_at) return ['MISSING']
  const issues: SaleIssue[] = []
  if (w.starts_at >= w.ends_at) issues.push('END_BEFORE_START')
  if (w.sale_opens_at >= w.sale_closes_at) issues.push('SALE_ORDER')
  if (w.sale_closes_at > w.starts_at) issues.push('SALE_AFTER_START')
  return issues
}

export type SalePreset = 'NOW_TO_START' | 'TO_START' | 'BEFORE_2H'
const pad = (n: number) => String(n).padStart(2, '0')
/** Cộng phút vào chuỗi `YYYY-MM-DDTHH:mm` (không phụ thuộc múi giờ máy). */
export function addMinutes(local: string, minutes: number): string {
  if (!local) return ''
  const d = new Date(`${local}:00Z`)
  d.setUTCMinutes(d.getUTCMinutes() + minutes)
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
}
/**
 * Mốc “mở bán ngay khi công bố”: giờ tròn kế tiếp sau ít nhất 30 phút. Không dùng đúng giờ hiện tại vì backend khóa
 * giá khi suất đã tới giờ mở bán, mà admin còn phải gán giá ở bước sau.
 */
export function nextOpenSlot(now: string): string {
  const later = addMinutes(now, 90)
  return `${later.slice(0, 13)}:00`
}
/** Gợi ý giờ mở/đóng bán từ giờ diễn. `now` là giờ Việt Nam hiện tại cùng định dạng. */
export function presetSale(
  preset: SalePreset,
  startsAt: string,
  now: string,
  current: { open: string; close: string },
) {
  if (!startsAt) return current
  if (preset === 'NOW_TO_START') return { open: now, close: startsAt }
  if (preset === 'TO_START') return { open: current.open, close: startsAt }
  return { open: current.open, close: addMinutes(startsAt, -120) }
}

/** Hiển thị tiền rút gọn cho ước tính doanh thu: 4,28 tỷ ₫ / 402 tr ₫. */
export function formatVndShort(value: number): string {
  if (value >= 1e9) return `${(value / 1e9).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} tỷ ₫`
  if (value >= 1e6) return `${Math.round(value / 1e6).toLocaleString('vi-VN')} tr ₫`
  return `${value.toLocaleString('vi-VN')} ₫`
}

export type Check = { id: string; status: CheckStatus; title: string; hint: string; step?: number; blocking: boolean }

export type EventReadinessInput = {
  event: EventDetail
  /** Trạng thái sơ đồ theo id; thiếu = chưa tải xong. */
  layouts: Record<string, Pick<SeatLayoutOverview, 'status' | 'name' | 'version' | 'seat_count' | 'zones'>>
  /** Gán hạng theo khu; `null` = không đọc được (sự kiện nháp mở lại trên máy khác). */
  assignments: Record<string, string> | null
}

const active = (s: Showtime) => s.status !== 'CANCELLED'
const local = (iso?: string) => (iso ? new Date(Date.parse(iso) + 7 * 3600000).toISOString().slice(0, 16) : '')
export function showtimeIssues(s: Showtime): SaleIssue[] {
  return validateSaleWindow({
    starts_at: local(s.starts_at),
    ends_at: local(s.ends_at),
    sale_opens_at: local(s.sale_opens_at),
    sale_closes_at: local(s.sale_closes_at),
  })
}

/** Checklist “sẵn sàng công bố” tính ở client từ dữ liệu sự kiện, sơ đồ và gán giá. Backend vẫn kiểm tra lại khi publish. */
export function eventChecklist({ event, layouts, assignments }: EventReadinessInput): Check[] {
  const shows = event.showtimes?.filter(active) ?? []
  const badShows = shows.filter((s) => showtimeIssues(s).length)
  const layoutIds = [...new Set(shows.flatMap((s) => (s.seat_layout_id ? [s.seat_layout_id] : [])))]
  const known = layoutIds.filter((id) => layouts[id])
  const unpublished = known.filter((id) => layouts[id].status !== 'PUBLISHED')
  const zones = known.flatMap((id) => layouts[id].zones ?? [])
  const zoneIds = [...new Set(zones.map((z) => z.id))]
  const tierIds = new Set(event.price_tiers?.map((t) => t.id))
  const priced = assignments ? zoneIds.filter((id) => tierIds.has(assignments[id])).length : null
  const seats = known.reduce((sum, id) => sum + (layouts[id].seat_count ?? 0), 0)
  const first = layouts[layoutIds[0]]

  const info: Check = {
    id: 'info',
    status: event.title?.trim() && event.category ? 'ok' : 'todo',
    title: 'Thông tin chung',
    hint: 'Tên, thể loại, giới hạn vé',
    step: 1,
    blocking: true,
  }
  const showtimes: Check = {
    id: 'showtimes',
    status: shows.length && !badShows.length ? 'ok' : 'todo',
    title: 'Có ít nhất 1 suất diễn',
    hint: !shows.length
      ? 'Chưa có suất diễn nào'
      : badShows.length
        ? `${badShows.length} suất có giờ bán chưa hợp lệ`
        : `${shows.length} suất · giờ bán hợp lệ`,
    step: 2,
    blocking: true,
  }
  const layout: Check = {
    id: 'layout',
    status: !layoutIds.length ? 'todo' : unpublished.length ? 'todo' : known.length < layoutIds.length ? 'warn' : 'ok',
    title: 'Sơ đồ ghế đã phát hành',
    hint: !layoutIds.length
      ? 'Suất diễn cần gắn một sơ đồ đã phát hành'
      : unpublished.length
        ? `${unpublished.length} sơ đồ còn là bản nháp`
        : first
          ? `${first.name} · v${first.version} · ${seats.toLocaleString('vi-VN')} ghế`
          : 'Đang kiểm tra sơ đồ…',
    step: 2,
    blocking: true,
  }
  const prices: Check = {
    id: 'prices',
    status:
      !zoneIds.length || !event.price_tiers?.length
        ? 'todo'
        : priced === null
          ? 'warn'
          : priced === zoneIds.length
            ? 'ok'
            : 'todo',
    title: 'Mọi khu đều có giá',
    hint: !event.price_tiers?.length
      ? 'Chưa có hạng giá'
      : !zoneIds.length
        ? 'Cần suất diễn có sơ đồ để gán giá'
        : priced === null
          ? 'Chưa xác nhận trên máy này. Mở bước 3 và lưu lại để chắc chắn'
          : `${priced}/${zoneIds.length} khu · ${event.price_tiers.length} hạng giá`,
    step: 3,
    blocking: true,
  }
  const portrait: Check = {
    id: 'poster-portrait',
    status: event.poster_mobile_url ? 'ok' : 'warn',
    title: event.poster_mobile_url ? 'Poster dọc' : 'Chưa có poster dọc',
    hint: 'Hiển thị trên app và trang chủ. Không bắt buộc',
    step: 1,
    blocking: false,
  }
  const landscape: Check = {
    id: 'poster-landscape',
    status: event.poster_desktop_url ? 'ok' : 'warn',
    title: event.poster_desktop_url ? 'Poster ngang' : 'Chưa có poster ngang',
    hint: event.poster_desktop_url ? 'Dùng làm nền trang chi tiết' : 'Không bắt buộc, web dùng poster dọc làm nền',
    step: 1,
    blocking: false,
  }
  return [info, showtimes, layout, prices, portrait, landscape]
}

/** Số mục đạt trên tổng, và có thể công bố hay chưa (mọi mục bắt buộc phải `ok`, riêng giá chưa xác nhận thì để backend quyết). */
export function readinessSummary(checks: Check[]) {
  const ok = checks.filter((c) => c.status === 'ok').length
  const blocked = checks.some((c) => c.blocking && c.status === 'todo')
  return { ok, total: checks.length, canPublish: !blocked }
}

export type VenueLayoutInfo = { status?: string; seat_count?: number; zone_count?: number; version?: number }
export type VenueState = 'READY' | 'DRAFT_ONLY' | 'NO_LAYOUT'
/** Sân dùng được cho suất diễn khi có ít nhất một hall với sơ đồ đã phát hành. */
export function venueState(layoutsByHall: VenueLayoutInfo[][]): VenueState {
  const all = layoutsByHall.flat()
  if (all.some((l) => l.status === 'PUBLISHED')) return 'READY'
  return all.length ? 'DRAFT_ONLY' : 'NO_LAYOUT'
}
export function latestPublished<T extends VenueLayoutInfo>(layouts: T[]): T | undefined {
  return layouts.filter((l) => l.status === 'PUBLISHED').sort((a, b) => (b.version ?? 0) - (a.version ?? 0))[0]
}

/** Phát hiện sự kiện có thể trùng: cùng tên (bỏ khoảng trắng, không phân biệt hoa thường) và cùng thể loại. */
export function duplicateIds<T extends { id: string; title: string; category: string }>(events: T[]): Set<string> {
  const groups = new Map<string, string[]>()
  for (const e of events) {
    const key = `${e.category}|${e.title.trim().replace(/\s+/g, ' ').toLowerCase()}`
    groups.set(key, [...(groups.get(key) ?? []), e.id])
  }
  return new Set([...groups.values()].filter((g) => g.length > 1).flat())
}

/** Trạng thái bán của một sự kiện đã công bố, suy ra từ giờ mở/đóng bán của các suất chưa hủy. */
export type SaleState = 'ON_SALE' | 'UPCOMING' | 'CLOSED' | 'NONE'
export function saleState(shows: Showtime[] | undefined, now: number): SaleState {
  const list = (shows ?? []).filter(active).filter((s) => s.status !== 'DRAFT')
  if (!list.length) return 'NONE'
  const open = (s: Showtime) =>
    s.sale_opens_at && s.sale_closes_at && Date.parse(s.sale_opens_at) <= now && now < Date.parse(s.sale_closes_at)
  if (list.some(open)) return 'ON_SALE'
  if (list.some((s) => s.sale_opens_at && Date.parse(s.sale_opens_at) > now)) return 'UPCOMING'
  return 'CLOSED'
}
export function nextShowtime(shows: Showtime[] | undefined, now: number): Showtime | undefined {
  return (shows ?? [])
    .filter((s) => active(s) && s.ends_at && Date.parse(s.ends_at) > now)
    .sort((a, b) => Date.parse(a.starts_at ?? '') - Date.parse(b.starts_at ?? ''))[0]
}
