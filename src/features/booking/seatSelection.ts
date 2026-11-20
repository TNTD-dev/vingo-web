import type { GetAvailability200ZonesItem, HoldRequest } from '@/api/generated/model'
import { isApiError } from '@/api/problem'
import { sameZone, type ZoneRef } from '@/seatmap/svg'
import type { MapZone } from '@/seatmap/SeatMapView'

/*
 * Logic màn chọn ghế (Figma B3/B3b): gom khu theo hạng giá, chọn/bỏ ghế có giới hạn vé mỗi đơn,
 * dựng thân yêu cầu giữ ghế. Không phụ thuộc React để test được.
 */

export const DEFAULT_MAX_TICKETS = 6

export type TierSummary = {
  key: number
  label: string
  price: number
  color?: string
  standingOnly: boolean
}

export type MapModel = {
  zones: Record<string, MapZone>
  tiers: TierSummary[]
  /** Mã khu SVG → khu trong availability (để lấy zone_id, tier, số chỗ). */
  byCode: Record<string, GetAvailability200ZonesItem>
}

/** Khớp khu trong SVG với khu API, gom theo hạng và tô màu theo hạng giá (đắt nhất là Hạng 1). */
export function buildMapModel(svgZones: ZoneRef[], availability: GetAvailability200ZonesItem[]): MapModel {
  const byCode: Record<string, GetAvailability200ZonesItem> = {}
  for (const z of svgZones) {
    const match = availability.find((a) => sameZone(z.code, a.code ?? a.name))
    if (match) byCode[z.code] = match
  }
  const tierId = (tier: NonNullable<GetAvailability200ZonesItem['tier']>) =>
    tier.id ?? JSON.stringify([tier.name, tier.price])
  const byTier = new Map<string, Omit<TierSummary, 'key'>>()
  for (const z of svgZones) {
    const tier = byCode[z.code]?.tier
    if (!tier) continue
    const id = tierId(tier)
    const current = byTier.get(id)
    byTier.set(id, {
      label: tier.name,
      price: tier.price,
      color: tier.color,
      standingOnly: z.kind === 'STANDING' && (current?.standingOnly ?? true),
    })
  }
  const ranked = [...byTier].sort(
    ([, a], [, b]) => Number(a.standingOnly) - Number(b.standingOnly) || b.price - a.price,
  )
  const keys = new Map(ranked.map(([id], index) => [id, index + 1]))
  const tiers = ranked.map(([, tier], index) => ({ ...tier, key: index + 1 }))

  const zones: Record<string, MapZone> = {}
  for (const z of svgZones) {
    const a = byCode[z.code]
    zones[z.code] = {
      tier: a?.tier && keys.get(tierId(a.tier)),
      color: a?.tier?.color,
      soldOut: !a || (a.seats_left ?? 0) <= 0,
    }
  }
  return { zones, tiers, byCode }
}

// ---- chọn ghế ----

export type PickedSeat = {
  /** UUID ghế của API (dùng để giữ ghế). */
  seatId: string
  /** UUID khu của API (để tải lại ghế gợi ý khi SEAT_TAKEN). */
  zoneId?: string
  /** Id ghế trong SVG (dùng để tô). */
  svgId: string
  zoneCode: string
  zoneName: string
  tierName?: string
  row: string
  number: number
  price: number
  pairSeatId?: string | null
}

export type ToggleResult = { picks: PickedSeat[]; error?: 'MAX_TICKETS' }

/** Chọn thêm hoặc bỏ một ghế. Ghế đôi đi cùng ghế cặp (hai vé). Vượt `max` thì giữ nguyên và báo lỗi. */
export function toggleSeat(
  picks: PickedSeat[],
  seat: PickedSeat,
  partner: PickedSeat | undefined,
  max: number,
): ToggleResult {
  const ids = new Set([seat.seatId, ...(partner ? [partner.seatId] : [])])
  if (picks.some((p) => p.seatId === seat.seatId)) {
    return { picks: picks.filter((p) => !ids.has(p.seatId)) }
  }
  const adding = [seat, ...(partner ? [partner] : [])].filter((s) => !picks.some((p) => p.seatId === s.seatId))
  if (picks.length + adding.length > max) return { picks, error: 'MAX_TICKETS' }
  return { picks: [...picks, ...adding] }
}

