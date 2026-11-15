import { describe, expect, it } from 'vitest'

import type { User } from '@/api/generated/model'

import { toSentryUser } from './sentry-user'

describe('toSentryUser', () => {
  it('chỉ giữ id và role, bỏ email và số điện thoại', () => {
    const user = { id: 'u-1', email: 'a@b.vn', phone: '0912345678', role: 'BUYER' } as User
    expect(toSentryUser(user)).toEqual({ id: 'u-1', role: 'BUYER' })
  })

  it('trả null khi chưa đăng nhập hoặc thiếu id', () => {
    expect(toSentryUser(null)).toBeNull()
    expect(toSentryUser({ email: 'a@b.vn' } as User)).toBeNull()
  })
})
