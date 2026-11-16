import { describe, expect, it } from 'vitest'
import {
  axisLabel,
  changeText,
  dayKeys,
  fillDays,
  metricBucketLabel,
  niceAxis,
  previousPoint,
  shortDimensionLabel,
  utcDayBounds,
} from './metricFormat'

describe('Nhãn và so sánh báo cáo', () => {
  it('hiển thị giờ Việt Nam và giữ ngày UTC theo bucket từ API', () => {
    expect(metricBucketLabel('2026-11-12T17:00:00Z', 'hour')).toBe('00:00')
    expect(metricBucketLabel('2026-11-12T18:00:00Z', 'hour')).toBe('01:00')
    expect(metricBucketLabel('2026-11-12', 'day')).toBe('12')
    expect(metricBucketLabel('A1-T1', 'zone')).toBe('A1-T1')
  })
  it('không ghép nhầm cột kỳ trước khi giữa chuỗi thiếu ngày', () => {
    const prior = [
      { key: '2026-11-01', value: 10 },
      { key: '2026-11-03', value: 30 },
    ]
    expect(previousPoint(prior, '2026-11-09', 'day', 7 * 86400000)).toBeUndefined()
    expect(previousPoint(prior, '2026-11-10', 'day', 7 * 86400000)?.value).toBe(30)
  })
  it('ghép khu theo mã, không phụ thuộc thứ tự trả về', () => {
    expect(
      previousPoint(
        [
          { key: 'B', value: 20 },
          { key: 'A', value: 10 },
        ],
        'A',
        'zone',
      )?.value,
    ).toBe(10)
  })
})

describe('Biểu đồ đủ ngày liên tục', () => {
  it('sinh đủ 14 khóa ngày liên tục qua ranh giới tháng', () => {
    const keys = dayKeys('2026-10-28', 14)
    expect(keys).toHaveLength(14)
    expect(keys[0]).toBe('2026-10-28')
    expect(keys[4]).toBe('2026-11-01')
    expect(keys[13]).toBe('2026-11-10')
  })
  it('ngày không có dữ liệu là cột 0, ngày có dữ liệu giữ nguyên giá trị', () => {
    const filled = fillDays([{ key: '2026-11-02', value: 500 }], ['2026-11-01', '2026-11-02', '2026-11-03'])
    expect(filled.map((p) => p.value)).toEqual([0, 500, 0])
  })
  it('khoảng ngày UTC bao trọn ngày cuối', () => {
    expect(utcDayBounds('2026-11-03', '2026-11-16')).toEqual({
      from: '2026-11-03T00:00:00.000Z',
      to: '2026-11-17T00:00:00.000Z',
    })
  })
  it('trục Y chọn đỉnh tròn và nhãn rút gọn', () => {
    expect(niceAxis(31_100_000)).toEqual({ top: 40_000_000, ticks: [0, 20_000_000, 40_000_000] })
    expect(niceAxis(0).ticks).toEqual([0, 0.5, 1])
    expect(axisLabel('revenue', 40_000_000)).toBe('40tr')
    expect(axisLabel('revenue', 750_000)).toBe('750k')
    expect(axisLabel('fill_rate', 50)).toBe('50%')
  })
})
describe('Huy hiệu thay đổi', () => {
  it('bằng nhau thì trung tính, không tô xanh', () => {
    expect(changeText('revenue', 100, 100)).toEqual({ tone: 'flat', text: 'Không đổi' })
    expect(changeText('fill_rate', 5, 5)?.tone).toBe('flat')
  })
  it('tăng/giảm có dấu và tông riêng; kỳ trước bằng 0 thì không tính %', () => {
    expect(changeText('revenue', 123, 100)).toEqual({ tone: 'up', text: '+23%' })
    expect(changeText('tickets_sold', 5, 10)?.tone).toBe('down')
    expect(changeText('revenue', 10, 0)).toBeNull()
  })
})
describe('Tên khu/hạng khi không map được', () => {
  it('rút gọn UUID thay vì hiển thị nguyên chuỗi', () => {
    expect(shortDimensionLabel('zone', '0194a0d2-aaaa-7bbb-8ccc-1234567890ab')).toBe('Khu …90ab')
    expect(shortDimensionLabel('tier', '0194a0d2-aaaa-7bbb-8ccc-1234567890ab')).toBe('Hạng …90ab')
  })
})
