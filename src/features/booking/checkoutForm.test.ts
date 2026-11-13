import { describe, expect, it } from 'vitest'

import {
  hasErrors,
  isSafePaymentUrl,
  maskPhone,
  needsSave,
  normalizePhone,
  toProfile,
  validateProfile,
} from './checkoutForm'

const ok = { full_name: 'Nguyễn Minh Anh', phone: '0901234821', email: 'minhanh@gmail.com' }

describe('validateProfile', () => {
  it('hồ sơ hợp lệ không có lỗi', () => {
    expect(hasErrors(validateProfile(ok))).toBe(false)
  })

  it('báo lỗi từng trường', () => {
    const e = validateProfile({ full_name: ' ', phone: '123', email: 'abc' })
    expect(Object.keys(e).sort()).toEqual(['email', 'full_name', 'phone'])
  })

  it('chấp nhận số có dấu cách và +84', () => {
    expect(validateProfile({ ...ok, phone: '090 123 4821' }).phone).toBeUndefined()
    expect(validateProfile({ ...ok, phone: '+84901234821' }).phone).toBeUndefined()
    expect(validateProfile({ ...ok, phone: '901234821' }).phone).toBeDefined()
  })
})

describe('normalizePhone / toProfile', () => {
  it('chuẩn hoá về 10 chữ số bắt đầu bằng 0', () => {
    expect(normalizePhone('+84 901 234 821')).toBe('0901234821')
    expect(toProfile({ ...ok, full_name: '  Minh Anh ', phone: '090.123.4821' })).toEqual({
      full_name: 'Minh Anh',
      phone: '0901234821',
      email: 'minhanh@gmail.com',
    })
  })
})

describe('needsSave', () => {
  it('chưa có hồ sơ hoặc có thay đổi thì cần lưu, giống hệt thì không', () => {
    expect(needsSave(ok, undefined)).toBe(true)
    expect(needsSave(ok, { ...ok })).toBe(false)
    expect(needsSave({ ...ok, phone: '090 123 4821' }, { ...ok })).toBe(false)
    expect(needsSave({ ...ok, email: 'khac@gmail.com' }, { ...ok })).toBe(true)
  })
})

describe('maskPhone', () => {
  it('che phần giữa của số điện thoại', () => {
    expect(maskPhone('0901234821')).toBe('090 *** 4821')
    expect(maskPhone('12')).toBe('***')
  })
})

describe('isSafePaymentUrl', () => {
  it('chỉ nhận https', () => {
    expect(isSafePaymentUrl('https://sandbox.vnpayment.vn/pay?x=1')).toBe(true)
    expect(isSafePaymentUrl('http://sandbox.vnpayment.vn')).toBe(false)
    expect(isSafePaymentUrl('javascript:alert(1)')).toBe(false)
    expect(isSafePaymentUrl('data:text/html,hi')).toBe(false)
    expect(isSafePaymentUrl('khong phai url')).toBe(false)
    expect(isSafePaymentUrl(undefined)).toBe(false)
  })
})
