import { describe, expect, it } from 'vitest'
import { loginDestination } from './redirect'

describe('loginDestination', () => {
  it('mặc định theo vai trò', () => {
    expect(loginDestination('ADMIN')).toBe('/admin')
    expect(loginDestination('BUYER')).toBe('/events')
  })
  it('giữ deep link có query và hash đúng quyền', () => {
    expect(loginDestination('ADMIN', '/admin/orders?status=PENDING#list')).toBe('/admin/orders?status=PENDING#list')
    expect(loginDestination('ADMIN', '/checkin?showtime=1')).toBe('/checkin?showtime=1')
    expect(loginDestination('BUYER', '/orders/1?tab=tickets#qr')).toBe('/orders/1?tab=tickets#qr')
  })
  it('không dùng next sai vai trò', () => {
    expect(loginDestination('ADMIN', '/events')).toBe('/admin')
    expect(loginDestination('BUYER', '/admin')).toBe('/events')
    expect(loginDestination('BUYER', '/admin/orders')).toBe('/events')
    expect(loginDestination('BUYER', '/checkin')).toBe('/events')
    expect(loginDestination('BUYER', '/events/../admin')).toBe('/events')
  })
  it.each([
    'https://evil.test',
    '//evil.test',
    '/%2f%2fevil.test',
    '/%5cevil.test',
    '/%00',
    '/%',
    '/admin/../login',
    '/login?next=/admin',
    '/admin/login/',
    '/auth/google',
    '/register',
    '/verify-otp',
    '/forgot-password',
    '/reset-password',
  ])('từ chối địa chỉ ngoài site hoặc luồng auth: %s', (next) => {
    expect(loginDestination('ADMIN', next)).toBe('/admin')
    expect(loginDestination('BUYER', next)).toBe('/events')
  })
  it('từ chối backslash và ký tự điều khiển', () => {
    for (const next of ['/\\evil.test', '/admin\n']) {
      expect(loginDestination('ADMIN', next)).toBe('/admin')
    }
  })
})
