import { describe, expect, it } from 'vitest'

import { isEmail, isVnPhone, passwordStrength } from './validate'

describe('validate', () => {
  it('nhận email hợp lệ và loại email thiếu tên miền', () => {
    expect(isEmail('a@b.vn')).toBe(true)
    expect(isEmail('a@b')).toBe(false)
  })
  it('nhận số điện thoại VN các dạng', () => {
    expect(isVnPhone('090 123 4821')).toBe(true)
    expect(isVnPhone('+84901234821')).toBe(true)
    expect(isVnPhone('12345')).toBe(false)
  })
  it('chấm độ mạnh mật khẩu', () => {
    expect(passwordStrength('')).toBe(0)
    expect(passwordStrength('abc')).toBe(1)
    expect(passwordStrength('Abcdefg1')).toBe(3)
    expect(passwordStrength('Abcdefg1!')).toBe(4)
  })
})
