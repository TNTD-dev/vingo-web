import type {
  AdminGetOrder200,
  AuditLog,
  EventDetail,
  SeatLayoutOverview,
  SeatLayoutZoneDetail,
  SeatMap,
  SeatStatus,
  Ticket,
  Venue,
} from '@/api/generated/model'
import { detailOf, EVENTS } from './adminFixtures'
import stadiumSvg from './seatmaps/thien-truong.svg?raw'

export const uid = (prefix: string, n: number) => `${prefix}-0000-7000-8000-${String(n).padStart(12, '0')}`
export const stamp = () => new Date().toISOString()
export const venues: Venue[] = [
  {
    id: uid('0193c100', 1),
    name: 'Sân vận động Thống Nhất',
    type: 'STADIUM',
    address: '138 Đào Duy Từ, Phường Diên Hồng',
    city: 'HCM',
    city_name: 'TP. Hồ Chí Minh',
    district: 'Quận 10',
    info: {
      opening_hours: '08:00 – 22:00',
      parking: 'Bãi xe tại cổng A và B.',
      rules: 'Xuất trình vé QR tại cổng. Không mang vật sắc nhọn.',
    },
    halls: [{ id: uid('0193c200', 1), name: 'Sân chính', venue_id: uid('0193c100', 1) }],
  },
  {
    id: uid('0193c100', 2),
    name: 'Nhà hát Bến Thành',
    type: 'THEATER',
    address: '6 Mạc Đĩnh Chi',
    city: 'HCM',
    city_name: 'TP. Hồ Chí Minh',
    halls: [{ id: uid('0193c200', 2), name: 'Khán phòng lớn', venue_id: uid('0193c100', 2) }],
  },
  {
    id: uid('0193c100', 3),
    name: 'SVĐ Quân khu 7',
    type: 'STADIUM',
    address: '202 Hoàng Văn Thụ',
    city: 'HCM',
    city_name: 'TP. Hồ Chí Minh',
    halls: [{ id: uid('0193c200', 3), name: 'Sân khấu ngoài trời', venue_id: uid('0193c100', 3) }],
  },
  {
    id: uid('0193c100', 4),
    name: 'SVĐ Hàng Đẫy',
    type: 'STADIUM',
    address: '9 Trịnh Hoài Đức',
    city: 'HN',
    city_name: 'Hà Nội',
    district: 'Đống Đa',
    halls: [{ id: uid('0193c200', 4), name: 'Sân chính', venue_id: uid('0193c100', 4) }],
  },
  {
    id: uid('0193c100', 5),
    name: 'Đồi Robin',
    type: 'OUTDOOR',
    address: 'Khu biểu diễn ngoài trời',
    city: 'DN',
    city_name: 'Đà Nẵng',
    halls: [{ id: uid('0193c200', 5), name: 'Sân ngoài trời', venue_id: uid('0193c100', 5) }],
  },
  {
    id: uid('0193c100', 6),
    name: 'SVĐ Mỹ Đình',
    type: 'STADIUM',
    address: 'Lê Đức Thọ',
    city: 'HN',
    city_name: 'Hà Nội',
    district: 'Nam Từ Liêm',
    halls: [{ id: uid('0193c200', 6), name: 'Sân chính', venue_id: uid('0193c100', 6) }],
  },
]
export type LayoutFixture = { overview: SeatLayoutOverview; svg: string; zones: SeatLayoutZoneDetail[] }
export const layouts = new Map<string, LayoutFixture>()
export function makeLayout(
  hallId: string,
  name: string,
  svg: string,
  version = 1,
  id = crypto.randomUUID() as string,
): LayoutFixture {
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml')
  let seatIndex = 0
  const zones: SeatLayoutZoneDetail[] = Array.from(doc.querySelectorAll('[id^="ZONE__"]')).flatMap((el, i) => {
    const m = /^ZONE__([A-Z0-9]+(?:-T\d+)?)__(SEATED|STANDING)(?:__(\d+))?$/.exec(el.id)
    if (!m) return []
    const code = m[1],
      rows = new Map<string, { id: string; number: number; x: number; y: number }[]>()
    for (const seat of Array.from(doc.querySelectorAll(`[id^="SEAT__${code}__"]`))) {
      const parts = seat.id.split('__'),
        list = rows.get(parts[2]) ?? []
      list.push({
        id: uid('0193b500', ++seatIndex),
        number: Number(parts[3]),
        x: Number(seat.getAttribute('x') ?? seat.getAttribute('cx') ?? 0),
        y: Number(seat.getAttribute('y') ?? seat.getAttribute('cy') ?? 0),
      })
      rows.set(parts[2], list)
    }
    return [
      {
        id: uid('0193b400', i + 1),
        code,
        label: code,
        stand_code: code.split('-')[0],
        level: Number(code.split('-T')[1] ?? 1),
        kind: m[2] as 'SEATED' | 'STANDING',
        capacity: m[2] === 'STANDING' ? Number(m[3] ?? 0) : [...rows.values()].reduce((n, r) => n + r.length, 0),
        svg_id: el.id,
        rows: [...rows].map(([row_label, seats]) => ({ row_label, seats })),
      },
    ]
  })
  const result: LayoutFixture = {
    overview: {
      id,
      hall_id: hallId,
      name,
      status: 'DRAFT',
      version,
      schema_version: 1,
      zone_count: zones.length,
      seat_count: zones.reduce((n, z) => n + (z.kind === 'SEATED' ? z.capacity : 0), 0),
      zones: zones.map(({ rows: _rows, ...z }) => z),
    },
    svg,
    zones,
  }
  layouts.set(id, result)
  return result
}
const seeded = makeLayout(uid('0193c200', 1), 'Sơ đồ sân · 4 khán đài', stadiumSvg, 1, uid('0193c400', 1))
seeded.overview.status = 'PUBLISHED'
export const events: EventDetail[] = EVENTS.slice(0, 8).map((e, i) => {
  const d = structuredClone(detailOf(e))
  d.status = i === 6 ? 'DRAFT' : i === 7 ? 'CANCELLED' : 'PUBLISHED'
  d.venue = venues[0]
  d.showtimes = d.showtimes?.map((s, j) => ({
    ...s,
    id: uid('0193c300', i * 10 + j + 1),
    hall_id: uid('0193c200', 1),
    seat_layout_id: uid('0193c400', 1),
    venue: venues[0],
    sale_closes_at: s.starts_at,
    status: i === 7 ? 'CANCELLED' : s.status,
  }))
  return d
})
export const statusOverrides = new Map<string, Map<string, SeatStatus>>()
export const zonePrices = new Map<string, Map<string, string>>()
export function findShow(id: string) {
  return events.flatMap((e) => e.showtimes ?? []).find((s) => s.id === id)
}
export function mapOf(showId: string): SeatMap | undefined {
  const show = findShow(showId),
    event = events.find((e) => e.id === show?.event_id),
    layout = layouts.get(show?.seat_layout_id ?? '')
  if (!show || !layout) return undefined
  return {
    showtime_id: showId,
    status: show.status,
    zones: layout.zones.map((z, i) => {
      const assigned = zonePrices.get(event?.id ?? '')?.get(z.id),
        tier = assigned
          ? event?.price_tiers?.find((t) => t.id === assigned)
          : event?.price_tiers?.[z.kind === 'STANDING' ? 3 : i % 3]
      return {
        zone_id: z.id,
        name: z.code,
        kind: z.kind,
        tier,
        seats_left: z.kind === 'STANDING' ? Math.floor(z.capacity * 0.7) : undefined,
        seats: z.rows?.flatMap((r) =>
          r.seats.map((s) => ({
            seat_id: s.id,
            row: r.row_label,
            number: s.number,
            x: s.x,
            y: s.y,
            seat_type: 'STANDARD' as const,
            status:
              statusOverrides.get(showId)?.get(s.id) ??
              (Number(s.id.slice(-3)) % 19 === 0
                ? 'SOLD'
                : Number(s.id.slice(-3)) % 17 === 0
                  ? 'HELD'
                  : Number(s.id.slice(-3)) % 29 === 0
                    ? 'BLOCKED'
                    : 'AVAILABLE'),
          })),
        ),
      }
    }),
  }
}
export const orders: AdminGetOrder200[] = Array.from({ length: 28 }, (_, i) => {
  const e = events[i % 6],
    show = e.showtimes![0],
    status = i < 4 ? 'NEEDS_REVIEW' : i % 6 === 0 ? 'PENDING' : i % 7 === 0 ? 'EXPIRED' : 'PAID'
  return {
    id: uid('0193d100', i + 1),
    code: `VG-2026-${String(i + 1).padStart(4, '0')}`,
    status,
    event: { id: e.id, title: e.title, category: e.category },
    showtime: show,
    total_amount: 1200000,
    currency: 'VND',
    buyer: {
      full_name: ['Nguyễn Minh Anh', 'Trần Hoàng Nam', 'Lê Phương Linh', 'Phạm Tuấn'][i % 4],
      email: `khach${i + 1}@example.com`,
      phone: '0900000000',
    },
    created_at: new Date(Date.now() - i * 3600000).toISOString(),
    paid_at: status === 'PAID' ? new Date(Date.now() - i * 3600000).toISOString() : null,
    review_reason: status === 'NEEDS_REVIEW' ? (i % 2 ? 'AMOUNT_MISMATCH' : 'PAID_AFTER_EXPIRY') : null,
    items: [
      {
        id: uid('0193d200', i + 1),
        zone: 'A1-T1',
        row: 'A',
        number: i + 1,
        tier: 'Hạng 1',
        quantity: 1,
        unit_price: 1200000,
      },
    ],
    payments: [
      {
        id: uid('0193d300', i + 1),
        order_id: uid('0193d100', i + 1),
        txn_ref: `DEMO-${10000 + i}`,
        amount: 1200000,
        status: status === 'PENDING' ? 'OPEN' : 'SUCCEEDED',
        last_response_code: '00',
      },
    ],
    history: [
      { status: 'PENDING', at: new Date(Date.now() - (i + 1) * 3600000).toISOString() },
      { status, at: new Date(Date.now() - i * 3600000).toISOString() },
    ],
  }
})
export const tickets: Ticket[] = orders
  .filter((o) => o.status === 'PAID')
  .map((o, i) => ({
    id: uid('0193e100', i + 1),
    code: `VT-${String(i + 1).padStart(6, '0')}`,
    order_code: o.code,
    status: i === 3 ? 'USED' : i === 5 ? 'VOID' : 'ISSUED',
    event: o.event,
    showtime: o.showtime,
    venue: venues[0],
    zone: 'A1-T1',
    row: 'A',
    number: i + 1,
    tier: 'Hạng 1',
    used_at: i === 3 ? stamp() : null,
  }))
export const audits: AuditLog[] = [
  {
    id: uid('0193f100', 1),
    action: 'BLOCK_SEATS',
    entity: 'showtime',
    entity_id: events[0].showtimes![0].id,
    actor_id: 'admin-demo',
    reason: 'Dành chỗ cho khu kỹ thuật',
    via_agent: false,
    at: stamp(),
    before: { count: 0 },
    after: { count: 12 },
  },
]
export function audit(
  action: AuditLog['action'],
  entity: string,
  entityId: string,
  reason: string,
  before: object = {},
  after: object = {},
) {
  audits.unshift({
    id: crypto.randomUUID(),
    action,
    entity,
    entity_id: entityId,
    actor_id: 'admin-demo',
    reason,
    via_agent: false,
    at: stamp(),
    before: { ...before },
    after: { ...after },
  })
}
export function page<T>(data: T[], url: URL) {
  const offset = Math.max(0, Number(url.searchParams.get('cursor')) || 0),
    limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit')) || 20))
  return {
    data: data.slice(offset, offset + limit),
    next_cursor: offset + limit < data.length ? String(offset + limit) : null,
  }
}
