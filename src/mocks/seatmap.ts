import { http, HttpResponse } from 'msw'

import { API_BASE } from '@/api/config'
import type { GetAvailability200, Order, OrderItem, SeatMap, SeatStatus } from '@/api/generated/model'

import { detailOf, EVENTS } from './events'
import { held } from './holds'
import { saveOrder } from './orders'
import stadiumSvg from './seatmaps/thien-truong.svg?raw'

/*
 * Mock sơ đồ ghế sân Thiên Trường (Figma page 09): khu, hạng giá, tình trạng ghế, giữ ghế.
 * Ghế lấy đúng từ SVG (6.699 ghế) để id khớp `SEAT__<khu>__<hàng>__<số>`.
 * Phân hạng giá theo chú giải ở Figma B3: Hạng 1 = A1, A2; Hạng 2 = A3–A6, B1, C3, D3; Hạng 3 = B2–B4, C, D;
 * Khu đứng = B11–B13, C, D. D5 hết vé (xám ở Figma).
 */

const uuid = (prefix: string, n: number) => `${prefix}-0000-7000-8000-${String(n).padStart(12, '0')}`

const TIER_PRICE = { 1: 1_200_000, 2: 600_000, 3: 300_000, standing: 120_000 } as const
export const TIERS = [
  { id: uuid('0193b200', 1), name: 'Hạng 1', price: TIER_PRICE[1] },
  { id: uuid('0193b200', 2), name: 'Hạng 2', price: TIER_PRICE[2] },
  { id: uuid('0193b200', 3), name: 'Hạng 3', price: TIER_PRICE[3] },
  { id: uuid('0193b200', 4), name: 'Khu đứng', price: TIER_PRICE.standing },
]

function tierOf(code: string, standing: boolean) {
  if (standing) return TIERS[3]
  if (code === 'A1-T1' || code.startsWith('A2')) return TIERS[0]
  if (['A3', 'A4', 'A5', 'A6', 'B1', 'C3', 'D3'].includes(code.replace(/-T\d+$/, ''))) return TIERS[1]
  return TIERS[2]
}

type Zone = {
  id: string
  code: string
  name: string
  standing: boolean
  capacity: number
  tier: (typeof TIERS)[number]
}
type Seat = { id: string; zone: string; row: string; number: number; svgId: string }

const zones: Zone[] = []
const seatsByZone = new Map<string, Seat[]>()
{
  let n = 0
  for (const m of stadiumSvg.matchAll(/id="ZONE__([A-Z0-9]+(?:-T\d+)?)__(SEATED|STANDING)(?:__(\d+))?"/g)) {
    const code = m[1]
    const standing = m[2] === 'STANDING'
    zones.push({
      id: uuid('0193b400', ++n),
      code,
      name: code.replace(/-T\d+$/, ''),
      standing,
      capacity: Number(m[3] ?? 0),
      tier: tierOf(code, standing),
    })
  }
  let s = 0
  for (const m of stadiumSvg.matchAll(/id="(SEAT__([A-Z0-9]+(?:-T\d+)?)__([A-Z]+)__(\d+))"/g)) {
    const list = seatsByZone.get(m[2]) ?? []
    list.push({ id: uuid('0193b500', ++s), zone: m[2], row: m[3], number: Number(m[4]), svgId: m[1] })
    seatsByZone.set(m[2], list)
  }
}

// Trạng thái ghế giả lập, cố định theo vị trí để mỗi lần tải ra cùng một sơ đồ.
function baseStatus(seat: Seat): SeatStatus {
  const h = (Number(seat.id.slice(-6)) * 2654435761) % 1000
  if (h < 150) return 'SOLD'
  if (h < 210) return 'HELD'
  if (h < 225) return 'BLOCKED'
  return 'AVAILABLE'
}
const statusOf = (seat: Seat): SeatStatus => (held.has(seat.id) ? 'HELD' : baseStatus(seat))

function seatsLeft(zone: Zone): number {
  if (zone.code === 'D5-T1') return 0
  if (zone.code === 'A2L-T1') return 148
  if (zone.standing) return zone.capacity - Math.round(zone.capacity * 0.35)
  return (seatsByZone.get(zone.code) ?? []).filter((s) => statusOf(s) === 'AVAILABLE').length
}

const problem = (status: number, code: string, title: string, extra: object = {}) =>
  HttpResponse.json({ title, status, code, ...extra }, { status })

