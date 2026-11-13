import { beforeEach, describe, expect, it } from 'vitest'

import { clearNext, googleOutcome, peekNext, rememberNext } from './googleCallback'

describe('googleOutcome', () => {
  it('success và created đều là đã đăng nhập', () => {
    expect(googleOutcome('success').kind).toBe('signed_in')
    expect(googleOutcome('created').kind).toBe('signed_in')
  })

  it('email_taken báo email đã đăng ký bằng mật khẩu', () => {
    const o = googleOutcome('email_taken')
    expect(o.kind === 'error' && o.message).toContain('đã đăng ký bằng mật khẩu')
  })

  it('failed và giá trị lạ đều ra câu báo lỗi', () => {
    expect(googleOutcome('failed').kind).toBe('error')
    expect(googleOutcome(null).kind).toBe('error')
    expect(googleOutcome('abc').kind).toBe('error')
  })
})

describe('trang quay lại sau Google', () => {
  beforeEach(() => sessionStorage.clear())

  it('mặc định về trang chủ', () => {
    expect(peekNext()).toBe('/')
  })

  it('nhớ đường dẫn nội bộ và xoá được', () => {
    rememberNext('/orders?x=1')
    expect(peekNext()).toBe('/orders?x=1')
    clearNext()
    expect(peekNext()).toBe('/')
  })

  it('từ chối địa chỉ ngoài site', () => {
    rememberNext('//evil.com')
    expect(peekNext()).toBe('/')
    rememberNext('https://evil.com')
    expect(peekNext()).toBe('/')
  })
})