export type Standing = {
  zoneId: string
  zoneCode: string
  zoneName: string
  price: number
  quantity: number
  left: number
}

/** Thân yêu cầu giữ ghế: đúng một trong hai dạng (ghế hoặc khu đứng + số lượng). */
export function holdBody(picks: PickedSeat[], standing: Standing | null): HoldRequest | null {
  if (standing && standing.quantity > 0) return { zone_id: standing.zoneId, quantity: standing.quantity }
  if (picks.length > 0) return { seat_ids: picks.map((p) => p.seatId) }
  return null
}

export function ticketCount(picks: PickedSeat[], standing: Standing | null): number {
  return standing ? standing.quantity : picks.length
}

/** Tạm tính chỉ để hiển thị; số tiền thật là `total_amount` của đơn do API trả sau khi giữ ghế. */
export function previewTotal(picks: PickedSeat[], standing: Standing | null): number {
  return standing ? standing.price * standing.quantity : picks.reduce((sum, p) => sum + p.price, 0)
}

/** Tối đa mua được ở khu đứng: giới hạn đơn và số chỗ còn. */
export function standingLimit(max: number, left: number): number {
  return Math.max(0, Math.min(max, left))
}

function idList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []
}

export type HoldFailure = {
  message: string
  /** Chỉ SEAT_TAKEN: ghế vừa bị giữ/bán và ghế trống gợi ý cùng khu. */
  takenSeatIds: string[]
  suggestedSeatIds: string[]
  /** Làm mới số chỗ/ghế sau lỗi này. */
  refresh: boolean
  /** Dùng lại Idempotency-Key khi bấm lại: chỉ khi lỗi chưa chắc chắn (mạng, 5xx, 429). */
  retrySameKey: boolean
}

/** Chuyển lỗi giữ ghế thành câu tiếng Việt dễ hiểu theo `error.code` (không theo chuỗi detail). */
export function describeHoldError(error: unknown, max: number): HoldFailure {
  const base = { takenSeatIds: [], suggestedSeatIds: [], refresh: false, retrySameKey: false }
  if (isApiError(error, 'SEAT_TAKEN')) {
    const suggested = idList(error.problem?.suggested_seat_ids)
    return {
      ...base,
      message: suggested.length
        ? 'Có ghế vừa được người khác giữ. Bạn có thể dùng ghế gợi ý cùng khu hoặc chọn lại.'
        : 'Có ghế vừa được người khác giữ. Mình đã bỏ ghế đó khỏi lựa chọn, bạn chọn thêm ghế khác nhé.',
      takenSeatIds: idList(error.problem?.taken_seat_ids),
      suggestedSeatIds: suggested,
      refresh: true,
    }
  }
  if (isApiError(error, 'NOT_ENOUGH_STOCK')) {
    const left = error.problem?.seats_left
    return {
      ...base,
      message:
        typeof left === 'number'
          ? `Khu đứng chỉ còn ${left} chỗ. Hãy giảm số lượng vé.`
          : 'Khu đứng không còn đủ chỗ. Hãy giảm số lượng vé.',
      refresh: true,
    }
  }
  if (isApiError(error, 'MAX_TICKETS_EXCEEDED')) return { ...base, message: `Mỗi đơn mua tối đa ${max} vé.` }
  if (isApiError(error, 'SHOWTIME_NOT_ON_SALE'))
    return { ...base, message: 'Suất này hiện không mở bán.', refresh: true }
  if (isApiError(error, 'ORDER_STATE_INVALID'))
    return {
      ...base,
      message: 'Bạn đang có một đơn chờ thanh toán cho suất này. Hãy thanh toán hoặc huỷ đơn đó trước.',
    }
  if (isApiError(error, 'IDEMPOTENCY_CONFLICT'))
    return { ...base, message: 'Yêu cầu giữ ghế này đã được gửi với lựa chọn khác. Hãy bấm giữ ghế lại.' }
  if (isApiError(error) && error.status === 429)
    return { ...base, message: 'Bạn thao tác quá nhanh. Đợi vài giây rồi thử lại.', retrySameKey: true }
  if (isApiError(error, 'UNAUTHORIZED') || (isApiError(error) && error.status === 401))
    return { ...base, message: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.' }
  return { ...base, message: 'Chưa giữ được ghế. Vui lòng thử lại.', retrySameKey: true }
}
