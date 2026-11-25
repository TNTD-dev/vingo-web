import { describe, expect, it } from 'vitest'

import { buildNotifications, relativeTime } from './notifications'

const NOW = new Date('2026-11-21T10:00:00Z').getTime()

describe('buildNotifications', () => {
  it('đơn PAID tạo thông báo vé đã phát hành, trỏ tới /tickets', () => {
    const [n] = buildNotifications(
      [{ id: 'a', code: 'VG-1', status: 'PAID', paid_at: '2026-11-21T09:59:00Z', items: [{ quantity: 2 }] }],
      NOW,
    )
    expect(n.title).toContain('2 vé')
    expect(n.to).toBe('/tickets')
  })
  it('đơn PENDING hết hạn không có thông báo; còn hạn có nút thanh toán', () => {
    const live = buildNotifications(
      [
        {
          id: 'a',
          code: 'VG-1',
          status: 'PENDING',
          created_at: '2026-11-21T09:50:00Z',
          expires_at: '2026-11-21T10:06:00Z',
        },
      ],
      NOW,
    )
    expect(live[0].action?.to).toBe('/orders/a/checkout')
    const dead = buildNotifications(
      [
        {
          id: 'a',
          code: 'VG-1',
          status: 'PENDING',
          created_at: '2026-11-21T09:30:00Z',
          expires_at: '2026-11-21T09:40:00Z',
        },
      ],
      NOW,
    )
    expect(dead).toHaveLength(0)
  })
})

describe('relativeTime', () => {
  it('chọn đơn vị theo độ xa', () => {
    expect(relativeTime('2026-11-21T09:59:50Z', NOW)).toBe('Vừa xong')
    expect(relativeTime('2026-11-21T09:55:00Z', NOW)).toBe('5 phút')
    expect(relativeTime('2026-11-21T07:00:00Z', NOW)).toBe('3 giờ')
    expect(relativeTime('2026-11-20T08:00:00Z', NOW)).toBe('Hôm qua')
  })
})
