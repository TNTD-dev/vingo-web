import { describe, expect, it } from 'vitest'

import { vnStartOfDay } from '@/lib/time'

import {
  effectiveSort,
  readFilters,
  sortOptions,
  toSearchParams,
  whenLabel,
  whenRange,
  writeFilters,
} from './eventFilters'

// Thứ 5, 12/11/2026, 10:00 giờ Việt Nam
const THURSDAY = new Date('2026-11-12T03:00:00Z')

describe('readFilters', () => {
  it('bỏ qua giá trị lạ trên URL', () => {
    const f = readFilters(new URLSearchParams('category=XYZ&city=SG&when=year&price_max=abc&sort=hot'))
    expect(f).toEqual({
      q: undefined,
      category: undefined,
      city: undefined,
      when: undefined,
      priceMax: undefined,
      available: false,
      sort: undefined,
    })
  })

  it('đọc đủ bộ lọc hợp lệ', () => {
    const f = readFilters(
      new URLSearchParams(
        'q= Sơn Tùng &category=CONCERT&city=HN&when=weekend&price_max=1000000&available=1&sort=price',
      ),
    )
    expect(f).toEqual({
      q: 'Sơn Tùng',
      category: 'CONCERT',
      city: 'HN',
      when: 'weekend',
      priceMax: 1_000_000,
      available: true,
      sort: 'price',
    })
  })

  it('giá kéo hết cỡ coi như không giới hạn', () => {
    expect(readFilters(new URLSearchParams('price_max=5000000')).priceMax).toBeUndefined()
  })
})

describe('writeFilters', () => {
  it('ghi rồi đọc lại ra cùng bộ lọc, bỏ giá trị mặc định', () => {
    const f = readFilters(new URLSearchParams('category=FOOTBALL&when=today&available=1'))
    const p = writeFilters(f)
    expect(p.toString()).toBe('category=FOOTBALL&when=today&available=1')
    expect(readFilters(p)).toEqual(f)
  })
})

describe('whenRange', () => {
  it('hôm nay: từ 00:00 tới 00:00 hôm sau, giờ Việt Nam', () => {
    expect(whenRange('today', THURSDAY)).toEqual({ from: vnStartOfDay(2026, 11, 12), to: vnStartOfDay(2026, 11, 13) })
  })

  it('cuối tuần: thứ 7 và chủ nhật sắp tới', () => {
    expect(whenRange('weekend', THURSDAY)).toEqual({
      from: vnStartOfDay(2026, 11, 14),
      to: vnStartOfDay(2026, 11, 16),
    })
  })

  it('đang chủ nhật thì cuối tuần là thứ 7 hôm qua và hôm nay', () => {
    const sunday = new Date('2026-11-15T03:00:00Z')
    expect(whenRange('weekend', sunday)).toEqual({ from: vnStartOfDay(2026, 11, 14), to: vnStartOfDay(2026, 11, 16) })
  })

  it('tháng: trọn tháng sau, tháng 12 thì sang tháng 1 năm sau', () => {
    expect(whenRange('month', THURSDAY)).toEqual({ from: vnStartOfDay(2026, 12, 1), to: vnStartOfDay(2027, 1, 1) })
    expect(whenLabel('month', THURSDAY)).toBe('Tháng 12')
    expect(whenLabel('month', new Date('2026-12-05T03:00:00Z'))).toBe('Tháng 1')
  })
})

describe('toSearchParams', () => {
  it('đổi bộ lọc sang tham số API', () => {
    const f = readFilters(new URLSearchParams('category=THEATER&when=today&price_max=800000'))
    expect(toSearchParams(f, THURSDAY)).toEqual({
      q: undefined,
      category: 'THEATER',
      city: undefined,
      from: vnStartOfDay(2026, 11, 12),
      to: vnStartOfDay(2026, 11, 13),
      price_max: 800_000,
      sort: undefined,
      limit: 12,
    })
  })

  it('không gửi sort=relevance khi không có từ khoá (backend trả 400)', () => {
    expect(toSearchParams(readFilters(new URLSearchParams('sort=relevance')), THURSDAY).sort).toBeUndefined()
  })

  it('giữ sort do người dùng chọn và relevance khi có từ khoá', () => {
    expect(toSearchParams(readFilters(new URLSearchParams('sort=price')), THURSDAY).sort).toBe('price')
    expect(toSearchParams(readFilters(new URLSearchParams('q=abc&sort=relevance')), THURSDAY).sort).toBe('relevance')
  })
})

describe('effectiveSort / sortOptions', () => {
  it('không có từ khoá thì mặc định starts_at và ẩn relevance', () => {
    const f = readFilters(new URLSearchParams(''))
    expect(effectiveSort(f)).toBe('starts_at')
    expect(sortOptions(f)).not.toContain('relevance')
  })

  it('có từ khoá thì mặc định relevance', () => {
    const f = readFilters(new URLSearchParams('q=abc'))
    expect(effectiveSort(f)).toBe('relevance')
    expect(sortOptions(f)).toContain('relevance')
  })
})
