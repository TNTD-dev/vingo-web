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
    address: '138 Đào Duy Từ, Phường Diên Hồng',
    city: 'HCM',
    city_name: 'TP. Hồ Chí Minh',
    district: 'Quận 10',
    rules: 'Xuất trình vé QR tại cổng. Không mang vật sắc nhọn.',
  },
  {
    id: uid('0193c100', 2),
    name: 'Nhà hát Bến Thành',
    address: '6 Mạc Đĩnh Chi',
    city: 'HCM',
    city_name: 'TP. Hồ Chí Minh',
  },
  {
    id: uid('0193c100', 3),
    name: 'SVĐ Quân khu 7',
    address: '202 Hoàng Văn Thụ',
    city: 'HCM',
    city_name: 'TP. Hồ Chí Minh',
  },
  {
    id: uid('0193c100', 4),
    name: 'SVĐ Hàng Đẫy',
    address: '9 Trịnh Hoài Đức',
    city: 'HN',
    city_name: 'Hà Nội',
    district: 'Đống Đa',
  },
  {
    id: uid('0193c100', 5),
    name: 'Đồi Robin',
    address: 'Khu biểu diễn ngoài trời',
    city: 'DN',
    city_name: 'Đà Nẵng',
  },
  {
    id: uid('0193c100', 6),
    name: 'SVĐ Mỹ Đình',
    address: 'Lê Đức Thọ',
    city: 'HN',
    city_name: 'Hà Nội',
    district: 'Nam Từ Liêm',
  },
]
function seatGrid(zone: string, rows: string[], cols: number, x0: number, y0: number, dx: number, dy: number) {
  return rows
    .flatMap((row, r) =>
      Array.from({ length: cols }, (_, c) => {
        const num = String(c + 1).padStart(2, '0')
        return `<circle id="SEAT__${zone}__${row}__${num}" cx="${x0 + c * dx}" cy="${y0 + r * dy}" r="6" fill="#475569"/>`
      }),
    )
    .join('')
}
const theaterSvg = `<svg viewBox="0 0 1000 700" xmlns="http://www.w3.org/2000/svg">
  <rect id="BACKGROUND" width="1000" height="700" fill="#ffffff"/>
  <g id="STAGE" transform="translate(250 40)">
    <rect x="0" y="0" width="500" height="110" rx="16" fill="#1e293b"/>
    <text x="250" y="62" text-anchor="middle" fill="#f8fafc" font-size="22" font-weight="600">SÂN KHẤU</text>
  </g>
  <g id="ZONE__A1-T1__SEATED" transform="translate(110 200)"><path d="M0 0H340V220H0Z" fill="#dbeafe" stroke="#2563eb" stroke-width="2"/></g>
  <g id="CONTENT__A1-T1" transform="translate(110 200)">
    ${seatGrid('A1-T1', ['A', 'B', 'C', 'D'], 8, 55, 48, 34, 40)}
    <g id="GATE__A1-T1__01"><rect x="-18" y="88" width="32" height="44" rx="4" fill="#fff1dc" stroke="#e8590c" stroke-width="1.5"/><text id="GATE_LABEL__A1-T1__01" x="-2" y="114" text-anchor="middle" font-size="11" fill="#c2410c">01</text></g>
  </g>
  <g id="LABEL__A1-T1"><rect x="250" y="210" width="60" height="24" rx="12" fill="#ffffff" stroke="#2563eb"/><text x="280" y="226" text-anchor="middle" font-size="12" fill="#1d4ed8">A1-T1</text></g>
  <g id="ZONE__A2-T1__SEATED" transform="translate(550 200)"><path d="M0 0H340V220H0Z" fill="#e0e7ff" stroke="#4f46e5" stroke-width="2"/></g>
  <g id="CONTENT__A2-T1" transform="translate(550 200)">
    ${seatGrid('A2-T1', ['A', 'B', 'C', 'D'], 8, 55, 48, 34, 40)}
    <g id="GATE__A2-T1__02"><rect x="326" y="88" width="32" height="44" rx="4" fill="#fff1dc" stroke="#e8590c" stroke-width="1.5"/><text id="GATE_LABEL__A2-T1__02" x="342" y="114" text-anchor="middle" font-size="11" fill="#c2410c">02</text></g>
  </g>
  <g id="LABEL__A2-T1"><rect x="690" y="210" width="60" height="24" rx="12" fill="#ffffff" stroke="#4f46e5"/><text x="720" y="226" text-anchor="middle" font-size="12" fill="#4338ca">A2-T1</text></g>
  <g transform="translate(180 460)"><g transform="translate(20 10)"><path id="ZONE__BAL-T2__SEATED" d="M0 0H600V160H0Z" fill="#fef3c7" stroke="#d97706" stroke-width="2"/></g></g>
  <g transform="translate(180 460)"><g id="CONTENT__BAL-T2" transform="translate(20 10)">${seatGrid('BAL-T2', ['A', 'B', 'C'], 10, 75, 44, 50, 38)}</g></g>
  <g id="LABEL__BAL-T2"><rect x="466" y="480" width="68" height="24" rx="12" fill="#ffffff" stroke="#d97706"/><text x="500" y="496" text-anchor="middle" font-size="12" fill="#b45309">BAL-T2</text></g>
</svg>`
const outdoorSvg = `<svg viewBox="0 0 900 600" xmlns="http://www.w3.org/2000/svg">
  <rect id="BACKGROUND" width="900" height="600" fill="#f8fafc"/>
  <g id="STAGE" transform="translate(260 32)">
    <rect x="0" y="0" width="380" height="84" rx="12" fill="#0f172a"/>
    <text x="190" y="48" text-anchor="middle" fill="#c6f24e" font-size="20" font-weight="600">SÂN KHẤU NGOÀI TRỜI</text>
  </g>
  <path id="ZONE__GA-T1__STANDING__600" d="M160 150H740V340H160Z" fill="#dcfce7" stroke="#16a34a" stroke-width="2" stroke-dasharray="8 4"/>
  <g id="LABEL__GA-T1"><rect x="380" y="232" width="140" height="28" rx="14" fill="#ffffff" stroke="#16a34a"/><text x="450" y="250" text-anchor="middle" font-size="12" fill="#15803d">GA-T1 · Đứng (600)</text></g>
  <g id="ZONE__VIP-T1__SEATED" transform="translate(180 376)"><rect x="0" y="0" width="540" height="170" rx="10" fill="#fef9c3" stroke="#ca8a04" stroke-width="2"/></g>
  <g id="CONTENT__VIP-T1" transform="translate(180 376)">
    ${seatGrid('VIP-T1', ['A', 'B', 'C'], 12, 60, 46, 38, 38)}
    <g id="GATE__VIP-T1__01"><rect x="-16" y="64" width="32" height="42" rx="4" fill="#fff1dc" stroke="#e8590c" stroke-width="1.5"/><text id="GATE_LABEL__VIP-T1__01" x="0" y="89" text-anchor="middle" font-size="11" fill="#c2410c">01</text></g>
  </g>
  <g id="LABEL__VIP-T1"><rect x="415" y="388" width="70" height="24" rx="12" fill="#ffffff" stroke="#ca8a04"/><text x="450" y="404" text-anchor="middle" font-size="12" fill="#a16207">VIP-T1</text></g>
</svg>`
export type LayoutFixture = { overview: SeatLayoutOverview; svg: string; zones: SeatLayoutZoneDetail[] }
export const layouts = new Map<string, LayoutFixture>()
export function makeLayout(
  venueId: string,
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
      venue_id: venueId,
      name,
      version,
      layout_type: 'FOOTBALL',
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
makeLayout(uid('0193c100', 1), 'Sơ đồ sân · 4 khán đài', stadiumSvg, 1, uid('0193c400', 1))
makeLayout(uid('0193c100', 2), 'Sơ đồ khán phòng · Bản nháp', theaterSvg, 1, uid('0193c400', 2))
const outdoor = makeLayout(uid('0193c100', 5), 'Sơ đồ ngoài trời · Khu đứng & VIP', outdoorSvg, 1, uid('0193c400', 5))
outdoor.overview.layout_type = 'CONCERT'
makeLayout(uid('0193c100', 6), 'Khán đài chính · Nháp', stadiumSvg, 1, uid('0193c400', 6))
export const events: EventDetail[] = EVENTS.slice(0, 8).map((e, i) => {
  const d = structuredClone(detailOf(e))
  d.status = i === 6 ? 'DRAFT' : i === 7 ? 'CANCELLED' : 'PUBLISHED'
  d.venue = venues[0]
  d.showtimes = d.showtimes?.map((s, j) => ({
    ...s,
    id: uid('0193c300', i * 10 + j + 1),
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
        name: event?.zone_prices?.find((row) => row.zone_id === z.id)?.display_name ?? z.code,
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
