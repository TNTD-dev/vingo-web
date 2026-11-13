import { describe, expect, it } from 'vitest'
import { metricBucketLabel, previousPoint } from './metricFormat'

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
