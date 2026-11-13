import type { GetAvailability200ZonesItem, HoldRequest } from '@/api/generated/model'
import { sameZone, type ZoneRef } from '@/seatmap/svg'
import type { MapZone } from '@/seatmap/SeatMapView'

/*
 * Logic màn chọn ghế (Figma B3/B3b): gom khu theo hạng giá, chọn/bỏ ghế có giới hạn vé mỗi đơn,
 * dựng thân yêu cầu giữ ghế. Không phụ thuộc React để test được.
 */

export const DEFAULT_MAX_TICKETS = 6

export type TierSummary = {
  /** 1..n theo giá giảm dần cho khu ngồi; 'standing' cho khu đứng. */
  key: number | 'standing'
  label: string
  price: number
  /** Mã khu viết gọn, vd. "A3–A6, B1, C3". */
  zones: string
  seatsLeft: number
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
    const match = availability.find((a) => sameZone(z.code, a.name))
    if (match) byCode[z.code] = match
  }
  const seatedPrices = [
    ...new Set(
      svgZones.filter((z) => z.kind === 'SEATED' && byCode[z.code]?.tier).map((z) => byCode[z.code].tier!.price),
    ),
  ].sort((a, b) => b - a)

  const zones: Record<string, MapZone> = {}
  const grouped = new Map<number | 'standing', { price: number; codes: string[]; left: number }>()
  for (const z of svgZones) {
    const a = byCode[z.code]
    const price = a?.tier?.price
    const left = a?.seats_left ?? 0
    const key = z.kind === 'STANDING' ? 'standing' : price === undefined ? undefined : seatedPrices.indexOf(price) + 1
    zones[z.code] = { tier: typeof key === 'number' ? key : undefined, soldOut: !a || left <= 0 }
    if (key === undefined || price === undefined) continue
    const g = grouped.get(key) ?? { price, codes: [], left: 0 }
    g.codes.push(z.code)
    g.left += left
    grouped.set(key, g)
  }
  const tiers = [...grouped.entries()]
    .sort(([a], [b]) => (a === 'standing' ? 1 : b === 'standing' ? -1 : a - b))
    .map(([key, g]) => ({
      key,
      label: key === 'standing' ? 'Khu đứng' : `Hạng ${key}`,
      price: g.price,
      zones: compressZoneCodes(g.codes),
      seatsLeft: g.left,
    }))
  return { zones, tiers, byCode }
}

/** ["A3-T1","A4-T1","A5-T1","B1-T1","C3-T1"] → "A3–A5, B1, C3". Bỏ hậu tố tầng và L/R; gộp số liền nhau cùng chữ. */
export function compressZoneCodes(codes: string[]): string {
  const parsed = [...new Set(codes.map((c) => c.replace(/-T\d+$/, '').replace(/([A-Z]\d+)[LR]$/, '$1')))].map((c) => {
    const m = /^([A-Z]+)(\d*)$/.exec(c)
    return { raw: c, letters: m?.[1] ?? c, n: m?.[2] ? Number(m[2]) : undefined }
  })
  parsed.sort((a, b) => a.letters.localeCompare(b.letters) || (a.n ?? 0) - (b.n ?? 0))
  const out: string[] = []
  for (let i = 0; i < parsed.length;) {
    const start = parsed[i]
    let j = i
    while (
      start.n !== undefined &&
      parsed[j + 1]?.letters === start.letters &&
      parsed[j + 1].n === (parsed[j].n ?? 0) + 1
    )
      j++
    out.push(
      j - i >= 2
        ? `${start.raw}–${parsed[j].raw}`
        : parsed
            .slice(i, j + 1)
            .map((p) => p.raw)
            .join(', '),
    )
    i = j + 1
  }
  return out.join(', ')
}

// ---- chọn ghế ----

export type PickedSeat = {
  /** UUID ghế của API (dùng để giữ ghế). */
  seatId: string
  /** Id ghế trong SVG (dùng để tô). */
  svgId: string
  zoneCode: string
  zoneName: string
  tier?: number
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
