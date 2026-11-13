import { describe, expect, it } from 'vitest'

import {
  formatDateRange,
  formatDayMonthTime,
  formatEventDateTime,
  formatShortDateTime,
  formatTimeRange,
  showtimeDayBox,
  vnDate,
  vnStartOfDay,
} from './time'

describe('formatEventDateTime', () => {
  it('đổi sang giờ Việt Nam kèm thứ viết tắt', () => {
    expect(formatEventDateTime('2026-11-21T10:00:00Z')).toBe('17:00 · T7, 21/11/2026')
  })

  it('chủ nhật viết là CN, và qua nửa đêm UTC thì sang ngày Việt Nam', () => {
    // 2026-11-21 17:30 UTC = 00:30 CN 22/11 giờ Việt Nam
    expect(formatEventDateTime('2026-11-21T17:30:00Z')).toBe('00:30 · CN, 22/11/2026')
  })
})

describe('vnDate / vnStartOfDay', () => {
  it('lấy ngày theo giờ Việt Nam, không theo UTC', () => {
    expect(vnDate(new Date('2026-11-12T18:00:00Z'))).toEqual({ year: 2026, month: 11, day: 13, weekday: 5 })
  })

  it('00:00 giờ Việt Nam là 17:00 UTC hôm trước', () => {
    expect(vnStartOfDay(2026, 11, 21)).toBe('2026-11-20T17:00:00.000Z')
  })

  it('ngày tràn cuộn sang tháng sau', () => {
    expect(vnStartOfDay(2026, 11, 31)).toBe(vnStartOfDay(2026, 12, 1))
  })
})

describe('formatDateRange', () => {
  it('cùng năm chỉ ghi năm ở đầu phải, mốc cuối loại trừ', () => {
    expect(formatDateRange(vnStartOfDay(2026, 11, 21), vnStartOfDay(2026, 11, 24))).toBe('21/11 – 23/11/2026')
  })

  it('khác năm ghi năm cả hai đầu', () => {
    expect(formatDateRange(vnStartOfDay(2026, 12, 28), vnStartOfDay(2027, 1, 4))).toBe('28/12/2026 – 03/01/2027')
  })
})

describe('formatTimeRange / showtimeDayBox / formatDayMonthTime', () => {
  it('ghi khoảng giờ theo giờ Việt Nam', () => {
    expect(formatTimeRange('2026-11-21T10:00:00Z', '2026-11-21T12:00:00Z')).toBe('17:00 – 19:00')
    expect(formatTimeRange('2026-11-21T10:00:00Z')).toBe('17:00')
  })

  it('ô ngày có thứ, ngày và tháng', () => {
    expect(showtimeDayBox('2026-11-21T10:00:00Z')).toEqual({ weekday: 'T7', day: '21', month: 'THG 11' })
    expect(showtimeDayBox('2026-11-29T12:15:00Z')).toEqual({ weekday: 'CN', day: '29', month: 'THG 11' })
  })

  it('mốc mở bán dạng ngày/tháng, giờ', () => {
    expect(formatDayMonthTime('2026-11-22T03:00:00Z')).toBe('22/11, 10:00')
  })
})

describe('formatShortDateTime', () => {
  it('giờ, thứ, ngày/tháng theo giờ Việt Nam', () => {
    expect(formatShortDateTime('2026-11-21T10:00:00Z')).toBe('17:00 T7 21/11')
  })
})
