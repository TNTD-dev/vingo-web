import { describe, expect, it } from 'vitest'

import type { EventDetail, Showtime } from '@/api/generated/model'

import { bannerText, isSelectable, minPrice, seatBadge, sortShowtimes } from './eventDetailView'

describe('seatBadge', () => {
  it('hết vé là nhãn đỏ', () => {
    expect(seatBadge(0)).toEqual({ tone: 'danger', label: 'HẾT VÉ' })
  })

  it('còn ít (≤30) là cảnh báo, còn nhiều là xanh', () => {
    expect(seatBadge(18)).toEqual({ tone: 'warning', label: 'CÒN 18' })
    expect(seatBadge(30).tone).toBe('warning')
    expect(seatBadge(214)).toEqual({ tone: 'success', label: 'CÒN 214' })
  })
})

describe('sortShowtimes', () => {
  const st = (id: string, status: Showtime['status'], startsAt: string): Showtime => ({
    id,
    status,
    starts_at: startsAt,
  })

  it('đang bán trước, rồi sắp mở bán, rồi đã diễn ra; bỏ suất huỷ và nháp', () => {
    const sorted = sortShowtimes([
      st('finished', 'FINISHED', '2026-11-14T10:00:00Z'),
      st('cancelled', 'CANCELLED', '2026-11-20T10:00:00Z'),
      st('scheduled', 'SCHEDULED', '2026-11-29T12:15:00Z'),
      st('draft', 'DRAFT', '2026-11-30T10:00:00Z'),
      st('on-sale-late', 'ON_SALE', '2026-11-22T10:00:00Z'),
      st('on-sale', 'ON_SALE', '2026-11-21T10:00:00Z'),
    ])
    expect(sorted.map((s) => s.id)).toEqual(['on-sale', 'on-sale-late', 'scheduled', 'finished'])
  })
})

describe('isSelectable', () => {
  it('chỉ chọn được suất đang bán và còn vé', () => {
    expect(isSelectable({ status: 'ON_SALE' })).toBe(true)
    expect(isSelectable({ status: 'ON_SALE', sold_out: true })).toBe(false)
    expect(isSelectable({ status: 'SCHEDULED' })).toBe(false)
  })
})

describe('minPrice', () => {
  it('lấy giá thấp nhất, không có hạng vé thì undefined', () => {
    const tiers = [
      { name: 'A', price: 600_000 },
      { name: 'B', price: 120_000 },
    ]
    expect(minPrice({ price_tiers: tiers } as EventDetail)).toBe(120_000)
    expect(minPrice({} as EventDetail)).toBeUndefined()
  })
})

describe('bannerText', () => {
  it('bóng đá đủ hai đội thì tách tiêu đề và dòng giải', () => {
    const event = {
      title: 'V.League 2026 · Vòng 12: HAGL vs Hà Nội FC',
      category: 'FOOTBALL',
      attributes: { home_team: 'HAGL', away_team: 'Hà Nội FC', league: 'V.League 2026', round: 'Vòng 12' },
    } as EventDetail
    expect(bannerText(event)).toEqual({ title: 'HAGL vs Hà Nội FC', subtitle: 'V.League 2026 · Vòng 12' })
  })

  it('thiếu thuộc tính thì dùng nguyên tên sự kiện', () => {
    expect(bannerText({ title: 'Kịch “Lôi Vũ”', category: 'THEATER' } as EventDetail)).toEqual({
      title: 'Kịch “Lôi Vũ”',
    })
  })
})
