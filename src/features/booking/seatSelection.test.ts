import { describe, expect, it } from 'vitest'

import type { GetAvailability200ZonesItem } from '@/api/generated/model'
import type { ZoneRef } from '@/seatmap/svg'

import {
  buildMapModel,
  compressZoneCodes,
  holdBody,
  previewTotal,
  standingLimit,
  toggleSeat,
  type PickedSeat,
} from './seatSelection'

const seat = (id: string, price = 100_000, pair?: string): PickedSeat => ({
  seatId: id,
  svgId: `SEAT__A1-T1__A__${id}`,
  zoneCode: 'A1-T1',
  zoneName: 'A1',
  row: 'A',
  number: Number(id.replace(/\D/g, '')) || 1,
  price,
  pairSeatId: pair,
})

describe('compressZoneCodes', () => {
  it('bỏ hậu tố tầng và L/R, gộp số liền nhau cùng chữ', () => {
    expect(compressZoneCodes(['A3-T1', 'A4-T1', 'A5-T1', 'A6-T1', 'B1-T1', 'C3-T1', 'D3-T1'])).toBe('A3–A6, B1, C3, D3')
    expect(compressZoneCodes(['A1-T1', 'A2L-T1', 'A2R-T1'])).toBe('A1, A2')
  })

  it('hai khu liền nhau không gộp thành khoảng', () => {
    expect(compressZoneCodes(['B2L-T1', 'B3-T1'])).toBe('B2, B3')
  })

  it('khu không có số (C-T2) giữ nguyên chữ', () => {
    expect(compressZoneCodes(['C-T2', 'D-T2', 'B11-T2', 'B12-T2', 'B13-T2'])).toBe('B11–B13, C, D')
  })
})

describe('buildMapModel', () => {
  const zones: ZoneRef[] = [
    { code: 'A1-T1', kind: 'SEATED' },
    { code: 'B1-T1', kind: 'SEATED' },
    { code: 'C1-T1', kind: 'SEATED' },
    { code: 'C-T2', kind: 'STANDING' },
  ]
  const avail: GetAvailability200ZonesItem[] = [
    { zone_id: 'z1', name: 'A1', tier: { name: 'x', price: 1_200_000 }, seats_left: 148 },
    { zone_id: 'z2', name: 'B1', tier: { name: 'x', price: 600_000 }, seats_left: 0 },
    { zone_id: 'z3', name: 'C-T2', tier: { name: 'x', price: 120_000 }, seats_left: 500 },
  ]
  const m = buildMapModel(zones, avail)

  it('hạng 1 là giá cao nhất; khu đứng có hạng riêng', () => {
    expect(m.zones['A1-T1']).toEqual({ tier: 1, soldOut: false })
    expect(m.zones['B1-T1']).toEqual({ tier: 2, soldOut: true })
    expect(m.zones['C-T2']).toEqual({ tier: undefined, soldOut: false })
  })

  it('khu không có trong availability coi như hết vé', () => {
    expect(m.zones['C1-T1']).toEqual({ tier: undefined, soldOut: true })
  })

  it('danh sách hạng: khu ngồi theo giá giảm, khu đứng cuối', () => {
    expect(m.tiers.map((t) => [t.key, t.label, t.price, t.zones])).toEqual([
      [1, 'Hạng 1', 1_200_000, 'A1'],
      [2, 'Hạng 2', 600_000, 'B1'],
      ['standing', 'Khu đứng', 120_000, 'C'],
    ])
  })
})

describe('toggleSeat', () => {
  it('chọn rồi bỏ chọn cùng một ghế', () => {
    const a = seat('s1')
    const added = toggleSeat([], a, undefined, 6)
    expect(added.picks).toEqual([a])
    expect(toggleSeat(added.picks, a, undefined, 6).picks).toEqual([])
  })

  it('vượt giới hạn vé mỗi đơn thì giữ nguyên và báo lỗi', () => {
    const picks = [seat('s1'), seat('s2')]
    const r = toggleSeat(picks, seat('s3'), undefined, 2)
    expect(r.error).toBe('MAX_TICKETS')
    expect(r.picks).toEqual(picks)
  })

  it('ghế đôi chọn cả cặp, tính cả hai vào giới hạn, bỏ một là bỏ cả hai', () => {
    const a = seat('s1', 100, 's2')
    const b = seat('s2', 100, 's1')
    const added = toggleSeat([], a, b, 6)
    expect(added.picks.map((p) => p.seatId)).toEqual(['s1', 's2'])
    expect(toggleSeat([], a, b, 1).error).toBe('MAX_TICKETS')
    expect(toggleSeat(added.picks, b, a, 6).picks).toEqual([])
  })
})

describe('holdBody / previewTotal / standingLimit', () => {
  const standing = { zoneId: 'z3', zoneCode: 'C-T2', zoneName: 'C', price: 120_000, quantity: 3, left: 500 }

  it('khu đứng gửi zone_id + quantity, khu ngồi gửi seat_ids, chưa chọn thì null', () => {
    expect(holdBody([], standing)).toEqual({ zone_id: 'z3', quantity: 3 })
    expect(holdBody([seat('s1'), seat('s2')], null)).toEqual({ seat_ids: ['s1', 's2'] })
    expect(holdBody([], null)).toBeNull()
    expect(holdBody([], { ...standing, quantity: 0 })).toBeNull()
  })

  it('tạm tính cộng giá từng ghế hoặc giá khu đứng × số lượng', () => {
    expect(previewTotal([seat('s1', 1_200_000), seat('s2', 600_000)], null)).toBe(1_800_000)
    expect(previewTotal([], standing)).toBe(360_000)
  })

  it('khu đứng bị chặn bởi giới hạn đơn và số chỗ còn', () => {
    expect(standingLimit(6, 500)).toBe(6)
    expect(standingLimit(6, 2)).toBe(2)
    expect(standingLimit(6, 0)).toBe(0)
  })
})
