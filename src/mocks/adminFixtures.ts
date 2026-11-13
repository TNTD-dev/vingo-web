import type { EventDetail, EventSummary, Showtime } from '@/api/generated/model'

import concert from './posters/concert.jpg'
import market from './posters/market.jpg'
import stadium from './posters/stadium.jpg'
import theater from './posters/theater.jpg'

/** Du lieu su kien cho demo admin. */
export const EVENTS: EventSummary[] = [
  ev(
    1,
    'V.League 2026 · Vòng 12: HAGL vs Hà Nội FC',
    'FOOTBALL',
    stadium,
    'SVĐ Thống Nhất',
    'HCM',
    '2026-11-21T10:00:00Z',
    120_000,
    true,
  ),
  ev(
    2,
    'Đêm nhạc “Mùa Hè Xanh” — Live in Saigon',
    'CONCERT',
    concert,
    'SVĐ Quân khu 7',
    'HCM',
    '2026-11-21T13:00:00Z',
    800_000,
    true,
  ),
  ev(
    3,
    'Kịch “Lôi Vũ” — suất tối cuối tuần',
    'THEATER',
    theater,
    'Nhà hát Bến Thành',
    'HCM',
    '2026-11-22T12:30:00Z',
    350_000,
    true,
  ),
  ev(
    4,
    'Acoustic Night — Những bản tình ca',
    'CONCERT',
    concert,
    'Saigon Riverside',
    'HCM',
    '2026-11-22T13:30:00Z',
    450_000,
    true,
  ),
  ev(
    5,
    'Cúp Quốc gia · Tứ kết: TP.HCM vs Bình Dương',
    'FOOTBALL',
    stadium,
    'SVĐ Thống Nhất',
    'HCM',
    '2026-11-21T12:00:00Z',
    80_000,
    false,
  ),
  ev(
    6,
    'Saigon Weekend Market & Live Music',
    'OTHER',
    market,
    'Công viên Gia Định',
    'HCM',
    '2026-11-21T09:00:00Z',
    150_000,
    true,
  ),
  ev(
    7,
    'V.League 2026 · Vòng 13: Hà Nội FC vs Viettel',
    'FOOTBALL',
    stadium,
    'SVĐ Hàng Đẫy',
    'HN',
    '2026-11-28T12:00:00Z',
    100_000,
    true,
  ),
  ev(8, 'Hà Nội Jazz Night', 'CONCERT', concert, 'Nhà hát Lớn Hà Nội', 'HN', '2026-11-14T13:00:00Z', 600_000, true),
  ev(
    9,
    'Vở “Hồn Trương Ba, da hàng thịt”',
    'THEATER',
    theater,
    'Nhà hát Tuổi Trẻ',
    'HN',
    '2026-12-05T12:00:00Z',
    250_000,
    true,
  ),
  ev(10, 'Đà Nẵng Beach Festival', 'OTHER', market, 'Bãi biển Mỹ Khê', 'DN', '2026-12-12T10:00:00Z', 0, true),
  ev(
    11,
    'SHB Đà Nẵng vs Becamex Bình Dương',
    'FOOTBALL',
    stadium,
    'SVĐ Hoà Xuân',
    'DN',
    '2026-12-06T11:00:00Z',
    70_000,
    true,
  ),
  ev(
    12,
    'Countdown 2027 — Đại nhạc hội',
    'CONCERT',
    concert,
    'Phố đi bộ Nguyễn Huệ',
    'HCM',
    '2026-12-31T14:00:00Z',
    1_500_000,
    true,
  ),
  ev(
    13,
    'Nhạc kịch “Những người khốn khổ”',
    'THEATER',
    theater,
    'Nhà hát Thành phố',
    'HCM',
    '2026-12-19T12:30:00Z',
    900_000,
    true,
  ),
  ev(14, 'Chợ phiên Giáng sinh', 'OTHER', market, 'Công viên Tao Đàn', 'HCM', '2026-12-24T09:00:00Z', 50_000, true),
]

function ev(
  n: number,
  title: string,
  category: EventSummary['category'],
  poster_url: string,
  venue_name: string,
  city: EventSummary['city'],
  first_starts_at: string,
  price_from: number,
  on_sale: boolean,
): EventSummary {
  const city_name = { HCM: 'TP. Hồ Chí Minh', HN: 'Hà Nội', DN: 'Đà Nẵng' }[city ?? 'HCM']
  const id = `0193b000-0000-7000-8000-${String(n).padStart(12, '0')}`
  return { id, title, category, poster_url, venue_name, city, city_name, first_starts_at, price_from, on_sale }
}

const VENUE = {
  id: '0193b100-0000-7000-8000-000000000001',
  name: 'SVĐ Thống Nhất',
  type: 'STADIUM' as const,
  address: '138 Đào Duy Từ, Q.10',
  city: 'HCM' as const,
  city_name: 'TP. Hồ Chí Minh',
}

const TIERS = [
  { id: '0193b200-0000-7000-8000-000000000001', name: 'Hạng 1', price: 1_200_000 },
  { id: '0193b200-0000-7000-8000-000000000002', name: 'Hạng 2', price: 600_000 },
  { id: '0193b200-0000-7000-8000-000000000003', name: 'Hạng 3', price: 300_000 },
  { id: '0193b200-0000-7000-8000-000000000004', name: 'Khu đứng', price: 120_000 },
]

function showtime(n: number, eventId: string, status: Showtime['status'], startsAt: string, endsAt: string): Showtime {
  return {
    id: `0193b300-0000-7000-8000-${String(n).padStart(12, '0')}`,
    event_id: eventId,
    status,
    sold_out: false,
    venue: VENUE,
    starts_at: startsAt,
    ends_at: endsAt,
    sale_opens_at: status === 'SCHEDULED' ? '2026-11-22T03:00:00Z' : '2026-10-01T03:00:00Z',
    sale_closes_at: endsAt,
  }
}

export function detailOf(summary: EventSummary): EventDetail {
  const eventId = summary.id ?? ''
  return {
    id: eventId,
    title: summary.title,
    category: summary.category,
    status: 'PUBLISHED',
    description:
      'Trận cầu tâm điểm vòng 12 giữa Hoàng Anh Gia Lai và Hà Nội FC. Cổng mở lúc 15:30, khuyến khích đến sớm để ổn định chỗ ngồi. Vé điện tử QR được gửi qua email ngay khi thanh toán thành công.',
    attributes: { league: 'V.League 2026', round: 'Vòng 12', home_team: 'HAGL', away_team: 'Hà Nội FC' },
    poster_desktop_url: summary.poster_url,
    poster_mobile_url: summary.poster_url,
    max_tickets_per_order: 6,
    venue: { ...VENUE, name: summary.venue_name ?? VENUE.name },
    price_tiers: TIERS,
    showtimes: [
      showtime(1, eventId, 'ON_SALE', '2026-11-21T10:00:00Z', '2026-11-21T12:00:00Z'),
      showtime(2, eventId, 'SCHEDULED', '2026-11-29T12:15:00Z', '2026-11-29T14:15:00Z'),
      showtime(3, eventId, 'FINISHED', '2026-11-14T10:00:00Z', '2026-11-14T12:00:00Z'),
    ],
  }
}
