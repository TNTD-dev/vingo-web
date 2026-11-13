import { CityCode, EventCategory, SearchEventsSort, type SearchEventsParams } from '@/api/generated/model'
import { vnDate, vnStartOfDay } from '@/lib/time'

import { parseYmd, rangeToIso, type Ymd } from './dateRange'

/*
 * Bộ lọc màn Khám phá sự kiện (Figma B1). Trạng thái nằm trên URL để chia sẻ link được và
 * để tab Bóng đá / Concert / Sân khấu trên AppNav dùng chung tham số `category`.
 */

export const CATEGORY_LABEL: Record<EventCategory, string> = {
  FOOTBALL: 'Bóng đá',
  CONCERT: 'Concert',
  THEATER: 'Sân khấu',
  OTHER: 'Khác',
}

export const CITY_LABEL: Record<CityCode, string> = { HCM: 'TP. HCM', HN: 'Hà Nội', DN: 'Đà Nẵng' }
export const CITY_FULL_NAME: Record<CityCode, string> = {
  HCM: 'TP. Hồ Chí Minh',
  HN: 'Hà Nội',
  DN: 'Đà Nẵng',
}

export const SORT_LABEL: Record<SearchEventsSort, string> = {
  relevance: 'Phù hợp nhất',
  starts_at: 'Sắp diễn ra',
  price: 'Giá thấp nhất',
  popularity: 'Phổ biến nhất',
}

export const WHEN = ['today', 'weekend', 'month'] as const
export type When = (typeof WHEN)[number]

/** Thanh trượt giá: 0 → 5.000.000₫, bước 100.000₫. Kéo hết cỡ = không giới hạn giá. */
export const PRICE_LIMIT = 5_000_000
export const PRICE_STEP = 100_000

export type EventFilters = {
  q?: string
  category?: EventCategory
  city?: CityCode
  when?: When
  /** Khoảng ngày tự chọn (giờ Việt Nam, gồm cả ngày cuối). Loại trừ với `when`. */
  from?: Ymd
  to?: Ymd
  priceMax?: number
  /** Chỉ hiện sự kiện còn mở bán. API chưa có tham số này nên lọc ở client trên trang đã tải. */
  available: boolean
  sort: SearchEventsSort
}

function oneOf<T extends string>(values: readonly T[], v: string | null): T | undefined {
  return values.find((x) => x === v)
}

export function readFilters(params: URLSearchParams): EventFilters {
  const price = Number(params.get('price_max'))
  const when = oneOf(WHEN, params.get('when'))
  const fromRaw = params.get('from')
  const toRaw = params.get('to')
  const custom =
    !when && parseYmd(fromRaw) && parseYmd(toRaw) && fromRaw! <= toRaw! ? { from: fromRaw!, to: toRaw! } : {}
  return {
    q: params.get('q')?.trim() || undefined,
    category: oneOf(Object.values(EventCategory), params.get('category')),
    city: oneOf(Object.values(CityCode), params.get('city')),
    when,
    ...custom,
    priceMax: Number.isInteger(price) && price > 0 && price < PRICE_LIMIT ? price : undefined,
    available: params.get('available') === '1',
    sort: oneOf(Object.values(SearchEventsSort), params.get('sort')) ?? 'relevance',
  }
}

/** Ghi bộ lọc ra URL, bỏ các giá trị mặc định cho link gọn. */
export function writeFilters(f: EventFilters): URLSearchParams {
  const p = new URLSearchParams()
  if (f.q) p.set('q', f.q)
  if (f.category) p.set('category', f.category)
  if (f.city) p.set('city', f.city)
  if (f.when) p.set('when', f.when)
  else if (f.from && f.to) {
    p.set('from', f.from)
    p.set('to', f.to)
  }
  if (f.priceMax !== undefined && f.priceMax < PRICE_LIMIT) p.set('price_max', String(f.priceMax))
  if (f.available) p.set('available', '1')
  if (f.sort !== 'relevance') p.set('sort', f.sort)
  return p
}

/** Khoảng thời gian [from, to) theo giờ Việt Nam cho từng lựa chọn nhanh. */
export function whenRange(when: When, now: Date): { from: string; to: string } {
  const { year, month, day, weekday } = vnDate(now)
  switch (when) {
    case 'today':
      return { from: vnStartOfDay(year, month, day), to: vnStartOfDay(year, month, day + 1) }
    case 'weekend': {
      // Thứ 7 + CN của tuần này; đang là CN thì thứ 7 là hôm qua.
      const saturday = weekday === 0 ? day - 1 : day + (6 - weekday)
      return { from: vnStartOfDay(year, month, saturday), to: vnStartOfDay(year, month, saturday + 2) }
    }
    case 'month':
      // Tháng sau (Figma: hôm nay 12/11 → "Tháng 12").
      return { from: vnStartOfDay(year, month + 1, 1), to: vnStartOfDay(year, month + 2, 1) }
  }
}

export function whenLabel(when: When, now: Date): string {
  if (when === 'today') return 'Hôm nay'
  if (when === 'weekend') return 'Cuối tuần này'
  return `Tháng ${(vnDate(now).month % 12) + 1}`
}

export function toSearchParams(f: EventFilters, now: Date): SearchEventsParams {
  return {
    q: f.q,
    category: f.category,
    city: f.city,
    ...(f.when ? whenRange(f.when, now) : f.from && f.to ? rangeToIso(f.from, f.to) : {}),
    price_max: f.priceMax,
    // Backend chỉ nhận sort=relevance khi có từ khoá q; không có q thì bỏ tham số để dùng mặc định của backend.
    sort: f.sort === 'relevance' && !f.q ? undefined : f.sort,
    limit: 12,
  }
}

export function hasActiveFilters(f: EventFilters): boolean {
  return Boolean(f.category || f.city || f.when || f.from || f.priceMax !== undefined || f.available)
}
