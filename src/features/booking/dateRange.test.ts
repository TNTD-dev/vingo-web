import { describe, expect, it } from 'vitest'

import { vnStartOfDay } from '@/lib/time'

import { labelYmd, monthGrid, parseYmd, pickDate, rangeToIso, toYmd } from './dateRange'

describe('dateRange', () => {
  it('nhận ngày hợp lệ và loại ngày không có thật', () => {
    expect(parseYmd('2026-11-21')).toEqual({ year: 2026, month: 11, day: 21 })
    expect(parseYmd('2026-02-31')).toBeUndefined()
    expect(parseYmd('21/11/2026')).toBeUndefined()
  })

  it('đổi khoảng ngày thành mốc ISO, ngày cuối tính trọn ngày', () => {
    expect(rangeToIso('2026-11-21', '2026-11-23')).toEqual({
      from: vnStartOfDay(2026, 11, 21),
      to: vnStartOfDay(2026, 11, 24),
    })
    expect(rangeToIso('2026-11-23', '2026-11-21')).toBeUndefined()
  })

  it('bấm ngày: đầu, cuối, đảo thứ tự, rồi bắt đầu khoảng mới', () => {
    const a = pickDate({}, '2026-11-21')
    expect(a).toEqual({ from: '2026-11-21' })
    expect(pickDate(a, '2026-11-25')).toEqual({ from: '2026-11-21', to: '2026-11-25' })
    expect(pickDate(a, '2026-11-18')).toEqual({ from: '2026-11-18', to: '2026-11-21' })
    expect(pickDate({ from: '2026-11-18', to: '2026-11-21' }, '2026-12-01')).toEqual({ from: '2026-12-01' })
  })

  it('lưới tháng bắt đầu từ thứ Hai và tràn sang tháng kề', () => {
    const weeks = monthGrid(2026, 11) // 01/11/2026 là Chủ nhật
    expect(weeks[0][0].ymd).toBe('2026-10-26')
    expect(weeks[0][6]).toEqual({ ymd: '2026-11-01', day: 1, inMonth: true })
    expect(weeks.every((w) => w.length === 7)).toBe(true)
    expect(weeks.at(-1)?.at(-1)?.ymd).toBe('2026-12-06')
  })

  it('toYmd cuộn tháng và nhãn ẩn năm hiện tại', () => {
    expect(toYmd(2026, 13, 1)).toBe('2027-01-01')
    expect(labelYmd('2026-11-21', 2026)).toBe('21/11')
    expect(labelYmd('2027-01-02', 2026)).toBe('02/01/2027')
  })
})