export const seatmapHandlers = [
  http.get(`*${API_BASE}/showtimes/:showtimeId/availability`, ({ params }) =>
    HttpResponse.json<GetAvailability200>({
      showtime_id: String(params.showtimeId),
      status: 'ON_SALE',
      sold_out: false,
      zones: zones.map((z) => ({ zone_id: z.id, name: z.name, tier: z.tier, seats_left: seatsLeft(z) })),
    }),
  ),

  http.get(`*${API_BASE}/showtimes/:showtimeId/seatmap`, ({ params, request }) => {
    const zoneId = new URL(request.url).searchParams.get('zone_id')
    const list = zoneId ? zones.filter((z) => z.id === zoneId) : zones
    if (zoneId && list.length === 0)
      return problem(404, 'NOT_FOUND', 'Không tìm thấy khu', { detail: 'zone_id không thuộc sơ đồ của suất' })
    return HttpResponse.json<SeatMap>({
      showtime_id: String(params.showtimeId),
      status: 'ON_SALE',
      zones: list.map((z) => ({
        zone_id: z.id,
        name: z.name,
        kind: z.standing ? 'STANDING' : 'SEATED',
        tier: z.tier,
        seats_left: z.standing ? seatsLeft(z) : undefined,
        seats: z.standing
          ? []
          : (seatsByZone.get(z.code) ?? []).map((s) => ({
              seat_id: s.id,
              row: s.row,
              number: s.number,
              seat_type: 'STANDARD' as const,
              pair_seat_id: null,
              status: statusOf(s),
              x: 0,
              y: 0,
            })),
      })),
    })
  }),

  http.post(`*${API_BASE}/showtimes/:showtimeId/holds`, async ({ params, request }) => {
    if (!request.headers.get('Idempotency-Key')) {
      return problem(400, 'VALIDATION_ERROR', 'Thiếu Idempotency-Key')
    }
    const body = (await request.json()) as { seat_ids?: string[]; zone_id?: string; quantity?: number }
    const items: OrderItem[] = []

    if (body.seat_ids?.length) {
      const all = [...seatsByZone.values()].flat()
      const picked = body.seat_ids.map((id) => all.find((s) => s.id === id))
      const taken = picked.filter((s) => !s || statusOf(s) !== 'AVAILABLE').map((s) => s?.id ?? '')
      if (taken.length) return problem(409, 'SEAT_TAKEN', 'Ghế vừa có người giữ', { taken_seat_ids: taken })
      for (const s of picked) {
        const zone = zones.find((z) => z.code === s!.zone)!
        held.add(s!.id)
        items.push({
          id: crypto.randomUUID(),
          zone: zone.name,
          row: s!.row,
          number: s!.number,
          seat_id: s!.id,
          tier: zone.tier.name,
          unit_price: zone.tier.price,
          quantity: 1,
        })
      }
    } else if (body.zone_id && body.quantity) {
      const zone = zones.find((z) => z.id === body.zone_id && z.standing)
      if (!zone) return problem(404, 'NOT_FOUND', 'Không tìm thấy khu đứng')
      if (body.quantity > seatsLeft(zone))
        return problem(409, 'NOT_ENOUGH_STOCK', 'Khu đứng không đủ chỗ', { seats_left: seatsLeft(zone) })
      items.push({
        id: crypto.randomUUID(),
        zone: zone.name,
        tier: zone.tier.name,
        unit_price: zone.tier.price,
        quantity: body.quantity,
      })
    } else {
      return problem(400, 'VALIDATION_ERROR', 'Gửi seat_ids hoặc zone_id kèm quantity')
    }

    const event = EVENTS[0]
    const detail = detailOf(event)
    const showtime = detail.showtimes?.find((s) => s.id === params.showtimeId) ?? detail.showtimes?.[0]
    const now = Date.now()
    const order: Order = {
        id: crypto.randomUUID(),
        code: `VG-${String(now).slice(-5)}`,
        status: 'PENDING',
        event,
        showtime,
        items,
        total_amount: items.reduce((sum, i) => sum + (i.unit_price ?? 0) * (i.quantity ?? 1), 0),
        currency: 'VND',
        expires_at: new Date(now + 10 * 60_000).toISOString(),
        created_at: new Date(now).toISOString(),
      }
    saveOrder(order)
    return HttpResponse.json<Order>(order, { status: 201 })
  }),
]
