import { describe, expect, it } from 'vitest'
import { dayGroupLabel, elapsedText, groupByDay, initials, maskPhone, remainingText, vnDayKey } from './format'

describe('Gom đơn theo ngày giờ Việt Nam', () => {
  it('đơn lúc 20:00 UTC thuộc ngày hôm sau theo giờ VN, mỗi đơn đúng một nhóm', () => {
    const rows = [
      { id: 'a', at: '2026-11-16T07:28:00Z' },
      { id: 'b', at: '2026-11-15T20:00:00Z' },
      { id: 'c', at: '2026-11-15T12:00:00Z' },
      { id: 'd', at: '2026-11-14T14:47:00Z' },
    ]
    expect(vnDayKey(rows[1].at)).toBe('2026-11-16')
    const groups = groupByDay(rows, (r) => r.at)
    expect(groups.map((g) => [g.key, g.items.map((i) => i.id)])).toEqual([
      ['2026-11-16', ['a', 'b']],
      ['2026-11-15', ['c']],
      ['2026-11-14', ['d']],
    ])
  })
  it('nhãn nhóm: hôm nay, hôm qua, các ngày trước chỉ có thứ và ngày', () => {
    expect(dayGroupLabel('2026-11-16', '2026-11-16')).toBe('HÔM NAY · THỨ HAI 16/11')
    expect(dayGroupLabel('2026-11-15', '2026-11-16')).toBe('HÔM QUA · CHỦ NHẬT 15/11')
    expect(dayGroupLabel('2026-11-14', '2026-11-16')).toBe('THỨ BẢY 14/11')
  })
})
describe('Thời gian chờ và che dữ liệu', () => {
  const now = new Date('2026-11-16T07:00:00Z')
  it('làm tròn xuống đơn vị lớn nhất', () => {
    expect(elapsedText('2026-11-09T10:20:00Z', now)).toBe('6 ngày')
    expect(elapsedText('2026-11-16T02:10:00Z', now)).toBe('4 giờ')
    expect(elapsedText('2026-11-16T06:48:00Z', now)).toBe('12 phút')
    expect(elapsedText('2026-11-16T06:59:50Z', now)).toBe('vừa xong')
  })
  it('thời gian còn lại: đã qua thì không có', () => {
    expect(remainingText('2026-11-16T07:06:00Z', now)).toBe('6 phút')
    expect(remainingText('2026-11-16T06:00:00Z', now)).toBeNull()
  })
  it('che số điện thoại và lấy chữ cái đầu tên', () => {
    expect(maskPhone('0912345678')).toBe('09•• ••• 678')
    expect(maskPhone(null)).toBe('—')
    expect(initials('Nguyễn Văn Mua')).toBe('NM')
    expect(initials('')).toBe('?')
  })
})
