import { describe, expect, it } from 'vitest'

import type { User } from '@/api/generated/model'

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

// Mở rộng kiểu gọi trong test để lượt 1 không phải sửa chữ ký production của module app/.
// Lượt 2 thêm tham số user tuỳ chọn thứ ba; lời gọi hai tham số ở trên vẫn giữ nguyên.
const buildForUser: (
  ...args: [...Parameters<typeof buildNotifications>, user?: User | null]
) => ReturnType<typeof buildNotifications> = buildNotifications

describe('buildNotifications thông báo xác minh điện thoại', () => {
  it('BUYER có cờ false nhận thông báo ghim trên mọi thông báo đơn hàng', () => {
    const orders = [
      { id: 'old', status: 'EXPIRED' as const, created_at: '2026-11-20T09:00:00Z' },
      { id: 'new', status: 'PAID' as const, paid_at: '2026-11-21T10:01:00Z' },
    ]
    const notifications = buildForUser(orders, NOW, { role: 'BUYER', phone_verified: false })
    expect(notifications[0]).toMatchObject({
      id: 'phone-verification',
      tone: 'warning',
      title: 'Xác minh số điện thoại để đặt vé',
      hint: 'Quý khách vui lòng xác minh số điện thoại để đặt vé. Nhấn vào đây để xác minh.',
      to: '/me/security?verify=phone',
    })
    expect(notifications.slice(1)).toEqual(buildNotifications(orders, NOW))
  })

  it('chưa có đơn nào vẫn có thông báo xác minh', () => {
    const notifications = buildForUser([], NOW, { role: 'BUYER', phone_verified: false })
    expect(notifications).toHaveLength(1)
    expect(notifications[0].id).toBe('phone-verification')
  })

  it.each([
    { label: 'BUYER đã xác minh', user: { role: 'BUYER', phone_verified: true } },
    { label: 'BUYER thiếu cờ', user: { role: 'BUYER' } },
    { label: 'ADMIN có cờ false', user: { role: 'ADMIN', phone_verified: false } },
    { label: 'chưa đăng nhập', user: null },
  ] satisfies { label: string; user: User | null }[])(
    '$label không nhận thông báo xác minh và giữ nguyên thông báo đơn',
    ({ user }) => {
      const orders = [{ id: 'paid', status: 'PAID' as const, paid_at: '2026-11-21T09:59:00Z' }]
      expect(buildForUser(orders, NOW, user)).toEqual(buildNotifications(orders, NOW))
      expect(buildForUser(orders, NOW, user).some((item) => item.id === 'phone-verification')).toBe(false)
    },
  )

  it('id ổn định giữa những lần tính lại và chỉ có một thông báo ghim', () => {
    const user: User = { role: 'BUYER', phone_verified: false }
    const first = buildForUser([], NOW, user)
    const next = buildForUser([], NOW + 30_000, user)
    expect(first.filter((item) => item.id === 'phone-verification')).toHaveLength(1)
    expect(next.filter((item) => item.id === 'phone-verification')).toHaveLength(1)
    expect(first[0].id).toBe(next[0].id)
  })

  it('lời gọi cũ không truyền user giữ nguyên kết quả', () => {
    expect(buildForUser([], NOW)).toEqual([])
  })
})
