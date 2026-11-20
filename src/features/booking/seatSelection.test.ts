import { describe, expect, it } from 'vitest'

import type { GetAvailability200ZonesItem } from '@/api/generated/model'
import type { ZoneRef } from '@/seatmap/svg'

import { buildMapModel, holdBody, previewTotal, standingLimit, toggleSeat, type PickedSeat } from './seatSelection'

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

describe('buildMapModel', () => {
  const zones: ZoneRef[] = [
    { code: 'A1-T1', kind: 'SEATED' },
    { code: 'B1-T1', kind: 'SEATED' },
    { code: 'C1-T1', kind: 'SEATED' },
    { code: 'C-T2', kind: 'STANDING' },
  ]
  const avail: GetAvailability200ZonesItem[] = [
    { zone_id: 'z1', name: 'A1', tier: { name: 'VIP-1', price: 1_200_000 }, seats_left: 148 },
    { zone_id: 'z2', name: 'B1', tier: { name: 'VIP-2', price: 600_000 }, seats_left: 0 },
    { zone_id: 'z3', name: 'C-T2', tier: { name: 'GA', price: 120_000 }, seats_left: 500 },
  ]
  const m = buildMapModel(zones, avail)

  it('hạng 1 là giá cao nhất; khu đứng có hạng riêng', () => {
    expect(m.zones['A1-T1']).toEqual({ tier: 1, soldOut: false })
    expect(m.zones['B1-T1']).toEqual({ tier: 2, soldOut: true })
    expect(m.zones['C-T2']).toEqual({ tier: 3, soldOut: false })
  })

  it('khu không có trong availability coi như hết vé', () => {
    expect(m.zones['C1-T1']).toEqual({ tier: undefined, soldOut: true })
  })

  it('khớp mã SVG khi khu có tên riêng theo sự kiện', () => {
    const named = { ...avail[0], code: 'A1-T1', name: 'Khán đài chính', tier: { ...avail[0].tier!, color: '#86BDF6' } }
    const map = buildMapModel(zones, [named])
    expect(map.byCode['A1-T1'].name).toBe('Khán đài chính')
    expect(map.zones['A1-T1']).toMatchObject({ color: '#86BDF6', soldOut: false })
  })

  it('giữ màu riêng của hai hạng cùng giá', () => {
    const map = buildMapModel(zones, [
      { ...avail[0], tier: { id: 'vip-a', name: 'VIP A', price: 500_000, color: '#F78888' } },
      { ...avail[1], tier: { id: 'vip-b', name: 'VIP B', price: 500_000, color: '#F5BF70' } },
    ])

    expect(map.tiers.map(({ key, color }) => [key, color])).toEqual([
      [1, '#F78888'],
      [2, '#F5BF70'],
    ])
    expect(map.zones['A1-T1']).toMatchObject({ tier: 1, color: '#F78888' })
    expect(map.zones['B1-T1']).toMatchObject({ tier: 2, color: '#F5BF70' })
  })

  it('danh sách hạng dùng tên và giá cấu hình, không chứa mã khu', () => {
    expect(m.tiers).toEqual([
      { key: 1, label: 'VIP-1', price: 1_200_000, standingOnly: false },
      { key: 2, label: 'VIP-2', price: 600_000, standingOnly: false },
      { key: 3, label: 'GA', price: 120_000, standingOnly: true },
    ])
  })
  it('hiển thị hai hạng khu đứng riêng theo cấu hình', () => {
    const map = buildMapModel(
      [...zones, { code: 'D-T2', kind: 'STANDING' }],
      [avail[2], { zone_id: 'z4', name: 'D-T2', tier: { id: 'fan', name: 'Fan Zone', price: 240_000 }, seats_left: 7 }],
    )
    expect(map.tiers.map(({ label }) => label)).toEqual(['Fan Zone', 'GA'])
    expect(map.zones['D-T2'].tier).toBe(1)
    expect(map.zones['C-T2'].tier).toBe(2)
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

import { ApiError } from '@/api/problem'
import type { Problem } from '@/api/generated/model'

import { describeHoldError } from './seatSelection'

const problem = (status: number, code: string, extra: Record<string, unknown> = {}) =>
  new ApiError(status, { title: 't', status, code, ...extra } as Problem)

describe('describeHoldError', () => {
  it('SEAT_TAKEN kèm gợi ý: trả ghế bị giữ và ghế gợi ý, bỏ khoá', () => {
    const f = describeHoldError(
      problem(409, 'SEAT_TAKEN', { taken_seat_ids: ['a'], suggested_seat_ids: ['b', 'c'] }),
      6,
    )
    expect(f.takenSeatIds).toEqual(['a'])
    expect(f.suggestedSeatIds).toEqual(['b', 'c'])
    expect(f.refresh).toBe(true)
    expect(f.retrySameKey).toBe(false)
    expect(f.message).toContain('gợi ý')
  })
  it('NOT_ENOUGH_STOCK nói rõ số chỗ còn lại', () => {
    expect(describeHoldError(problem(409, 'NOT_ENOUGH_STOCK', { seats_left: 2 }), 6).message).toContain('còn 2 chỗ')
  })
  it('MAX_TICKETS_EXCEEDED nêu giới hạn', () => {
    expect(describeHoldError(problem(422, 'MAX_TICKETS_EXCEEDED'), 4).message).toContain('4 vé')
  })
  it('429 và lỗi mạng giữ khoá để retry cùng thao tác', () => {
    expect(describeHoldError(problem(429, 'RATE_LIMITED'), 6).retrySameKey).toBe(true)
    expect(describeHoldError(new Error('network'), 6).retrySameKey).toBe(true)
  })
})
